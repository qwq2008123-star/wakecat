import { db, sqlite } from "./db/client";
import { strategies, outreachMessages } from "./db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  getLlmConfig, LlmConfig, runToolLoop, ToolSchema, ChatMessage,
} from "./llm";
import {
  createGoalTask, updateTask, getTask, appendLog, queueAndSend, SessionUserLike,
} from "./services";
import { runOpportunityScan } from "./sales/opportunity-engine";

const rid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

export type AgentEvent =
  | { type: "stage"; stage: string; label: string; status: "start" | "ok" | "error"; engine?: string }
  | { type: "log"; agent: string; step: string; message?: string; tool?: string; detail?: string }
  | { type: "done"; taskId: string; title: string; status: string; summary: string };

type Emit = (e: AgentEvent) => void;

/* ================= 数据访问(Agent 专用,带 storeId 隔离) ================= */

type MemberBrief = {
  id: string; name: string; level: string; tags: string[];
  daysSinceVisit: number | null; totalSpend: number; visits: number;
  lastService: string | null; state: string;
};

function memberBriefs(storeId: string): MemberBrief[] {
  const rows = sqlite.prepare(`
    SELECT m.id, m.name, m.level, m.tags_json,
      (SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id = m.id) AS last_visit,
      (SELECT COALESCE(SUM(amount),0) FROM consumption_records r WHERE r.member_id = m.id) AS total_spend,
      (SELECT COUNT(*) FROM consumption_records r WHERE r.member_id = m.id) AS visits,
      (SELECT service FROM consumption_records r WHERE r.member_id = m.id ORDER BY occurred_at DESC LIMIT 1) AS last_service
    FROM members m WHERE m.store_id = ?
  `).all(storeId) as Record<string, unknown>[];
  return rows.map((r) => {
    const tags = JSON.parse((r.tags_json as string) || "[]");
    const days = r.last_visit ? Math.floor((Date.now() - new Date(r.last_visit as string).getTime()) / 86400_000) : null;
    const state = tags.includes("卡快过期") ? "sick" : days == null ? "hibernate" : days <= 30 ? "active" : days <= 75 ? "drowsy" : "hibernate";
    return {
      id: r.id as string, name: r.name as string, level: r.level as string, tags,
      daysSinceVisit: days, totalSpend: (r.total_spend as number) || 0,
      visits: (r.visits as number) || 0, lastService: (r.last_service as string) || null, state,
    };
  });
}

function memberProfile(storeId: string, memberId: string) {
  const m = sqlite.prepare("SELECT * FROM members WHERE id = ? AND store_id = ?").get(memberId, storeId) as Record<string, unknown> | undefined;
  if (!m) return null;
  const records = sqlite.prepare("SELECT service, amount, artist, occurred_at FROM consumption_records WHERE member_id = ? ORDER BY occurred_at DESC LIMIT 8").all(memberId);
  const memories = sqlite.prepare("SELECT kind, content, source_type, source_ref FROM member_memories WHERE member_id = ? ORDER BY confidence DESC, created_at DESC LIMIT 6").all(memberId);
  return {
    id: m.id, name: m.name, level: m.level, tags: JSON.parse((m.tags_json as string) || "[]"),
    records, memories, // memories 均带来源,供消息生成引用
  };
}

function sourcedFacts(storeId: string, memberId: string): string[] {
  const rows = sqlite.prepare(`
    SELECT content FROM member_memories
    WHERE member_id = ? AND source_type IN ('order','chat','manual')
    ORDER BY confidence DESC LIMIT 5
  `).all(memberId) as { content: string }[];
  return rows.map((r) => r.content);
}

/* ================= 规则引擎(离线兜底,与 LLM 产出同构) ================= */

