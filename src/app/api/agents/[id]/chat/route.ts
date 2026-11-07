import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser, HttpError } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getLlmConfig } from "@/lib/llm";
import { runToolLoop, ToolSchema } from "@/lib/llm";
import { runOrchestrator, executeApprovedTask } from "@/lib/agents";
import { createGoalTask, decideTask, getTask } from "@/lib/services";

/* ============================================================
   AI 员工对话(真实):每个 Agent 带各自的实时经营数据上下文,
   GLM 主路径;失败诚实降级到数据模板(标注 engine=rules)。
   喵老板额外挂三个真工具:立项/批准/执行——说到做到,
   但只在老板娘明确要求时动作,且所有闸门(授权/频次/预算)照常生效。
   ============================================================ */

type Row = Record<string, unknown>;
const n = (v: unknown) => Math.round(Number(v) || 0);

function bossContext(storeId: string): string {
  const states = sqlite.prepare(`
    SELECT state, COUNT(*) AS c FROM (
      SELECT CASE WHEN julianday('now') - julianday(COALESCE((SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id=m.id),'2000-01-01')) < 14 THEN 'active'
                  WHEN julianday('now') - julianday(COALESCE((SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id=m.id),'2000-01-01')) < 45 THEN 'drowsy'
                  ELSE 'hibernate' END AS state
      FROM members m WHERE m.store_id = ?
    ) GROUP BY state
  `).all(storeId) as Row[];
  const s = Object.fromEntries(states.map((r) => [r.state, n(r.c)]));
  const pending = n((sqlite.prepare("SELECT COUNT(*) AS c FROM tasks WHERE store_id=? AND status='pending_approval'").get(storeId) as Row).c);
  const awaiting = n((sqlite.prepare(`
    SELECT COUNT(*) AS c FROM outreach_messages o JOIN tasks t ON t.id=o.task_id
    WHERE t.store_id=? AND o.status='awaiting_send'`).get(storeId) as Row).c);
  const needsHuman = n((sqlite.prepare("SELECT COUNT(*) AS c FROM conversations WHERE store_id=? AND status='needs_human'").get(storeId) as Row).c);
  const todayAppt = n((sqlite.prepare("SELECT COUNT(*) AS c FROM appointments WHERE store_id=? AND scheduled_for LIKE ? || '%' AND status='confirmed'").get(storeId, new Date().toISOString().slice(0, 10)) as Row).c);
  const fin = sqlite.prepare("SELECT COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost, COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS rev FROM finance_entries WHERE store_id=?").get(storeId) as Row;
  return `会员 ${s.active ?? 0} 活跃 / ${s.drowsy ?? 0} 打瞌睡 / ${s.hibernate ?? 0} 冬眠;待审批任务 ${pending} 个;待真实发送消息 ${awaiting} 条;等待人工接管会话 ${needsHuman} 个;今日确认预约 ${todayAppt} 单;累计营销成本 ¥${n(fin.cost)},回流收入 ¥${n(fin.rev)}。${detectiveContext(storeId)}。`;
}

function detectiveContext(storeId: string): string {
  const top = sqlite.prepare(`
    SELECT m.name,
      CAST(julianday('now') - julianday(COALESCE((SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id=m.id),'2000-01-01')) AS INT) AS days,
      (SELECT COALESCE(SUM(amount),0) FROM consumption_records r WHERE r.member_id=m.id) AS spend,
      (SELECT service FROM consumption_records r WHERE r.member_id=m.id ORDER BY occurred_at DESC LIMIT 1) AS last_svc
    FROM members m WHERE m.store_id = ?
    ORDER BY days DESC LIMIT 3
  `).all(storeId) as Row[];
  return "流失最久的三位:" + top.map((t) => `${t.name}(${t.days} 天没来,累计 ¥${n(t.spend)},上次做「${t.last_svc}」)`).join(";");
}

function strategistContext(storeId: string): string {
  const rows = sqlite.prepare(`
    SELECT s.kind, COUNT(*) AS c FROM strategies s JOIN tasks t ON t.id=s.task_id
    WHERE t.store_id=? GROUP BY s.kind`).all(storeId) as Row[];
  const awaiting = n((sqlite.prepare(`
    SELECT COUNT(*) AS c FROM outreach_messages o JOIN tasks t ON t.id=o.task_id
    WHERE t.store_id=? AND o.status='awaiting_send'`).get(storeId) as Row).c);
  return "已制定策略:" + (rows.length ? rows.map((r) => `${r.kind}×${n(r.c)}`).join("、") : "暂无") + `;待发送消息 ${awaiting} 条。`;
}

