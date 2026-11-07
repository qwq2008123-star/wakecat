import { randomUUID } from "node:crypto";
import { sqlite } from "../db/client";
import {
  contactDecisions, customerPreferences,
} from "../db/schema";

/* ============================================================
   WAKECAT 2.0 · Contact Intelligence Engine(主动联系决策引擎)
   核心转变:不是"任务一来就发",而是
   记忆 → 需求识别 → 价值评分 → 授权闸门 → 时机判断 → 联系或沉默。
   stay_silent 是一等决策,不是失败。
   纯可解释规则评分(无 ML 冒充);所有分数 0-1;
   V = relevance × usefulness × timing × consent,授权为 0 时直接硬禁止。
   每次决策写 contact_decisions,可审计。
   ============================================================ */

type Row = Record<string, unknown>;
const rid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

export type ContactCategory = "commercial" | "appointment_reminder";
export type ContactDecision = "contact" | "stay_silent" | "needs_review";

export interface ContactDecisionResult {
  decision: ContactDecision;
  decisionId: string;
  need: {
    has_need: boolean; need_type: string; evidence: string[];
    confidence: number; reason: string;
    recommended_action: "consider_contact" | "stay_silent";
  };
  scores: { relevance: number; usefulness: number; timing: number; consent: number; total: number };
  consent_status: string;
  reason: string;               // 人话:为什么联系/为什么沉默
  service_name: string | null;  // 新品匹配命中的真实服务(可能为 null)
}

/* ---------- 客户联系偏好(无则建默认:无商业授权) ---------- */
export interface Prefs {
  allowCommercial: boolean; allowAppointmentReminder: boolean;
  allowNewItems: boolean; allowPromotions: boolean;
  weeklyCap: number; quietStart: string; quietEnd: string;
  rejectedCategories: string[];
}

export function getOrCreatePrefs(storeId: string, memberId: string): Prefs {
  const row = sqlite.prepare(
    "SELECT * FROM customer_preferences WHERE store_id = ? AND member_id = ?"
  ).get(storeId, memberId) as Record<string, unknown> | undefined;
  if (row) {
    return {
      allowCommercial: !!row.allow_commercial,
      allowAppointmentReminder: !!row.allow_appointment_reminder,
      allowNewItems: !!row.allow_new_items,
      allowPromotions: !!row.allow_promotions,
      weeklyCap: Number(row.weekly_cap) || 0,
      quietStart: String(row.quiet_start || "22:00"),
      quietEnd: String(row.quiet_end || "09:00"),
      rejectedCategories: JSON.parse(String(row.rejected_categories_json || "[]")),
    };
  }
  // 默认:未授权任何商业触达(沉默是默认,同意是例外)
  sqlite.prepare(`
    INSERT INTO customer_preferences (id, store_id, member_id, updated_at)
    VALUES (?,?,?,?)
  `).run(rid("cp"), storeId, memberId, nowIso());
  return {
    allowCommercial: false, allowAppointmentReminder: true,
    allowNewItems: false, allowPromotions: false,
    weeklyCap: 1, quietStart: "22:00", quietEnd: "09:00", rejectedCategories: [],
  };
}

export function updatePrefs(storeId: string, memberId: string, patch: Partial<Prefs>) {
  getOrCreatePrefs(storeId, memberId); // 确保行存在
  const cur = getOrCreatePrefs(storeId, memberId);
  const next = { ...cur, ...patch };
  sqlite.prepare(`
    UPDATE customer_preferences SET allow_commercial=?, allow_appointment_reminder=?,
      allow_new_items=?, allow_promotions=?, weekly_cap=?, quiet_start=?, quiet_end=?,
      rejected_categories_json=?, updated_at=?
    WHERE store_id = ? AND member_id = ?
  `).run(
    next.allowCommercial ? 1 : 0, next.allowAppointmentReminder ? 1 : 0,
    next.allowNewItems ? 1 : 0, next.allowPromotions ? 1 : 0,
    Math.max(0, Math.min(7, next.weeklyCap)), next.quietStart, next.quietEnd,
    JSON.stringify(next.rejectedCategories), nowIso(), storeId, memberId,
  );
  return next;
}

/* ---------- 信号读取(全部来自真实数据,带证据) ---------- */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
}

function latestOrder(storeId: string, memberId: string): { service: string; occurred_at: string } | null {
  return (sqlite.prepare(`
    SELECT service, occurred_at FROM consumption_records
    WHERE member_id = ? ORDER BY occurred_at DESC LIMIT 1
  `).get(memberId) as { service: string; occurred_at: string } | undefined) ?? null;
}

