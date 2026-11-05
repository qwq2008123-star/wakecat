import { db, sqlite } from "./db/client";
import { members, memberCats, tasks } from "./db/schema";
import { eq, desc } from "drizzle-orm";

export type CatState = "active" | "drowsy" | "hibernate" | "sick";

export type MemberRow = {
  id: string; name: string; phoneMasked: string; level: string;
  tags: string[]; joinedAt: string; isDemo: number;
  daysSinceVisit: number | null; totalSpend: number; visits: number;
  lastService: string | null; state: CatState; catName: string; catColorway: string;
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
    return {
      id: r.id as string, name: r.name as string, phoneMasked: r.phone_masked as string,
      level: r.level as string, tags,
      joinedAt: r.joined_at as string, isDemo: r.is_demo as number,
      daysSinceVisit: daysSince(r.last_visit as string | null),
      totalSpend: (r.total_spend as number) || 0,
      visits: (r.visits as number) || 0,
      lastService: (r.last_service as string) || null,
      state: catStateOf(daysSince(r.last_visit as string | null), tags),
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
