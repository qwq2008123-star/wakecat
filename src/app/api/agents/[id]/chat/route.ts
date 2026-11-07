import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser, HttpError } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getLlmConfig } from "@/lib/llm";

/* ============================================================
   AI 员工对话(真实):每个 Agent 带各自的实时经营数据上下文,
   GLM 主路径;失败诚实降级到数据模板(标注 engine=rules)。
   底线:只允许引用注入的真实数字,不知道就说不记得。
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

  if (config.apiKey && config.engineMode !== "rules") {
    try {
      const msgs = [
        {
          role: "system",
          content: `你是美甲店「喵屋美甲」的 ${persona.name}(${persona.role}),正在和老板娘 ${user.name} 对话。
以下是此刻的真实经营数据(只允许引用这些数字,禁止编造):
${context}
说话风格:像同一家店的搭档——干脆、口语、带一点点猫的俏皮,3 句以内;数字要精确引用。
底线:1) 数据之外的细节就说不确定,请她去对应页面看;2) 需要行动的事项,告诉她去哪个页面办(任务大厅下目标/行动清单发送/会话接管回复);3) 不承诺任何未经授权的动作。`,
        },
        ...(Array.isArray(history) ? history.slice(-8) : []),
        { role: "user", content: text },
      ];
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model, messages: msgs, temperature: 0.7, max_tokens: 200 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const data = await res.json();
        const reply: string | undefined = data.choices?.[0]?.message?.content;
        if (reply) {
          return NextResponse.json({
            text: reply.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim(),
            engine: "llm",
          });
        }
      } else {
        console.error(`[agent-chat] GLM HTTP ${res.status}`);
      }
    } catch (e) {
      console.error("[agent-chat] GLM 异常:", e instanceof Error ? e.message : e);
    }
  }
  // 诚实降级:数据模板(同一份真实数字)
  return NextResponse.json({ text: rulesReply(id, user.storeId), engine: "rules" });
}