/** 表达过预约/想做意图的有效记忆(90 天内才算有效) */
function expressedIntent(storeId: string, memberId: string): { value: string; updated_at: string } | null {
  const rows = sqlite.prepare(`
    SELECT value, updated_at FROM user_memories
    WHERE user_id = ? AND status = 'active'
      AND (value LIKE '%预约%' OR value LIKE '%想做%' OR value LIKE '%下次想%' OR value LIKE '%下个月%' OR attribute LIKE '%想尝试%')
    ORDER BY updated_at DESC LIMIT 3
  `).all(memberId) as Array<{ value: string; updated_at: string }>;
  return rows.find((r) => (daysSince(r.updated_at) ?? 999) <= 90) ?? null;
}

/** 客户收藏(灵感)与店内新品的方向匹配:复用词桥思路,不做字符串硬包含 */
function favoriteMatchNewService(storeId: string, memberId: string): { service: string; serviceId: string; price: number; evidence: string } | null {
  const favs = sqlite.prepare(`
    SELECT id, title, style_tags_json FROM inspiration_items
    WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5
  `).all(memberId) as Array<{ id: string; title: string; style_tags_json: string }>;
  if (!favs.length) return null;
  const newServices = sqlite.prepare(`
    SELECT id, name, price FROM store_services
    WHERE store_id = ? AND status = 'active' AND is_new = 1
  `).all(storeId) as Array<{ id: string; name: string; price: number }>;
  if (!newServices.length) return null;
  for (const f of favs) {
    const tags: string[] = JSON.parse(f.style_tags_json || "[]");
    for (const svc of newServices) {
      // 方向匹配:标签/标题与服务名的双字方向重叠(≥1),避免单字符误伤
      const dirs = [...tags.map((t) => t.slice(0, 2)), f.title.slice(0, 2)].filter((w) => w.length === 2);
      if (dirs.some((w) => svc.name.includes(w))) {
        return {
          service: svc.name, serviceId: svc.id, price: svc.price,
          evidence: `客户收藏「${f.title}」(标签:${tags.join("、")}),店内新品「${svc.name}」方向相近`,
        };
      }
    }
  }
  return null;
}

/** 最近一次商业触达(含排队),用于时机判断与同品去重 */
function recentCommercialTouch(memberId: string, days: number): { body: string; service: string | null; created_at: string } | null {
  const row = sqlite.prepare(`
    SELECT o.body, o.created_at, d.service_name FROM outreach_messages o
    LEFT JOIN contact_decisions d ON d.strategy_id = o.strategy_id
    WHERE o.member_id = ? AND o.status IN ('sent','queued','replied')
      AND o.created_at > datetime('now', ?)
    ORDER BY o.created_at DESC LIMIT 1
  `).all(memberId, `-${days} day`) as Array<{ body: string; service: string | null; created_at: string }>;
  return row[0] ?? null;
}

/** 本周商业触达次数(按已执行决策计) */
function weeklyCommercialCount(memberId: string): number {
  return (sqlite.prepare(`
    SELECT COUNT(*) AS c FROM contact_decisions
    WHERE member_id = ? AND decision = 'contact' AND category = 'commercial'
      AND created_at > datetime('now', '-7 day')
  `).get(memberId) as { c: number }).c;
}

function sameServiceRecommended(memberId: string, serviceName: string): boolean {
  return ((sqlite.prepare(`
    SELECT COUNT(*) AS c FROM contact_decisions
    WHERE member_id = ? AND service_name = ? AND created_at > datetime('now', '-30 day')
  `).get(memberId, serviceName) as { c: number }).c) > 0;
}

/** 安静时段(店铺本地时区,演示环境按 UTC+8 计算) */
function inQuietHours(start: string, end: string): boolean {
  const h = (new Date(Date.now() + 8 * 3600_000).getUTCHours());
  const cur = h * 60 + new Date(Date.now() + 8 * 3600_000).getUTCMinutes();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s <= e ? (cur >= s && cur < e) : (cur >= s || cur < e);
}

/** 客户正在聊天中(10 分钟内有过发言) */
function chatActive(memberId: string): boolean {
  return ((sqlite.prepare(`
    SELECT COUNT(*) AS c FROM conversation_messages cm
    JOIN conversations cv ON cv.id = cm.conversation_id
    WHERE cv.member_id = ? AND cm.direction = 'in'
      AND cm.created_at > datetime('now', '-10 minutes')
  `).get(memberId) as { c: number }).c) > 0;
}

