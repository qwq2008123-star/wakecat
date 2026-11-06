import { db, sqlite } from "../db/client";
import { salesOpportunities } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/* ============================================================
   机会引擎:侦探喵的「会员机会池」
   Score = 0.30R(流失风险) + 0.25V(历史价值) + 0.20P(服务匹配)
         + 0.15I(近期意向) − 0.10F(触达疲劳)   各维 0-100
   退订 / 投诉为硬拦截条件,不参与评分。
   ============================================================ */

export type OpportunityAction = "appointment_reminder" | "new_item" | "reactivation" | "personal_care" | "skip";

export interface SalesOpportunity {
  memberId: string;
  memberName: string;
  spend: number;
  score: number;
  components: { R: number; V: number; P: number; I: number; F: number };
  reason: string;
  recommendedAction: OpportunityAction;
  recommendedActionLabel: string;
}

export interface ScanResult {
  scanned: number;
  blocked: number;       // 退订/投诉硬拦截
  opportunities: SalesOpportunity[];
}

type Row = Record<string, unknown>;

export function runOpportunityScan(storeId: string): ScanResult {
  const rows = sqlite.prepare(`
    SELECT m.id, m.name,
      (SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id = m.id) AS last_visit,
      (SELECT COALESCE(SUM(amount),0) FROM consumption_records r WHERE r.member_id = m.id) AS spend,
      (SELECT COUNT(*) FROM consumption_records r WHERE r.member_id = m.id) AS visits,
      (SELECT service FROM consumption_records r WHERE r.member_id = m.id ORDER BY occurred_at DESC LIMIT 1) AS last_service,
      (SELECT status FROM customer_consents c WHERE c.member_id = m.id AND c.purpose='marketing' ORDER BY updated_at DESC LIMIT 1) AS consent,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.member_id = m.id AND o.created_at > datetime('now','-14 day')) AS recent_touches,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.member_id = m.id AND o.reply_intent='accept' AND o.created_at > datetime('now','-30 day')) AS recent_intent,
      (SELECT COUNT(*) FROM outreach_messages o WHERE o.member_id = m.id AND o.reply_intent='decline' AND o.created_at > datetime('now','-30 day')) AS recent_decline
    FROM members m WHERE m.store_id = ?
  `).all(storeId) as Row[];

  const maxSpend = Math.max(1, ...rows.map((r) => (r.spend as number) || 0));
  const opportunities: SalesOpportunity[] = [];
  let blocked = 0;

  for (const r of rows) {
    // 硬拦截:退订/投诉中的会员不进入机会池
    if (r.consent === "unsubscribed") { blocked++; continue; }

    const days = r.last_visit
      ? Math.floor((Date.now() - new Date(r.last_visit as string).getTime()) / 86400_000)
      : 180;

    // R 流失风险:0-100,60 天起显著上升
    const R = Math.min(100, Math.round(Math.max(0, days - 14) * 1.1));
    // V 历史价值:消费额百分位
    const V = Math.round(((r.spend as number) || 0) / maxSpend * 100);
    // P 服务匹配:_catalog 里有对应服务即给基础分,新品加成
    const svc = sqlite.prepare(
      "SELECT id, price, is_new FROM store_services WHERE store_id = ? AND status='active' AND name LIKE ? LIMIT 1"
    ).get(storeId, `%${String(r.last_service ?? "").slice(0, 2)}%`) as { id: string; price: number; is_new: number } | undefined;
    const P = svc ? (svc.is_new ? 88 : 66) : 40;
    // I 近期意向:30 天内 accept/decline 信号
    const I = Math.min(100, (r.recent_intent as number) * 55 - (r.recent_decline as number) * 30 + 18);
    // F 触达疲劳:14 天内触达次数
    const F = Math.min(100, (r.recent_touches as number) * 34);

    const score = Math.round(0.30 * R + 0.25 * V + 0.20 * P + 0.15 * Math.max(0, I) - 0.10 * F);

    // 动作判定
    let action: OpportunityAction = "reactivation";
    let label = "个性化召回";
    if (days <= 20 && (r.visits as number) >= 2) { action = "appointment_reminder"; label = "预约提醒"; }
    else if (svc?.is_new && days <= 45) { action = "new_item"; label = "新品推荐"; }
    else if (days > 110) { action = "personal_care"; label = "人工关怀"; }

    let reason: string;
    if (days <= 20) reason = `到店节奏健康(${days} 天前),适合做提醒与增值推荐`;
    else if (days > 110) reason = `已 ${days} 天未到店,累计消费 ¥${r.spend},建议人工关怀优先`;
    else reason = `${days} 天未到店,累计消费 ¥${r.spend},处于可唤醒窗口`;

    opportunities.push({
      memberId: r.id as string, memberName: r.name as string,
      spend: Math.round((r.spend as number) || 0),
      score, components: { R, V, P, I: Math.max(0, I), F },
      reason,
      recommendedAction: action, recommendedActionLabel: label,
    });
  }

  // 写入机会池(先清旧 open,保留历史)
  db.delete(salesOpportunities).where(eq(salesOpportunities.status, "open")).run();
  opportunities
    .sort((a, b) => b.score - a.score)
    .forEach((o) => {
      db.insert(salesOpportunities).values({
        id: `opp_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        storeId, memberId: o.memberId, score: o.score,
        componentsJson: JSON.stringify(o.components),
        reason: o.reason, recommendedAction: o.recommendedActionLabel,
        status: "open", createdAt: new Date().toISOString(),
      }).run();
    });

  return { scanned: rows.length, blocked, opportunities: opportunities.sort((a, b) => b.score - a.score) };
}

export function getOpportunityPool(storeId: string, limit = 20): (SalesOpportunity & { id: string })[] {
  const rows = sqlite.prepare(`
    SELECT o.*, m.name,
      (SELECT COALESCE(SUM(amount),0) FROM consumption_records r WHERE r.member_id = o.member_id) AS spend
    FROM sales_opportunities o
    JOIN members m ON m.id = o.member_id
    WHERE o.store_id = ? AND o.status = 'open'
    ORDER BY o.score DESC LIMIT ?
  `).all(storeId, limit) as Row[];
  return rows.map((r) => ({
    id: r.id as string,
    memberId: r.member_id as string,
    memberName: r.name as string,
    spend: Math.round((r.spend as number) || 0),
    score: r.score as number,
    components: JSON.parse((r.components_json as string) || "{}"),
    reason: r.reason as string,
    recommendedAction: "reactivation",
    recommendedActionLabel: (r.recommended_action as string) || "个性化召回",
  }));
}