function sellerContext(storeId: string): string {
  const st = sqlite.prepare(`
    SELECT o.status, COUNT(*) AS c FROM outreach_messages o JOIN tasks t ON t.id=o.task_id
    WHERE t.store_id=? GROUP BY o.status`).all(storeId) as Row[];
  const m = Object.fromEntries(st.map((r) => [r.status, n(r.c)]));
  return `触达消息:sent ${m.sent ?? 0} / replied ${m.replied ?? 0} / awaiting_send ${m.awaiting_send ?? 0} / failed ${m.failed ?? 0}。`;
}

function accountantContext(storeId: string): string {
  const fin = sqlite.prepare("SELECT COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost, COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS rev FROM finance_entries WHERE store_id=?").get(storeId) as Row;
  const coupons = n((sqlite.prepare("SELECT COUNT(*) AS c FROM coupon_grants WHERE store_id=? AND status='granted'").get(storeId) as Row).c);
  return `累计营销成本 ¥${n(fin.cost)},回流收入 ¥${n(fin.rev)},ROI ${n(fin.rev) > 0 ? (n(fin.rev) / Math.max(1, n(fin.cost))).toFixed(1) : "—"},已发未用券 ${coupons} 张。`;
}

const PERSONAS: Record<string, { name: string; role: string; ctx: (storeId: string) => string; rules: (storeId: string) => string }> = {
  boss: {
    name: "喵老板", role: "总控 AI · 经营总管,负责理解商家目标、拆解任务、验收各员工产出",
    ctx: bossContext,
    rules: (sid) => `我这边最新账面是——${bossContext(sid)} 要给我派活,去任务大厅下目标就行。`,
  },
  detective: {
    name: "侦探喵", role: "会员体检官,用真实工具查会员状态、找出流失风险",
    ctx: detectiveContext,
    rules: (sid) => `${detectiveContext(sid)}。想看完整名单去会员宇宙。`,
  },
  strategist: {
    name: "军师喵", role: "策略制定者,为每位会员出一对一唤醒策略,只从真实目录取价",
    ctx: strategistContext,
    rules: (sid) => `${strategistContext(sid)}。`,
  },
  seller: {
    name: "销售喵", role: "触达执行者,三闸门(授权/频次/预算)内起草消息,站内直发或半自动企微",
    ctx: sellerContext,
    rules: (sid) => `${sellerContext(sid)} 未经商家批准我从不碰客户。`,
  },
  accountant: {
    name: "财务喵", role: "账房,记录每笔触达成本与回流收入,算清 ROI",
    ctx: accountantContext,
    rules: (sid) => `${accountantContext(sid)} 每一分钱都有账。`,
  },
};