function rulesDetective(storeId: string): {
  segments: { name: string; count: number; desc: string }[];
  opportunities: Array<MemberBrief & { reason: string; risk: string }>;
} {
  const mems = memberBriefs(storeId);
  const seg = (s: string) => mems.filter((m) => m.state === s);
  const segments = [
    { name: "活跃", count: seg("active").length, desc: "30 天内有到店" },
    { name: "打瞌睡", count: seg("drowsy").length, desc: "35-75 天未到店,有流失迹象" },
    { name: "冬眠", count: seg("hibernate").length, desc: "超过 75 天未到店" },
    { name: "卡快过期", count: seg("sick").length, desc: "会员权益/卡即将到期,流失损失最大" },
  ];
  const opportunities = mems
    .filter((m) => m.state !== "active")
    .sort((a, b) => {
      const w = (m: MemberBrief) => (m.state === "sick" ? 3 : m.state === "hibernate" ? 2 : 1) * 1000 + m.totalSpend;
      return w(b) - w(a);
    })
    .slice(0, 8)
    .map((m) => ({
      ...m,
      reason: m.state === "sick"
        ? "卡即将到期,权益未消耗完,是唤醒价值最高的窗口"
        : m.state === "hibernate"
          ? `已 ${m.daysSinceVisit} 天未到店,历史累计消费 ¥${Math.round(m.totalSpend)},流失风险高`
          : `${m.daysSinceVisit} 天未到店,开始进入瞌睡期,及时触达成本最低`,
      risk: m.state === "sick" ? "高" : m.state === "hibernate" ? "高" : "中",
    }));
  return { segments, opportunities };
}

function rulesStrategies(storeId: string, taskId: string, ops: Array<Record<string, unknown>>) {
  return ops.map((raw) => {
    const o = {
      ...(raw as unknown as MemberBrief & { reason?: string }),
      id: (raw.memberId ?? raw.id) as string,
      name: (raw.name ?? "") as string,
      reason: (raw.reason ?? "") as string,
    };
    let kind = "callback", content = "", cost = 0, uplift = 0;
    if (o.state === "sick") {
      kind = "rights";
      content = `${o.name}姐,你的会员卡本月底到期,里面还有权益没用完,到期就作废啦。这周有空来用掉吗?小林帮你查过了,一次都没浪费~`;
      cost = 0; uplift = 88 * 0.3;
    } else if (o.totalSpend > 600) {
      kind = "coupon";
      content = `${o.name}姐,好久不见啦~店庆给你留了张 30 元喵喵券,做上次那款「${o.lastService ?? "猫眼款"}」正好用得上。这周有空来坐坐吗?小林等你喵~`;
      cost = 30; uplift = 128 * 0.35;
    } else if (o.state === "drowsy") {
      kind = "new_item";
      content = `${o.name}姐~上次你做的「${o.lastService ?? "纯色跳色"}」,新色板刚到,第一个想到你!本周来做还送手部护理,要不要约一个?`;
      cost = 0; uplift = 98 * 0.25;
    } else {
      kind = "callback";
      content = `${o.name}姐,好久不见,最近还好嘛?有空来店里坐坐,先不聊项目,喝杯茶让猫晒晒太阳也行呀~`;
      cost = 0; uplift = 128 * 0.15;
    }
    return { memberId: o.id, memberName: o.name, kind, content, cost, uplift, reason: o.reason };
  });
}

function rulesMessage(strategy: { memberName: string; kind: string; content: string }): string {
  return strategy.content; // 规则引擎的消息即模板内容
}

/* ================= 工具 Schema ================= */

const TS = (name: string, description: string, parameters: Record<string, unknown>): ToolSchema =>
  ({ type: "function", function: { name, description, parameters } });

function detectiveTools(): ToolSchema[] {
  return [
    TS("segment_overview", "获取会员分群概况(活跃/打瞌睡/冬眠/卡快过期的数量与平均消费)", { type: "object", properties: {} }),
    TS("find_sleeping_members", "按状态筛选会员列表,返回沉睡/临流失会员及消费概况", {
      type: "object",
      properties: {
        state: { type: "string", enum: ["drowsy", "hibernate", "sick"], description: "会员状态" },
        limit: { type: "number", description: "最多返回条数,默认 8" },
      },
      required: [],
    }),
    TS("get_member_profile", "查看单个会员的档案:最近消费、带来源的记忆", {
      type: "object",
      properties: { memberId: { type: "string" } },
      required: ["memberId"],
    }),
  ];
}

function strategistTools(): ToolSchema[] {
  return [
    TS("get_opportunities", "读取侦探喵输出的唤醒机会清单", { type: "object", properties: {} }),
    TS("get_member_profile", "查看会员档案与带来源的记忆,用于个性化策略", {
      type: "object", properties: { memberId: { type: "string" } }, required: ["memberId"],
    }),
    TS("propose_strategy", "为一名会员提交唤醒策略(每位会员恰好一条)", {
      type: "object",
      properties: {
        memberId: { type: "string" },
        kind: { type: "string", enum: ["coupon", "new_item", "rights", "callback"] },
        content: { type: "string", description: "策略说明(发送消息的正文要点)" },
        predictedCost: { type: "number", description: "预估成本(元),如券面额" },
        predictedUplift: { type: "number", description: "预估带来的到店消费(元)" },
        reason: { type: "string", description: "选择该策略的理由" },
      },
      required: ["memberId", "kind", "content", "predictedCost", "predictedUplift", "reason"],
    }),
  ];
}

