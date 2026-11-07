import { eq } from "drizzle-orm";
import { db, sqlite } from "../db/client";
import {
  cats, energyTransactions, catEnergyLogs, catBondLogs,
} from "../db/schema";
import { randomUUID } from "node:crypto";

/* ============================================================
   闺蜜猫引擎:领养 / 能量 / 亲密度 / 生命周期
   规则:所有能量变化写入 energy_transactions(dedupe_key 防刷);
   每日获取上限 30;衰减由调度器执行;能量归零休眠,免费唤醒。
   消费不直接决定亲密度。
   ============================================================ */

export type CatStage = "active" | "resting" | "sleeping" | "dormant";

export interface CatView {
  id: string; storeId: string; memberId: string;
  name: string; personality: string; colorway: string;
  energy: number; bond: number; level: number; stage: CatStage;
  decorations: string[]; adoptedAt: string; lastActiveAt: string;
  energyToday: number; artStyle: string; // 今日已获得能量(含上限判断)
}

const rid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

export const ENERGY_RULES: Record<string, { delta: number; label: string }> = {
  daily_first_chat: { delta: 2, label: "每日首次聊天" },
  effective_interaction: { delta: 2, label: "有效互动" },
  share_style: { delta: 3, label: "分享喜欢的款式" },
  favorite_inspiration: { delta: 2, label: "收藏灵感" },
  appointment_done: { delta: 5, label: "完成预约" },
  order_consumed: { delta: 20, label: "完成真实消费" },
};
const DAILY_GAIN_CAP = 30;
const BOND_RULES: Record<string, number> = {
  daily_first_chat: 1, effective_chat: 1, share_style: 2, memory_correction: 2,
  favorite_inspiration: 1, appointment_done: 2,
};

export function getCatByMember(storeId: string, memberId: string) {
  return sqlite.prepare(
    "SELECT * FROM cats WHERE store_id = ? AND member_id = ?"
  ).get(storeId, memberId) as CatRow | undefined ?? null;
}
type CatRow = typeof cats.$inferSelect;

export function energyToday(catId: string): number {
  return (sqlite.prepare(
    "SELECT COALESCE(SUM(delta),0) as s FROM energy_transactions WHERE cat_id = ? AND delta > 0 AND reversed = 0 AND created_at >= ?"
  ).get(catId, today() + "T00:00:00") as { s: number }).s;
}

function recomputeStage(energy: number, lastActiveAt: string): CatStage {
  if (energy <= 0) return "dormant";
  if (energy < 20) return "sleeping";
  const idleDays = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 86400_000);
  if (idleDays >= 3) return "resting";
  return "active";
}

function syncCat(catId: string) {
  const c = sqlite.prepare("SELECT * FROM cats WHERE id = ?").get(catId) as CatRow | undefined;
  if (!c) return;
  const stage = recomputeStage(c.energy, c.lastActiveAt);
  const level = Math.max(1, Math.min(9, 1 + Math.floor(c.bond / 15)));
  db.update(cats).set({ energy: c.energy, stage, level, updatedAt: nowIso() })
    .where(eq(cats.id, catId)).run();
}

/** 领养:绑定会员后自动拥有闺蜜猫(每店每用户一只) */
export function adoptCat(storeId: string, memberId: string, name?: string) {
  const existing = getCatByMember(storeId, memberId);
  if (existing) return existing;
  const colorways = ["orange", "gray", "calico", "cow", "ragdoll", "purple"];
  const cat = {
    id: rid("cat"), storeId, memberId, artStyle: "A" as const,
    name: name?.trim() || "糯米",
    personality: "温柔体贴,记得住你说过的话",
    colorway: colorways[Math.floor(Math.random() * colorways.length)],
    energy: 60, bond: 10, level: 1, stage: "active" as CatStage,
    decorationsJson: "[]", lastActiveAt: nowIso(), adoptedAt: nowIso(), updatedAt: nowIso(),
  };
  db.insert(cats).values(cat).run();
  return cat;
}

/** 客户自选猫造型(A-E) */
export function setCatStyle(storeId: string, memberId: string, style: string): string {
  sqlite.prepare("UPDATE cats SET art_style = ?, updated_at = ? WHERE store_id = ? AND member_id = ?")
    .run(style, nowIso(), storeId, memberId);
  return style;
}

export function getCatStyle(storeId: string, memberId: string): string {
  const c = sqlite.prepare("SELECT art_style FROM cats WHERE store_id = ? AND member_id = ?")
    .get(storeId, memberId) as { art_style: string } | undefined;
  return c?.art_style ?? "A";
}

