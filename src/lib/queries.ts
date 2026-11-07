import { db, sqlite } from "./db/client";
import { members, memberCats, tasks } from "./db/schema";
import { eq, desc } from "drizzle-orm";

export type CatState = "active" | "drowsy" | "hibernate" | "sick";

export type MemberRow = {
  id: string; name: string; phoneMasked: string; level: string;
  tags: string[]; joinedAt: string; isDemo: number;
  daysSinceVisit: number | null; lastVisitDays?: number | null;
  totalSpend: number; visits: number;
  lastService: string | null; state: CatState; zone: string;
  spend: number; catName: string; catColorway: string;
  catLv: number; catXp: number; decorations: string[];
};

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400_000);
}

/** 猫状态 = 会员关系的可视化 */
export function catStateOf(daysSinceVisit: number | null, tags: string[]): CatState {
  if (tags.includes("卡快过期")) return "sick";
  if (daysSinceVisit == null) return "hibernate";
  if (daysSinceVisit <= 30) return "active";
  if (daysSinceVisit <= 75) return "drowsy";
  return "hibernate";
}

type RawRow = Record<string, unknown>;
function all(sql: string, ...params: unknown[]): RawRow[] {
  return sqlite.prepare(sql).all(...params) as RawRow[];
}
function get(sql: string, ...params: unknown[]): RawRow | undefined {
  return sqlite.prepare(sql).get(...params) as RawRow | undefined;
}

export async function listMembers(
  storeId: string,
  filter: "all" | "active" | "drowsy" | "hibernate" | "sick" | "high_value" = "all"
): Promise<MemberRow[]> {
  const rows = all(`
    SELECT m.*, c.name AS cat_name, c.colorway, c.lv, c.xp, c.decorations_json,
      (SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id = m.id) AS last_visit,
      (SELECT COALESCE(SUM(amount),0) FROM consumption_records r WHERE r.member_id = m.id) AS total_spend,
      (SELECT COUNT(*) FROM consumption_records r WHERE r.member_id = m.id) AS visits,
      (SELECT service FROM consumption_records r WHERE r.member_id = m.id ORDER BY occurred_at DESC LIMIT 1) AS last_service
    FROM members m LEFT JOIN member_cats c ON c.member_id = m.id
    WHERE m.store_id = ? ORDER BY last_visit IS NOT NULL, last_visit ASC
  `, storeId);
  const mapped: MemberRow[] = rows.map((r) => {
    const tags = JSON.parse((r.tags_json as string) || "[]");
    const days = daysSince(r.last_visit as string | null);
    const state = catStateOf(days, tags);
    const spend = (r.total_spend as number) || 0;
    // 生态街区归属:庄园(高消费) > 警戒(卡临期) > 森林(沉睡) > 街区(活跃)
    const zone = spend >= 800 ? "premium"
      : tags.includes("卡快过期") ? "risk"
      : state === "hibernate" ? "sleeping"
      : state === "drowsy" ? "sleeping"
      : "active";
    return {
      id: r.id as string, name: r.name as string, phoneMasked: r.phone_masked as string,
      level: r.level as string, tags,
      joinedAt: r.joined_at as string, isDemo: r.is_demo as number,
      daysSinceVisit: days,
      lastVisitDays: days, // 前端 MemberCatView 的字段名(缺了会 undefined→NaN→整页崩)
      totalSpend: spend,
      spend: spend,
      visits: (r.visits as number) || 0,
      lastService: (r.last_service as string) || null,
      favoriteService: (r.last_service as string) || "暂无",
      state,
      zone: zone as MemberRow["zone"],
      risk: (tags.includes("卡快过期") ? "high" : state === "hibernate" ? "high" : state === "drowsy" ? "mid" : "low") as "high"|"mid"|"low",
      strategyHint: tags.includes("卡快过期")
        ? "卡即将到期,权益未消耗完——优先挽回"
        : state === "hibernate" ? `已 ${(days??0)} 天未到店,建议组合拳唤回`
        : state === "drowsy" ? "瞌睡期,用新色板和轻内容唤回"
        : "状态健康,维持关怀节奏",
      colorway: (r.colorway as string) || "orange",
      personality: "",
      energy: 0,
      bond: 0,
      catName: (r.cat_name as string) || "未命名",
      catColorway: (r.colorway as string) || "orange",
      catLv: (r.lv as number) || 1,
      catXp: (r.xp as number) || 0,
      decorations: JSON.parse((r.decorations_json as string) || "[]"),
    };
  });
  switch (filter) {
    case "active": return mapped.filter((m) => m.state === "active");
    case "drowsy": return mapped.filter((m) => m.state === "drowsy");
    case "hibernate": return mapped.filter((m) => m.state === "hibernate");
    case "sick": return mapped.filter((m) => m.state === "sick");
    case "high_value": return mapped.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 15);
    default: return mapped;
  }
}