function sellerTools(): ToolSchema[] {
  return [
    TS("get_approved_strategies", "读取本任务已批准的策略清单(含会员的带来源记忆事实)", { type: "object", properties: {} }),
    TS("generate_and_send", "生成个性化唤醒消息并通过企微(演示通道)发送给一名会员。只允许引用策略清单里给出的有来源事实,不得编造。", {
      type: "object",
      properties: {
        strategyId: { type: "string" },
        body: { type: "string", description: "消息正文,120 字以内,口语化,像熟人聊天" },
      },
      required: ["strategyId", "body"],
    }),
  ];
}

function accountantTools(): ToolSchema[] {
  return [
    TS("get_task_finance", "获取本任务的成本/收入/漏斗数据", { type: "object", properties: {} }),
    TS("compare_strategies", "按策略类型对比效果(触达/回复/到店/收入)", { type: "object", properties: {} }),
  ];
}

/* ================= 各 Agent 执行器 ================= */

type Ctx = { storeId: string; taskId: string; emit: Emit; config: LlmConfig };

async function runAgentStage(opts: {
  ctx: Ctx; agent: string; stage: string; label: string;
  system: string; userMsg: string; tools: ToolSchema[];
  executeTool: (name: string, args: unknown) => Promise<unknown> | unknown;
  fallback: () => Promise<{ payload: Record<string, unknown>; summary: string }>;
  forceRules?: boolean;
}): Promise<{ payload: Record<string, unknown>; summary: string; engine: "llm" | "rules"; error?: string }> {
  const { ctx, agent, stage, label } = opts;
  const mode = opts.forceRules ? "rules" : ctx.config.engineMode;
  /* 三分支路由:rules 强制规则;llm 必须有 Key 否则终止;auto 有 Key 走 LLM、失败诚实降级 */
  if (mode === "llm" && !ctx.config.apiKey) {
    await appendLog({ taskId: ctx.taskId, agent, step: "无法启动", status: "error", message: "engineMode=llm 但未配置 API Key,任务终止" });
    throw new Error("engineMode=llm 但未配置 API Key");
  }
  const useLlm = mode === "llm" || (mode === "auto" && !!ctx.config.apiKey);
  if (!useLlm) {
    ctx.emit({ type: "stage", stage, label, status: "start", engine: "rules" });
    await appendLog({ taskId: ctx.taskId, agent, step: `${label}(内置规则引擎)`, message: mode === "auto" ? "auto 模式:未配置 API Key,规则引擎接管" : "未使用大模型,规则引擎接管" });
    const r = await opts.fallback();
    ctx.emit({ type: "stage", stage, label, status: "ok", engine: "rules" });
    return { ...r, engine: "rules" };
  }
  ctx.emit({ type: "stage", stage, label, status: "start", engine: "llm" });
  await appendLog({ taskId: ctx.taskId, agent, step: `${label}(GLM·${ctx.config.model})`, message: "开始调用大模型与真实工具" });
  const result = await runToolLoop({
    config: ctx.config,
    system: opts.system,
    messages: [{ role: "user", content: opts.userMsg }],
    tools: opts.tools,
    onToolCall: async (name, args, output) => {
      await appendLog({
        taskId: ctx.taskId, agent, step: `调用工具 ${name}`, toolName: name,
        toolInput: args, toolOutput: output,
        message: `${agent} 调用了 ${name}`,
      });
      ctx.emit({
        type: "log", agent, step: `工具 ${name}`,
        message: JSON.stringify(args).slice(0, 120),
        tool: name, detail: JSON.stringify(output).slice(0, 200),
      });
    },
    executeTool: opts.executeTool,
  });
  if (result.error) {
    await appendLog({ taskId: ctx.taskId, agent, step: "LLM 调用失败,规则引擎接管", status: "error", message: result.error });
    ctx.emit({ type: "log", agent, step: "降级", message: `GLM 调用失败:${result.error},已切换规则引擎(诚实降级,非静默)` });
    const r = await opts.fallback();
    ctx.emit({ type: "stage", stage, label, status: "ok", engine: "rules" });
    return { ...r, engine: "rules", error: result.error };
  }
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(extractJson(result.text) || "{}"); } catch { payload = { note: result.text.slice(0, 500) }; }
  ctx.emit({ type: "stage", stage, label, status: "ok", engine: "llm" });
  return { payload, summary: result.text.slice(0, 400), engine: "llm" };
}