/** 能量奖励:L3 级操作——dedupe 防刷 + 每日上限 + 交易留痕 + 退款回滚 */
export function awardEnergy(opts: {
  catId: string; userId: string; action: keyof typeof ENERGY_RULES | string;
  relatedType?: string; relatedId?: string; dedupeKey?: string; source?: string;
}): { ok: boolean; delta: number; reason?: string } {
  const rule = ENERGY_RULES[opts.action] ?? { delta: 0, label: opts.action };
  if (rule.delta <= 0) return { ok: false, delta: 0, reason: "未知能量行为" };
  const dedupeKey = opts.dedupeKey ?? `${opts.action}:${opts.catId}:${opts.relatedId ?? today()}`;
  const dup = sqlite.prepare(
    "SELECT id, reversed FROM energy_transactions WHERE dedupe_key = ?"
  ).get(dedupeKey) as { id: string; reversed: number } | undefined;
  if (dup) {
    if (dup.reversed) return { ok: false, delta: 0, reason: "该事件已被回滚" };
    return { ok: false, delta: 0, reason: "重复事件,防刷拦截" };
  }
  if (energyToday(opts.catId) >= DAILY_GAIN_CAP) {
    return { ok: false, delta: 0, reason: `今日能量已达上限(${DAILY_GAIN_CAP}),明天再陪它玩吧` };
  }
  const delta = Math.min(rule.delta, DAILY_GAIN_CAP - energyToday(opts.catId));
  db.insert(energyTransactions).values({
    id: rid("et"), catId: opts.catId, userId: opts.userId,
    action: opts.action, source: opts.source ?? "system", delta,
    relatedType: opts.relatedType ?? null, relatedId: opts.relatedId ?? null,
    dedupeKey, reversed: 0, createdAt: nowIso(),
  }).run();
  const c = sqlite.prepare("SELECT * FROM cats WHERE id = ?").get(opts.catId) as CatRow | undefined;
  if (!c) return { ok: false, delta: 0, reason: "猫咪不存在" };
  db.update(cats).set({
    energy: Math.min(100, c.energy + delta),
    lastActiveAt: nowIso(), updatedAt: nowIso(),
  }).where(eq(cats.id, opts.catId)).run();
  syncCat(opts.catId);
  return { ok: true, delta };
}

/** 订单退款 → 回滚对应能量(按 dedupe_key) */
export function reverseEnergy(dedupeKey: string, reason: string) {
  const tx = sqlite.prepare(
    "SELECT id, delta, reversed FROM energy_transactions WHERE dedupe_key = ?"
  ).get(dedupeKey) as { id: string; delta: number; reversed: number } | undefined;
  if (!tx || tx.reversed) return { ok: false };
  db.update(energyTransactions).set({ reversed: 1 }).where(eq(energyTransactions.id, tx.id)).run();
  const catId = (sqlite.prepare("SELECT cat_id FROM energy_transactions WHERE id = ?").get(tx.id) as { cat_id: string }).cat_id;
  const c = sqlite.prepare("SELECT * FROM cats WHERE id = ?").get(catId) as CatRow | undefined;
  if (c) {
    db.update(cats).set({ energy: Math.max(0, c.energy - tx.delta), updatedAt: nowIso() })
      .where(eq(cats.id, c.id)).run();
    syncCat(c.id);
  }
  void reason;
  return { ok: true };
}

/** 亲密度:来自互动/分享/纠正,不来自消费。
 *  防刷三件套:每类事件独立 dedupeKey + 聊天类每日上限 + 全部变化写 cat_bond_logs。 */
export const BOND_DAILY_CHAT_CAP = 3; // daily_first_chat + effective_chat 合计每日上限

export function awardBond(opts: {
  catId: string; userId: string; action: keyof typeof BOND_RULES | string;
  reason: string; dedupeKey?: string;
}): { ok: boolean; delta: number; reason?: string } {
  const delta = BOND_RULES[opts.action] ?? 0;
  if (delta <= 0) return { ok: false, delta: 0, reason: "未知亲密度行为" };
  // 事件级 dedupe:同事件永不重复计分
  const dedupeKey = opts.dedupeKey ?? `${opts.action}:${opts.catId}:${today()}`;
  const dup = sqlite.prepare(
    "SELECT id FROM cat_bond_logs WHERE dedupe_key = ?"
  ).get(dedupeKey) as { id: string } | undefined;
  if (dup) return { ok: false, delta: 0, reason: "重复事件,防刷拦截" };
  // 聊天类每日上限(daily_first_chat + effective_chat 合并计算)
  if (opts.action === "daily_first_chat" || opts.action === "effective_chat") {
    const chatToday = sqlite.prepare(`
      SELECT COALESCE(SUM(delta),0) AS s FROM cat_bond_logs
      WHERE cat_id = ? AND action IN ('daily_first_chat','effective_chat')
        AND created_at >= ?
    `).get(opts.catId, today() + "T00:00:00") as { s: number };
    if (chatToday.s >= BOND_DAILY_CHAT_CAP) {
      return { ok: false, delta: 0, reason: `今日聊天亲密度已达上限(${BOND_DAILY_CHAT_CAP})` };
    }
  }
  const c = sqlite.prepare("SELECT * FROM cats WHERE id = ?").get(opts.catId) as CatRow | undefined;
  if (!c) return { ok: false, delta: 0, reason: "猫咪不存在" };
  const applied = Math.min(delta, Math.max(0, 100 - c.bond));
  if (applied <= 0) return { ok: false, delta: 0, reason: "亲密度已满" };
  db.insert(catBondLogs).values({
    id: rid("cb"), catId: opts.catId, userId: opts.userId,
    delta: applied, reason: opts.reason,
    action: opts.action, dedupeKey, createdAt: nowIso(),
  }).run();
  db.update(cats).set({
    bond: Math.min(100, c.bond + applied), updatedAt: nowIso(),
  }).where(eq(cats.id, opts.catId)).run();
  syncCat(opts.catId);
  return { ok: true, delta: applied };
}