/* ---------- 主决策 ---------- */
export function decideContact(opts: {
  storeId: string; memberId: string;
  category: ContactCategory;
  kind?: string;                    // coupon | new_item | rights | callback(商业子类)
  taskId?: string; strategyId?: string;
}): ContactDecisionResult {
  const { storeId, memberId, category } = opts;
  const prefs = getOrCreatePrefs(storeId, memberId);
  const decisionId = rid("cd");
  const evidence: string[] = [];

  let needType = "none";
  let relevance = 0, usefulness = 0, timing = 1, consent = 0;
  let consentStatus = "not_granted";
  let reason = "";
  let serviceName: string | null = null;
  let hasNeed = false;

  /* ---- 1. 授权闸门(最高优先级,不允许评分绕过) ---- */
  const masterOff = category === "commercial" && !prefs.allowCommercial;
  const specificOff = category === "commercial" && (
    (opts.kind === "new_item" && !prefs.allowNewItems) ||
    (opts.kind === "coupon" && !prefs.allowPromotions) ||
    (opts.kind === "rights" && !prefs.allowPromotions) ||
    (opts.kind === "callback" && !prefs.allowCommercial)
  );
  const apptOff = category === "appointment_reminder" && !prefs.allowAppointmentReminder;
  if (masterOff || specificOff || apptOff) {
    reason = masterOff
      ? "客户未授权商业推荐——默认沉默,同意必须是客户的主动选择"
      : `客户未授权「${opts.kind === "new_item" ? "新品推荐" : opts.kind === "coupon" || opts.kind === "rights" ? "优惠活动" : "商业推荐"}」类触达`;
    return write({
      decisionId, storeId, memberId, decision: "stay_silent", category,
      needType: "none", reason, evidence, relevance: 0, usefulness: 0, timing: 1,
      consent: 0, consentStatus: "not_granted",
      taskId: opts.taskId, strategyId: opts.strategyId, serviceName: null,
    });
  }
  consent = 1; consentStatus = "granted";

  /* ---- 2. 需求识别(按类别,全部基于真实数据) ---- */
  if (category === "appointment_reminder") {
    const intent = expressedIntent(storeId, memberId);
    if (intent) {
      hasNeed = true; needType = "appointment_reminder"; relevance = 0.9; usefulness = 0.9;
      evidence.push(`客户记忆:「${intent.value}」(${(daysSince(intent.updated_at) ?? 0)} 天前表达)`);
    } else {
      reason = "没有找到客户表达过预约/想做之类的时间需求信号——保持沉默";
    }
  } else {
    // 商业类:按 kind 识别真实依据
    if (opts.kind === "new_item") {
      const m = favoriteMatchNewService(storeId, memberId);
      if (m) {
        hasNeed = true; needType = "new_item_match"; relevance = 0.85; usefulness = 0.8;
        serviceName = m.service;
        evidence.push(m.evidence);
      } else {
        reason = "店内新品与客户收藏/偏好没有真实方向匹配——不为发而发";
      }
    } else if (opts.kind === "coupon") {
      const unused = sqlite.prepare(`
        SELECT name, value FROM coupon_grants
        WHERE member_id = ? AND status = 'granted' LIMIT 1
      `).get(memberId) as { name: string; value: number } | undefined;
      if (unused) {
        hasNeed = true; needType = "coupon_reminder"; relevance = 0.75; usefulness = 0.85;
        evidence.push(`客户有一张未使用的「${unused.name}」(¥${Math.round(unused.value)}),提醒使用有实际价值`);
      } else {
        reason = "客户没有未使用的券——无凭证的优惠邀约等于推销,保持沉默";
      }
    } else if (opts.kind === "rights") {
      const tags: string[] = JSON.parse(String((sqlite.prepare(
        "SELECT tags_json FROM members WHERE id = ?"
      ).get(memberId) as { tags_json: string } | undefined)?.tags_json || "[]"));
      if (tags.includes("卡快过期")) {
        hasNeed = true; needType = "rights_expiry"; relevance = 0.85; usefulness = 0.8;
        evidence.push("客户会员卡即将到期,权益提醒有真实价值");
      } else {
        reason = "客户没有临期权益——权益提醒无从谈起,保持沉默";
      }
    } else {
      // callback / 无明确依据的回访
      const last = latestOrder(storeId, memberId);
      const d = daysSince(last?.occurred_at ?? null);
      if (d !== null && d >= 60 && prefs.allowCommercial) {
        hasNeed = true; needType = "long_absence_callback"; relevance = 0.6; usefulness = 0.5;
        evidence.push(`客户 ${d} 天未到店,轻量回访(非促销)`);
      } else {
        reason = "没有明确需求信号——沉睡不是发券的理由(场景 C:保持沉默)";
      }
    }
  }

  /* ---- 3. 排除客户明确拒绝的类型 ---- */
  if (hasNeed && serviceName && prefs.rejectedCategories.length) {
    const hit = prefs.rejectedCategories.find((k) => serviceName!.includes(k));
    if (hit) {
      hasNeed = false;
      reason = `客户曾表示对「${hit}」类不感兴趣——不再推荐同类型`;
    }
  }

  /* ---- 4. 商业类每周上限(硬限制,先于同品去重) ---- */
  if (hasNeed && category === "commercial" && weeklyCommercialCount(memberId) >= prefs.weeklyCap) {
    hasNeed = false;
    reason = `本周商业触达已达客户偏好上限(${prefs.weeklyCap} 条/周)——超额即沉默`;
  }

  /* ---- 5. 同品/同因去重(30 天) ---- */
  if (hasNeed && serviceName && sameServiceRecommended(memberId, serviceName)) {
    hasNeed = false;
    reason = `「${serviceName}」最近已经推荐过——同一商品不重复打扰`;
  }

  /* ---- 5. 时机判断 ---- */
  if (hasNeed) {
    const last = latestOrder(storeId, memberId);
    const orderDays = daysSince(last?.occurred_at ?? null);
    if (orderDays !== null && orderDays <= 3 && category === "commercial") {
      timing = 0.15;
      reason = `客户 ${orderDays} 天前刚完成消费——此刻推商业消息是打扰,先售后后营销`;
      hasNeed = false;
    } else if (chatActive(memberId)) {
      timing = 0.1;
      reason = "客户正在和猫咪聊天——此刻插商业消息很突兀,保持沉默";
      hasNeed = false;
    } else if (inQuietHours(prefs.quietStart, prefs.quietEnd) && category === "commercial") {
      timing = 0.1;
      reason = `当前处于客户安静时段(${prefs.quietStart}-${prefs.quietEnd})——不打扰`;
      hasNeed = false;
    } else {
      const touch = recentCommercialTouch(memberId, 7);
      if (touch && category === "commercial") {
        timing = 0.35;
        reason = "7 天内已有过商业触达——频率冷却,本次沉默";
        hasNeed = false;
      } else {
        // 服务通知(预约提醒)不参与商业时机降权;商业消息在刚消费后适度降温
        timing = category === "commercial" && orderDays !== null && orderDays <= 10 ? 0.7 : 1;
      }
    }
  }

  /* ---- 7. 评分与阈值(usefulness 由各需求场景按真实帮助程度设定,不扁平化) ---- */
  if (!hasNeed) usefulness = 0;
  const total = +(relevance * usefulness * timing * consent).toFixed(3);
  let decision: ContactDecision = "stay_silent";
  if (hasNeed && total >= 0.8) decision = "contact";
  else if (hasNeed && total >= 0.6) decision = "needs_review";
  else if (!reason) reason = `联系价值 ${total} 低于阈值——沉默比打扰更有价值`;

  return write({
    decisionId, storeId, memberId, decision, category,
    needType: hasNeed ? needType : needType === "none" ? "none" : needType,
    reason, evidence, relevance, usefulness, timing, consent, consentStatus,
    taskId: opts.taskId, strategyId: opts.strategyId, serviceName,
  });
}