function extractJson(text: string): string | null {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

/* ---------- 侦探喵 ---------- */
export async function runDetective(ctx: Ctx) {
  return runAgentStage({
    ctx, agent: "侦探喵", stage: "detect", label: "侦探喵·会员体检",
    system: `你是「侦探喵」,一家美甲店的会员数据侦探。你只读数据、只说事实,绝不编造。
用提供的只读工具调查会员分群与沉睡情况。完成后,以严格的 JSON 结尾作最终答复,格式:
{"segments":[{"name":"..","count":0,"desc":".."}],"opportunities":[{"memberId":"..","name":"..","reason":"..","risk":"高|中"}],"summary":"一句话总结"}
opportunities 按唤醒价值排序,最多 8 人,优先卡快过期和深度沉睡且历史消费高者。`,
    userMsg: "请体检本店会员,找出最值得唤醒的沉睡会员,输出 JSON。",
    tools: detectiveTools(),
    executeTool: (name, args) => {
      const a = args as Record<string, unknown>;
      switch (name) {
        case "segment_overview": {
          const mems = memberBriefs(ctx.storeId);
          return ["active", "drowsy", "hibernate", "sick"].map((s) => {
            const list = mems.filter((m) => m.state === s);
            return { state: s, count: list.length, avgSpend: list.length ? Math.round(list.reduce((x, m) => x + m.totalSpend, 0) / list.length) : 0 };
          });
        }
        case "find_sleeping_members": {
          const lim = Number(a.limit ?? 8);
          return memberBriefs(ctx.storeId)
            .filter((m) => !a.state || m.state === a.state)
            .filter((m) => m.state !== "active")
            .sort((x, y) => y.totalSpend - x.totalSpend)
            .slice(0, lim)
            .map((m) => ({ id: m.id, name: m.name, state: m.state, daysSinceVisit: m.daysSinceVisit, totalSpend: Math.round(m.totalSpend), lastService: m.lastService }));
        }
        case "get_member_profile":
          return memberProfile(ctx.storeId, String(a.memberId));
        default:
          throw new Error(`未知工具 ${name}`);
      }
    },
    fallback: async () => {
      const scan = runOpportunityScan(ctx.storeId);   // 真实机会池落库(sales_opportunities)
      const r = rulesDetective(ctx.storeId);
      const opportunities = scan.opportunities.slice(0, 8).map((o) => ({
        memberId: o.memberId, name: o.memberName, spend: o.spend, totalSpend: o.spend,
        reason: `${o.reason} · 评分 ${o.score}(R${o.components.R}/V${o.components.V}/P${o.components.P})`,
        risk: o.score > 70 ? "高" : o.score > 45 ? "中" : "低",
      }));
      const analysis = {
        segments: r.segments, opportunities,
        summary: `扫描 ${scan.scanned} 名会员,硬拦截 ${scan.blocked} 名(已退订),圈出 ${opportunities.length} 个唤醒机会。`,
      };
      return {
        payload: { analysis, opportunityCount: scan.opportunities.length, blocked: scan.blocked },
        summary: analysis.summary,
      };
    },
  });
}

/* ---------- 军师喵 ---------- */
export async function runStrategist(ctx: Ctx) {
  let count = 0; let cost = 0;
  const execute = async (name: string, args: unknown) => {
    const a = args as Record<string, unknown>;
    switch (name) {
      case "get_opportunities": {
        const t = await getTask(ctx.taskId);
        return (JSON.parse(t?.payloadJson || "{}").analysis as { opportunities?: unknown })?.opportunities ?? [];
      }
      case "get_member_profile":
        return memberProfile(ctx.storeId, String(a.memberId));
      case "propose_strategy": {
        if (count >= 10) throw new Error("策略数量已达上限(10)");
        const kinds = ["coupon", "new_item", "rights", "callback"];
        if (!kinds.includes(String(a.kind))) throw new Error("kind 非法");
        await db.insert(strategies).values({
          id: rid("st"), taskId: ctx.taskId, memberId: String(a.memberId),
          kind: String(a.kind), content: String(a.content).slice(0, 500),
          channel: "wecom-mock",
          predictedCost: Number(a.predictedCost) || 0,
          predictedUplift: Number(a.predictedUplift) || 0,
          reason: String(a.reason ?? "").slice(0, 300), createdAt: nowIso(),
        });
        count++; cost += Number(a.predictedCost) || 0;
        return { ok: true, strategyIndex: count };
      }
      default:
        throw new Error(`未知工具 ${name}`);
    }
  };
  const res = await runAgentStage({
    ctx, agent: "军师喵", stage: "plan", label: "军师喵·制定唤醒策略",
    system: `你是「军师喵」,为美甲店制定一对一会员唤醒策略。
先读取侦探喵的机会清单,再逐个查看会员档案(记忆均带来源),为每位会员调用 propose_strategy 提交恰好一条策略。
策略类型:coupon(优惠券)/ new_item(新品推荐)/ rights(权益到期提醒)/ callback(轻量回访)。
成本要保守(券面额就是成本),预估到店消费要给依据。最终以 JSON 结尾:
{"strategyCount":0,"totalCost":0,"byKind":{"coupon":0,"new_item":0,"rights":0,"callback":0},"summary":"一句话"}`,
    userMsg: "请为机会清单中的会员制定唤醒策略。",
    tools: strategistTools(),
    executeTool: execute,
    fallback: async () => {
      const t = await getTask(ctx.taskId);
      const analysis = JSON.parse(t?.payloadJson || "{}").analysis;
      const ops = analysis?.opportunities ?? [];
      const rows = rulesStrategies(ctx.storeId, ctx.taskId, ops);
      for (const r of rows) {
        await db.insert(strategies).values({
          id: rid("st"), taskId: ctx.taskId, memberId: r.memberId,
          kind: r.kind, content: r.content, channel: "wecom-mock",
          predictedCost: r.cost, predictedUplift: Math.round(r.uplift),
          reason: r.reason, createdAt: nowIso(),
        });
        count++; cost += r.cost;
      }
      const byKind: Record<string, number> = {};
      rows.forEach((r) => { byKind[r.kind] = (byKind[r.kind] || 0) + 1; });
      return { payload: { strategySummary: { count, totalCost: cost, byKind } }, summary: `为 ${count} 位会员制定了策略,预估成本 ¥${cost}。` };
    },
  });
  await updateTask(ctx.taskId, { costEstimate: cost });
  return res;
}

/* ---------- 销售喵 ---------- */
export async function runSeller(ctx: Ctx, user: SessionUserLike) {
  const sent = { total: 0, ok: 0, failed: 0 };
  const execute = async (name: string, args: unknown) => {
    const a = args as Record<string, unknown>;
    switch (name) {
      case "get_approved_strategies": {
        const rows = sqlite.prepare(`
          SELECT s.id, s.kind, s.content, s.predicted_cost, m.id AS member_id, m.name, m.phone_masked
          FROM strategies s JOIN members m ON m.id = s.member_id
          WHERE s.task_id = ?
        `).all(ctx.taskId) as Record<string, unknown>[];
        return rows.map((r) => ({
          strategyId: r.id, kind: r.kind, memberName: r.name, memberId: r.member_id,
          facts: sourcedFacts(ctx.storeId, r.member_id as string), // 仅带来源事实
        }));
      }
      case "generate_and_send": {
        const body = String(a.body ?? "").slice(0, 300);
        if (body.length < 10) throw new Error("消息太短");
        const r = await queueAndSend(user, ctx.taskId, String(a.strategyId));
        sent.total++;
        if (r.ok) sent.ok++; else sent.failed++;
        return r;
      }
      default:
        throw new Error(`未知工具 ${name}`);
    }
  };
  const res = await runAgentStage({
    ctx, agent: "销售喵", stage: "sell", label: "销售喵·执行触达",
    system: `你是「销售喵」,替美甲师小林给老会员写一对一企微消息并真实发送(演示通道)。
规则:1) 先读取已批准策略清单;2) 对每条策略调用 generate_and_send 发送;
3) 消息只允许引用清单中给出的 facts(它们都带数据来源),绝对禁止编造事实;
4) 口语化、像熟人聊天,120 字以内,带一个 emoji,结尾有轻轻的行动邀请。`,
    userMsg: "请为已批准的策略逐一生成消息并发送。",
    tools: sellerTools(),
    executeTool: execute,
    fallback: async () => {
      const rows = sqlite.prepare(`
        SELECT s.id, s.kind, s.content, m.id AS member_id, m.name
        FROM strategies s JOIN members m ON m.id = s.member_id WHERE s.task_id = ?
      `).all(ctx.taskId) as Record<string, unknown>[];
      for (const r of rows) {
        const body = rulesMessage({ memberName: r.name as string, kind: r.kind as string, content: r.content as string });
        try {
          const out = await queueAndSend(user, ctx.taskId, r.id as string);
          sent.total++;
          if (out.ok) sent.ok++; else sent.failed++;
        } catch (e) {
          sent.total++; sent.failed++;
          await appendLog({
            taskId: ctx.taskId, agent: "销售喵", step: "单条触达异常,跳过继续", status: "error",
            message: String(e instanceof Error ? e.message : e),
          });
        }
      }
      return {
        payload: { salesSummary: sent },
        summary: `共触达 ${sent.total} 人:成功 ${sent.ok},失败 ${sent.failed}${sent.failed ? "(失败原因已在消息中如实标注)" : ""}。`,
      };
    },
  });
  return res;
}

/* ---------- 财务喵 ---------- */
export async function runAccountant(ctx: Ctx) {
  const finance = () => sqlite.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost,
      COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS revenue
    FROM finance_entries WHERE task_id = ?
  `).get(ctx.taskId) as { cost: number; revenue: number };
  const funnel = () => sqlite.prepare(`
    SELECT COUNT(*) AS sent,
      SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN status='replied' AND reply_intent='accept' THEN 1 ELSE 0 END) AS accepted
    FROM outreach_messages WHERE task_id = ? AND status IN ('sent','replied')
  `).get(ctx.taskId) as { sent: number; replied: number; accepted: number };
  const byKindRows = () => sqlite.prepare(`
    SELECT s.kind, COUNT(DISTINCT s.id) AS strategies,
      COUNT(DISTINCT o.id) AS sent,
      SUM(CASE WHEN o.status='replied' THEN 1 ELSE 0 END) AS replied,
      COALESCE(SUM(f.cost),0) AS cost,
      COALESCE(SUM(f.revenue),0) AS revenue
    FROM strategies s
    LEFT JOIN outreach_messages o ON o.strategy_id = s.id
    LEFT JOIN (
      SELECT strategy_id,
        SUM(CASE WHEN type='cost' THEN amount ELSE 0 END) AS cost,
        SUM(CASE WHEN type='revenue' THEN amount ELSE 0 END) AS revenue
      FROM finance_entries GROUP BY strategy_id
    ) f ON f.strategy_id = s.id
    WHERE s.task_id = ? GROUP BY s.kind
  `).all(ctx.taskId);
  const execute = async (name: string) => {
    if (name === "get_task_finance") return { ...finance(), funnel: funnel() };
    if (name === "compare_strategies") return byKindRows();
    throw new Error(`未知工具 ${name}`);
  };
  const res = await runAgentStage({
    ctx, agent: "财务喵", stage: "report", label: "财务喵·经营复盘",
    system: `你是「财务喵」,负责本任务的经营复盘。用工具读取真实财务与漏斗数据,生成复盘报告。
最终以 JSON 结尾:{"cost":0,"revenue":0,"net":0,"funnel":{"sent":0,"replied":0,"accepted":0},"strategyCompare":[{"kind":"..","sent":0,"replied":0,"revenue":0,"cost":0,"roi":".."}],"report":"给老板娘看的 3-5 句人话总结,包含下一个建议"}`
,
    userMsg: "请复盘本任务的经营效果。",
    tools: accountantTools(),
    executeTool: execute,
    fallback: async () => {
      const f = finance(); const fu = funnel(); const byKind = byKindRows();
      const report = `本次任务触达 ${fu.sent} 人,回复 ${fu.replied ?? 0} 人,预约意向 ${fu.accepted ?? 0} 人;总成本 ¥${Math.round(f.cost)},已确认回流消费 ¥${Math.round(f.revenue)},净收益 ¥${Math.round(f.revenue - f.cost)}。建议:对回复"问价"的会员补一张限时小券,对未回复的会员 7 天后换"轻回访"话术再触达一次。`;
      const payload = { cost: f.cost, revenue: f.revenue, net: f.revenue - f.cost, funnel: fu, strategyCompare: byKind, report };
      await updateTask(ctx.taskId, { resultJson: JSON.stringify(payload) });
      return { payload, summary: report };
    },
  });
  if (res.engine === "llm") {
    await updateTask(ctx.taskId, { resultJson: JSON.stringify(res.payload) });
  }
  return res;
}

/* ---------- 喵老板(总控编排) ---------- */
/**
 * 编排流水线是确定性控制(可靠性优先),每个环节内部是真实的 LLM 工具调用。
 * 喵老板的"拆解目标"由 LLM 生成任务标题与计划,失败时用规则模板,全程留痕。
 */
export async function runOrchestrator(user: SessionUserLike, goal: string, emit: Emit) {
  const config = await getLlmConfig(user.storeId);
  const taskId = await createGoalTask(user.storeId, goal);
  const ctx: Ctx = { storeId: user.storeId, taskId, emit, config };

  // 1. 喵老板拆解目标
  emit({ type: "stage", stage: "plan-goal", label: "喵老板·理解目标", status: "start" });
  let title = goal.slice(0, 24);
  let planSummary = `围绕「${goal}」:侦探喵体检会员 → 军师喵定策略 → 你批准后销售喵触达 → 财务喵复盘。`;
  if (config.apiKey && config.engineMode !== "rules") {
    const r = await runToolLoop({
      config, system: "你是「喵老板」,美甲店的 AI 经营总管。把老板的自然语言目标转成 JSON:{\"title\":\"12字内任务名\",\"plan\":\"2 句话执行计划\"}。不要解释,直接输出 JSON。",
      messages: [{ role: "user", content: goal }], tools: [],
      executeTool: () => ({}),
    });
    if (!r.error) {
      try {
        const j = JSON.parse(extractJson(r.text) || "{}");
        if (j.title) title = String(j.title).slice(0, 24);
        if (j.plan) planSummary = String(j.plan);
      } catch { /* 用默认标题 */ }
    }
  }
  const budgetMatch = goal.match(/预算[^0-9]*(\d{2,5})\s*元/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : undefined;
  await updateTask(taskId, {
    title,
    engine: config.engineMode === "rules" || !config.apiKey ? "rules" : "llm",
    payloadJson: JSON.stringify({ goalSummary: planSummary, ...(budget ? { budget } : {}) }),
  });
  if (budget) {
    await appendLog({ taskId, agent: "喵老板", step: "预算约束", message: `解析到营销预算上限 ¥${budget},触达闸门将据此拦截超支` });
  }
  await appendLog({ taskId, agent: "喵老板", step: "理解目标并建任务", message: planSummary });
  emit({ type: "stage", stage: "plan-goal", label: "喵老板·理解目标", status: "ok" });
  emit({ type: "log", agent: "喵老板", step: "执行计划", message: planSummary });

  // 2. 侦探喵
  const det = await runDetective(ctx);
  const analysis = det.payload.analysis ?? det.payload;
  await updateTask(taskId, { payloadJson: JSON.stringify({ analysis, goalSummary: planSummary }) });
  emit({ type: "log", agent: "喵老板", step: "验收", message: det.summary || "侦探喵完成体检" });

  // 3. 军师喵
  const strat = await runStrategist(ctx);
  emit({ type: "log", agent: "喵老板", step: "验收", message: strat.summary || "军师喵完成策略" });

  // 4. 待审批
  await updateTask(taskId, { status: "pending_approval" });
  await appendLog({ taskId, agent: "喵老板", step: "提交审批", message: "计划与成本已就绪,等待商家批准后才会触达任何会员" });
  emit({ type: "done", taskId, title, status: "pending_approval", summary: `任务「${title}」已就绪等待批准:${planSummary}` });
  return { taskId, title };
}

/** 批准后执行:销售喵触达 → 财务喵复盘 → completed */
export async function executeApprovedTask(user: SessionUserLike, taskId: string, emit: Emit) {
  const config = await getLlmConfig(user.storeId);
  const ctx: Ctx = { storeId: user.storeId, taskId, emit, config };
  const t = await getTask(taskId);
  if (!t) throw new Error("任务不存在");
  if (t.status !== "approved") throw new Error(`任务状态为 ${t.status},需先批准`);
  await runSeller(ctx, user);
  await runAccountant(ctx);
  await updateTask(taskId, { status: "completed" });
  emit({ type: "done", taskId, title: t.title, status: "completed", summary: "触达完成,复盘报告已生成" });
}