/** 每日衰减(调度器调用):普通 -1;进入休息状态 -2;能量不会因衰减低于 0 */
export function applyDailyDecay(catId: string, day = today()): { applied: boolean; delta: number } {
  const exists = sqlite.prepare(
    "SELECT 1 FROM cat_energy_logs WHERE cat_id = ? AND date = ?"
  ).get(catId, day);
  if (exists) return { applied: false, delta: 0 };
  const c = sqlite.prepare("SELECT * FROM cats WHERE id = ?").get(catId) as CatRow | undefined;
  if (!c) return { applied: false, delta: 0 };
  const idleDays = Math.floor((Date.now() - new Date(c.lastActiveAt).getTime()) / 86400_000);
  const delta = -(idleDays >= 3 ? 2 : 1);
  const energy = Math.max(0, c.energy + delta);
  db.insert(catEnergyLogs).values({
    id: rid("cel"), catId, date: day, delta, reason: `每日衰减(闲置 ${idleDays} 天)`, createdAt: nowIso(),
  }).run();
  db.update(cats).set({ energy, updatedAt: nowIso() }).where(eq(cats.id, catId)).run();
  syncCat(catId);
  return { applied: true, delta };
}

/** 免费唤醒:能量归零的猫可以被免费唤醒到 25 点 */
export function wakeUp(catId: string, userId: string) {
  const c = sqlite.prepare("SELECT * FROM cats WHERE id = ?").get(catId) as CatRow | undefined;
  if (!c) throw new Error("猫咪不存在");
  if (c.stage !== "dormant" && c.energy > 20) return { ok: false, reason: "猫咪不需要唤醒" };
  const grant = Math.max(25 - c.energy, 0);
  const dedupeKey = `free_wake:${catId}:${today()}`;
  const woken = sqlite.prepare(
    "SELECT id FROM energy_transactions WHERE dedupe_key = ?"
  ).get(dedupeKey);
  if (grant > 0 && !woken) {
    db.insert(energyTransactions).values({
      id: rid("et"), catId, userId, action: "free_wake", source: "owner",
      delta: grant, dedupeKey, reversed: 0, createdAt: nowIso(),
    }).run();
  }
  db.update(cats).set({
    energy: Math.max(c.energy, 25), stage: "active",
    lastActiveAt: nowIso(), updatedAt: nowIso(),
  }).where(eq(cats.id, catId)).run();
  void userId;
  return { ok: true };
}

/** 触摸:更新活跃时间 */
export function touchCat(catId: string) {
  db.update(cats).set({ lastActiveAt: nowIso(), updatedAt: nowIso() })
    .where(eq(cats.id, catId)).run();
}

/** 全店猫咪每日衰减(调度器) */
export function decayAllCats(storeId: string): number {
  const rows = sqlite.prepare("SELECT id FROM cats WHERE store_id = ?").all(storeId) as { id: string }[];
  let n = 0;
  for (const r of rows) {
    const res = applyDailyDecay(r.id);
    if (res.applied) n++;
  }
  return n;
}

export function catView(cat: typeof cats.$inferSelect): CatView {
  return {
    id: cat.id, storeId: cat.storeId, memberId: cat.memberId,
    name: cat.name, personality: cat.personality, colorway: cat.colorway,
    artStyle: (cat as { art_style?: string }).art_style ?? (cat as { artStyle?: string }).artStyle ?? "A",
    energy: cat.energy, bond: cat.bond, level: cat.level,
    stage: cat.stage as CatStage,
    decorations: JSON.parse(cat.decorationsJson || "[]"),
    adoptedAt: cat.adoptedAt, lastActiveAt: cat.lastActiveAt,
    energyToday: energyToday(cat.id),
  };
}