export async function getMemberDetail(storeId: string, memberId: string) {
  const mem = (await db.select().from(members).where(eq(members.id, memberId)).limit(1))[0];
  if (!mem || mem.storeId !== storeId) return null;
  const records = all(
    `SELECT * FROM consumption_records WHERE member_id = ? ORDER BY occurred_at DESC`, memberId);
  const memories = all(
    `SELECT * FROM member_memories WHERE member_id = ? ORDER BY created_at DESC`, memberId);
  const outreach = all(
    `SELECT o.*, t.title AS task_title FROM outreach_messages o
     LEFT JOIN tasks t ON t.id = o.task_id WHERE o.member_id = ? ORDER BY o.created_at DESC`, memberId);
  const cat = (await db.select().from(memberCats).where(eq(memberCats.memberId, memberId)).limit(1))[0];
  const appts = all(
    `SELECT * FROM appointments WHERE member_id = ? ORDER BY created_at DESC`, memberId);
  const lastVisit = records[0]?.occurred_at as string | undefined;
  const tags = JSON.parse(mem.tagsJson || "[]");
  return {
    member: mem, records, memories, outreach, appts,
    cat: cat ?? null,
    state: catStateOf(daysSince(lastVisit ?? null), tags),
    daysSinceVisit: daysSince(lastVisit ?? null),
    totalSpend: records.reduce((s, r) => s + (r.amount as number), 0),
  };
}

export async function getOverview(storeId: string) {
  const mems = await listMembers(storeId, "all");
  const count = (s: CatState) => mems.filter((m) => m.state === s).length;
  const taskRows = await db.select().from(tasks).where(eq(tasks.storeId, storeId)).orderBy(desc(tasks.createdAt));
  const fin = get(`
    SELECT
      COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost,
      COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS revenue
    FROM finance_entries WHERE store_id = ?
  `, storeId) as { cost: number; revenue: number };
  const pending = taskRows.filter((t) => t.status === "pending_approval").length;
  const sleepingBalance = mems
    .filter((m) => m.state === "hibernate" || m.state === "sick")
    .reduce((s, m) => s + m.totalSpend * 0.15, 0); // 粗估沉睡会员的潜在月流失贡献
  return {
    total: mems.length,
    active: count("active"), drowsy: count("drowsy"),
    hibernate: count("hibernate"), sick: count("sick"),
    pendingApproval: pending,
    running: taskRows.filter((t) => t.status === "running").length,
    totalTasks: taskRows.length,
    monthCost: fin.cost, monthRevenue: fin.revenue,
    recentTasks: taskRows.slice(0, 5),
    sleepingContributionEstimate: Math.round(sleepingBalance),
  };
}

export async function listTasks(storeId: string) {
  const rows = all(`
    SELECT t.*,
      (SELECT COUNT(*) FROM strategies s WHERE s.task_id = t.id) AS strategy_count,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.task_id = t.id AND o.status='sent') AS sent_count,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.task_id = t.id AND o.status='failed') AS failed_count,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.task_id = t.id AND o.status='replied') AS replied_count
    FROM tasks t WHERE t.store_id = ? ORDER BY t.created_at DESC
  `, storeId);
  return rows;
}