/* ---------- 落库(每次决策必留痕) ---------- */
function write(d: {
  decisionId: string; storeId: string; memberId: string; decision: ContactDecision;
  category: ContactCategory; needType: string; reason: string; evidence: string[];
  relevance: number; usefulness: number; timing: number; consent: number;
  consentStatus: string; taskId?: string; strategyId?: string; serviceName: string | null;
}): ContactDecisionResult {
  const dedupeKey = d.serviceName ? `service:${d.serviceName}:${d.memberId}` : null;
  sqlite.prepare(`
    INSERT INTO contact_decisions (id, store_id, member_id, decision, category, need_type, reason,
      evidence_json, relevance, usefulness, timing, consent_status, total_score,
      task_id, strategy_id, service_name, dedupe_key, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    d.decisionId, d.storeId, d.memberId, d.decision, d.category,
    d.needType, d.reason, JSON.stringify(d.evidence),
    d.relevance, d.usefulness, d.timing, d.consentStatus,
    +(d.relevance * d.usefulness * d.timing * d.consent).toFixed(3),
    d.taskId ?? null, d.strategyId ?? null, d.serviceName, dedupeKey, nowIso(),
  );
  return {
    decision: d.decision, decisionId: d.decisionId,
    need: {
      has_need: d.decision !== "stay_silent" && d.needType !== "none",
      need_type: d.needType, evidence: d.evidence,
      confidence: d.relevance, reason: d.reason,
      recommended_action: d.decision === "contact" ? "consider_contact" : "stay_silent",
    },
    scores: {
      relevance: d.relevance, usefulness: d.usefulness,
      timing: d.timing, consent: d.consent,
      total: +(d.relevance * d.usefulness * d.timing * d.consent).toFixed(3),
    },
    consent_status: d.consentStatus,
    reason: d.reason,
    service_name: d.serviceName,
  };
}

/** 标记决策最终结果(approve / superseded 等) */
export function markDecision(decisionId: string, outcome: string) {
  sqlite.prepare("UPDATE contact_decisions SET outcome = ? WHERE id = ?").run(outcome, decisionId);
}