function rulesReply(agentId: string, storeId: string): string {
  return PERSONAS[agentId]?.rules(storeId) ?? "我在。";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const user = await requireUser();
  const { id } = await params;
  const persona = PERSONAS[id];
  if (!persona) return NextResponse.json({ error: "未知员工" }, { status: 404 });

  const { message, history } = await req.json().catch(() => ({ message: "", history: [] }));
  const text = String(message ?? "").slice(0, 500);
  if (!text.trim()) return NextResponse.json({ error: "说点什么吧" }, { status: 400 });

  const context = persona.ctx(user.storeId);
  const config = await getLlmConfig(user.storeId);

  /* 喵老板专属:真工具(立项/批准/执行)。后台跑编排,聊天里如实回报 */
  const bossTools = (): ToolSchema[] => id === "boss" ? [
    {
      type: "function", function: {
        name: "create_goal_task",
        description: "把老板娘的经营目标立项为真实任务,侦探喵和军师喵随即开始编排(后台进行,几分钟后进入待审批)。只在老板娘明确要求你去做时调用。",
        parameters: {
          type: "object",
          properties: { goal: { type: "string", description: "经营目标原话,至少 4 个字" } },
          required: ["goal"],
        },
      },
    },
    {
      type: "function", function: {
        name: "approve_task",
        description: "批准一个处于待审批状态的任务(授权销售喵触达客户)。只在老板娘明确说批准/同意时调用。taskId 可省略:省略时自动指最近一条待审批任务。",
        parameters: {
          type: "object",
          properties: { taskId: { type: "string", description: "可省略,省略时取最近一条待审批任务" } },
        },
      },
    },
    {
      type: "function", function: {
        name: "execute_task",
        description: "让销售喵执行一个已批准的任务(真实触达:站内直发或转人工)。只在老板娘明确要求执行时调用。taskId 可省略:省略时自动指最近一条已批准任务。",
        parameters: {
          type: "object",
          properties: { taskId: { type: "string", description: "可省略,省略时取最近一条已批准任务" } },
        },
      },
    },
  ] : [];

  const bossExecute = id === "boss" ? async (name: string, args: unknown) => {
    const a = (args ?? {}) as Record<string, unknown>;
    try {
      switch (name) {
        case "create_goal_task": {
          const goal = String(a.goal ?? "").trim();
          if (goal.length < 4) throw new Error("目标太短,至少 4 个字");
          const taskId = await createGoalTask(user.storeId, goal);
          // 后台编排:noop emit,进度写入 task_logs(任务大厅可见)
          void runOrchestrator(user, goal, () => {}, taskId).catch((e) => {
            console.error("[boss-chat] 编排后台失败:", e instanceof Error ? e.message : e);
          });
          return { ok: true, taskId, message: "任务已立项,侦探喵体检→军师喵策略正在后台进行,几分钟后进入待审批,可在任务大厅看进度" };
        }
        case "approve_task": {
          let taskId = String(a.taskId ?? "");
          if (!taskId) {
            const row = sqlite.prepare("SELECT id, title FROM tasks WHERE store_id=? AND status='pending_approval' ORDER BY created_at DESC LIMIT 1").get(user.storeId) as Row | undefined;
            if (!row) return { ok: false, error: "当前没有待审批的任务" };
            taskId = row.id as string;
          }
          const t = await getTask(taskId);
          if (!t || t.storeId !== user.storeId) return { ok: false, error: "任务不存在" };
          if (t.status !== "pending_approval") return { ok: false, error: `任务状态为 ${t.status},只有待审批的任务才能批准` };
          await decideTask(user, taskId, true);
          return { ok: true, taskId, title: t.title, message: `任务「${t.title}」(${taskId}) 已批准,触达与发券已授权;老板娘说『去执行』即可让销售喵动手` };
        }
        case "execute_task": {
          let taskId = String(a.taskId ?? "");
          if (!taskId) {
            const row = sqlite.prepare("SELECT id, title FROM tasks WHERE store_id=? AND status='approved' ORDER BY created_at DESC LIMIT 1").get(user.storeId) as Row | undefined;
            if (!row) return { ok: false, error: "当前没有已批准待执行的任务" };
            taskId = row.id as string;
          }
          const t = await getTask(taskId);
          if (!t || t.storeId !== user.storeId) return { ok: false, error: "任务不存在" };
          if (t.status !== "approved") return { ok: false, error: `任务状态为 ${t.status},需先批准才能执行` };
          void executeApprovedTask(user, taskId, () => {}).catch((e) => {
            console.error("[boss-chat] 执行后台失败:", e instanceof Error ? e.message : e);
          });
          return { ok: true, taskId, title: t.title, message: `任务「${t.title}」(${taskId}) 销售喵已开始执行:逐一生成触达,站内直发或转行动清单,几分钟后去驾驶舱看结果` };
        }
        default:
          return { ok: false, error: `未知工具 ${name}` };
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "工具执行失败" };
    }
  } : undefined;

  if (config.apiKey && config.engineMode !== "rules") {
    try {
      const baseSystem = `你是美甲店「喵屋美甲」的 ${persona.name}(${persona.role}),正在和老板娘 ${user.name} 对话。
以下是此刻的真实经营数据(只允许引用这些数字,禁止编造):
${context}
说话风格:像同一家店的搭档——干脆、口语、带一点点猫的俏皮,3 句以内;数字要精确引用。
底线:1) 数据之外的细节就说不确定,请她去对应页面看;2) 不承诺任何你做不到的事。`;
      const bossSystem = id === "boss"
        ? `${baseSystem}
你有三个真工具,能真实操作(不是嘴上说说):
- create_goal_task:老板娘叫你去做/唤醒/召回某人群时调用,目标取她的原话;
- approve_task:任务进入待审批且她明确同意时调用;
- execute_task:她明确要你执行时调用。
调用后必须在回复里如实转述工具返回的结果(成功就说已立项/已批准/执行中,失败就说原因)。
未经她明确要求,绝不擅自调用工具;一次回复最多调用一个工具。`
        : baseSystem;

      const res = await runToolLoop({
        config,
        system: bossSystem,
        messages: [
          ...(Array.isArray(history) ? history.slice(-8) : []),
          { role: "user", content: text },
        ],
        tools: bossTools(),
        executeTool: bossExecute ?? (() => ({})),
        maxRounds: 4,
      });
      if (!res.error && res.text) {
        return NextResponse.json({
          text: res.text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim(),
          engine: "llm",
          toolsUsed: res.toolCallCount,
        });
      }
      console.error(`[agent-chat] GLM 工具循环失败: ${res.error ?? "无文本"}`);
    } catch (e) {
      console.error("[agent-chat] GLM 异常:", e instanceof Error ? e.message : e);
    }
  }
  // 诚实降级:数据模板(同一份真实数字);喵老板补一句怎么让它们动手
  const fallback = rulesReply(id, user.storeId);
  return NextResponse.json({
    text: id === "boss"
      ? `${fallback} 想让我动手的话,直接说「帮我立项:唤醒45天没来的会员」这种带目标的指令——不过模型这会儿没响应,先去任务大厅下目标最稳。`
      : fallback,
    engine: "rules",
  });
}