export async function getTaskDetail(storeId: string, taskId: string) {
  const t = (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
  if (!t || t.storeId !== storeId) return null;
  const logs = all(
    `SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at ASC, rowid ASC`, taskId);
  const strategies = all(`
    SELECT s.*, m.name AS member_name, m.level AS member_level
    FROM strategies s LEFT JOIN members m ON m.id = s.member_id
    WHERE s.task_id = ? ORDER BY s.predicted_uplift DESC
  `, taskId);
  const messages = all(`
    SELECT o.*, m.name AS member_name, m.phone_masked
    FROM outreach_messages o LEFT JOIN members m ON m.id = o.member_id
    WHERE o.task_id = ? ORDER BY o.created_at ASC
  `, taskId);
  const payload = JSON.parse(t.payloadJson || "{}");
  const result = JSON.parse(t.resultJson || "{}");
  return { task: t, logs, strategies, messages, payload, result };
}

export async function getReports(storeId: string) {
  const funnel = get(`
    SELECT
      COUNT(*) AS sent,
      SUM(CASE WHEN o.status='replied' THEN 1 ELSE 0 END) AS replied,
      SUM(CASE WHEN o.status='replied' AND o.reply_intent='accept' THEN 1 ELSE 0 END) AS accepted
    FROM outreach_messages o
    JOIN tasks t ON t.id = o.task_id
    WHERE t.store_id = ? AND o.status IN ('sent','replied')
  `, storeId) as { sent: number; replied: number; accepted: number };
  const visited = get(`
    SELECT COUNT(DISTINCT a.member_id) AS c
    FROM appointments a JOIN tasks t ON t.id = a.task_id
    WHERE t.store_id = ? AND a.status='visited'
  `, storeId) as { c: number };
  const fin = get(`
    SELECT
      COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost,
      COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS revenue
    FROM finance_entries WHERE store_id = ?
  `, storeId) as { cost: number; revenue: number };
  const byKind = all(`
    SELECT s.kind,
      COUNT(DISTINCT s.id) AS strategies,
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
    JOIN tasks t ON t.id = s.task_id
    WHERE t.store_id = ?
    GROUP BY s.kind
  `, storeId);
  const taskList = all(`
    SELECT t.id, t.title, t.status, t.engine, t.created_at, t.cost_estimate,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.task_id=t.id AND o.status IN ('sent','replied')) AS sent,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.task_id=t.id AND o.status='replied') AS replied,
      COALESCE((SELECT SUM(amount) FROM finance_entries f WHERE f.task_id=t.id AND f.type='revenue'),0) AS revenue,
      COALESCE((SELECT SUM(amount) FROM finance_entries f WHERE f.task_id=t.id AND f.type='cost'),0) AS cost
    FROM tasks t WHERE t.store_id = ? ORDER BY t.created_at DESC
  `, storeId);
  return { funnel, visited: visited.c, cost: fin.cost, revenue: fin.revenue, byKind, taskList };
}

export async function listCats(storeId: string) {
  const mems = await listMembers(storeId, "all");
  return mems;
}

export async function getLlmStatus(storeId: string) {
  const { getLlmConfig } = await import("./llm");
  const c = await getLlmConfig(storeId);
  return {
    engineMode: c.engineMode, model: c.model,
    hasKey: !!c.apiKey, provider: c.provider, mockFailRate: c.mockFailRate,
    keyMasked: c.apiKey ? c.apiKey.slice(0, 6) + "****" : null,
  };
}

/* ============================================================
   真实数据视图(阶段①:UI 从 mock 切换到真库)
   ============================================================ */

export interface RealDashboard {
  greeting: string;
  dateLabel: string;
  goal: string;
  goalIsDemo: true;
  kpis: {
    totalMembers: number; activeMembers: number; sleepingMembers: number;
    premiumMembers: number; highRiskMembers: number;
    awakenedThisMonth: number; monthCost: number; monthRevenue: number;
  };
  logs: { id: string; time: string; employeeId: string; text: string }[];
  briefing: string;
}

const AGENT_ID: Record<string, string> = {
  "喵老板": "boss", "侦探喵": "detective", "军师喵": "strategist",
  "销售喵": "seller", "财务喵": "accountant",
};

export async function getRealDashboard(storeId: string): Promise<RealDashboard> {
  const mems = await listMembers(storeId, "all");
  const count = (s: string) => mems.filter((m) => m.state === s).length;
  const premium = mems.filter((m) => m.totalSpend >= 800).length;
  const rows = all(`
    SELECT l.*, t.title FROM task_logs l JOIN tasks t ON t.id = l.task_id
    WHERE t.store_id = ? ORDER BY l.created_at DESC LIMIT 8
  `, storeId);
  // 本月起点(本地时区月初,转为与库内一致的 UTC ISO 字符串)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const fin = get(`
    SELECT
      COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost,
      COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS revenue
    FROM finance_entries WHERE store_id = ? AND occurred_at >= ?
  `, storeId, monthStart) as { cost: number; revenue: number };
  const awakened = get(`
    SELECT COUNT(DISTINCT member_id) AS c FROM appointments
    WHERE store_id = ? AND status = 'visited' AND created_at >= ?
  `, storeId, monthStart) as { c: number };
  const lastReport = get(`
    SELECT result_json, title, status FROM tasks
    WHERE store_id = ? AND status='completed' ORDER BY updated_at DESC LIMIT 1
  `, storeId) as { result_json: string; title: string; status: string } | undefined;

  const active = count("active"), drowsy = count("drowsy"),
    hib = count("hibernate"), sick = count("sick");
  let briefing = `目前会员生态:活跃 ${active}、沉睡 ${drowsy + hib}、临期卡 ${sick}。`;
  if (lastReport) {
    try {
      const r = JSON.parse(lastReport.result_json);
      if (typeof r.net === "number") {
        briefing += `最近一次任务「${lastReport.title}」净收益 ¥${Math.round(r.net)}。`;
      }
    } catch { /* 忽略解析失败 */ }
  }
  briefing += ` ${mems.filter((m) => m.state !== "active").length} 只猫在等一次唤醒。`;

  return {
    greeting: "早上好,老板。今天你的 AI 团队已经准备好开始工作。",
    dateLabel: new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" }),
    goal: "把超过 60 天没到店的高价值会员请回来,本周多约 3 单",
    goalIsDemo: true,
    kpis: {
      totalMembers: mems.length,
      activeMembers: active,
      sleepingMembers: drowsy + hib,
      premiumMembers: premium,
      // 各状态互斥:活跃 + 沉睡 + 临期卡 = 会员总数
      highRiskMembers: sick,
      awakenedThisMonth: awakened.c,
      monthCost: Math.round(fin.cost),
      monthRevenue: Math.round(fin.revenue),
    },
    logs: rows.map((r) => ({
      id: r.id as string,
      time: String(r.created_at).slice(11, 16),
      employeeId: AGENT_ID[r.agent as string] ?? "boss",
      text: String(r.message ?? r.step).slice(0, 80),
    })),
    briefing,
  };
}

/* 真任务 → 任务大厅视图 */
export async function getRealTaskViews(storeId: string) {
  const tasks = await listTasks(storeId);
  return tasks.map((t) => {
    const status = t.status as string;
    const progress = status === "completed" ? 100 : status === "running" ? 85
      : status === "approved" ? 70 : status === "pending_approval" ? 60
      : status === "paused" ? 30 : 0;
    const doneBy = {
      draft: 0, pending_approval: 2, approved: 2, rejected: 2,
      running: 3, completed: 5, failed: 3,
    }[status] ?? 0;
    const stepNames = ["侦探喵体检", "军师喵定策略", "商家审批", "销售喵触达", "财务喵复盘"];
    return {
      id: t.id as string,
      name: t.title as string,
      kind: "会员唤醒",
      ownerId: "boss",
      memberNames: [] as string[],
      targetCount: (t.strategy_count as number) || 0,
      cost: Math.round((t.cost_estimate as number) || 0),
      expectedRevenue: 0,
      risk: "mid" as const,
      status: status as import("../mock-data/types").TaskStatus,
      progress,
      steps: stepNames.map((name, i) => ({ name, done: i < doneBy })),
      createdAt: String(t.created_at),
      engineNote: `引擎:${t.engine === "llm" ? "GLM 大模型" : "内置规则引擎"} · 触达 ${t.sent_count} · 回复 ${t.replied_count}`,
    };
  });
}

/* 真会员记忆 → 博物馆条目 */
export async function getRealMemories(storeId: string, memberId?: string): Promise<
  { id: string; memberId: string; type: string; content: string; source: string; recordedAt: string }[]
> {
  const rows = all(`
    SELECT mm.*, m.name AS member_name FROM member_memories mm
    JOIN members m ON m.id = mm.member_id
    WHERE m.store_id = ? ${memberId ? "AND mm.member_id = ?" : ""}
    ORDER BY mm.created_at DESC LIMIT 200
  `, ...(memberId ? [storeId, memberId] : [storeId]));
  const kindMap: Record<string, string> = {
    preference: "服务偏好", fact: "消费记忆", event: "特殊事件", feedback: "会员反馈",
  };
  const srcMap: Record<string, string> = {
    order: "消费流水", manual: "老板娘口述", chat: "沟通记录", agent_inferred: "AI 推断",
  };
  return rows.map((r) => ({
    id: r.id as string,
    memberId: r.member_id as string,
    type: kindMap[r.kind as string] ?? (r.kind as string),
    content: r.content as string,
    source: `${srcMap[r.source_type as string] ?? r.source_type} · ${String(r.source_ref).split(":").pop()}`,
    recordedAt: String(r.recordedAt ?? r.created_at ?? "").slice(0, 10),
  }));
}
