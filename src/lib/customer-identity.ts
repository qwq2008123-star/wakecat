import { eq } from "drizzle-orm";
import { db, sqlite } from "./db/client";
import { customerIdentities } from "./db/schema";
import { resolveStore } from "./store";

/* C 端身份绑定:会员码(完整ID / 手机尾号4位)→ 跨渠道身份映射 */
export function resolveCustomerStore(storeSlug: string) {
  return resolveStore(storeSlug);
}

export function bindIdentity(storeId: string, visitorId: string, memberCode: string): {
  ok: boolean; error?: string; member?: { id: string; name: string; level: string; lastVisitDays: number };
} {
  const code = memberCode.trim();
  let member: Record<string, unknown> | undefined =
    sqlite.prepare("SELECT * FROM members WHERE id = ? AND store_id = ?").get(code, storeId) as Record<string, unknown> | undefined;
  if (!member && /^\d{4}$/.test(code)) {
    member = sqlite.prepare(
      "SELECT * FROM members WHERE store_id = ? AND phone_masked LIKE '%' || ? LIMIT 1"
    ).get(storeId, code) as Record<string, unknown> | undefined;
  }
  if (!member) return { ok: false, error: "会员码无效:试试会员 ID(如 m_001)或手机尾号 4 位" };
  const memberId = member.id as string;
  const existing = sqlite.prepare(
    "SELECT id FROM customer_identities WHERE store_id = ? AND channel='h5' AND external_user_id = ?"
  ).get(storeId, visitorId) as { id: string } | undefined;
  if (existing) {
    db.update(customerIdentities).set({ memberId })
      .where(eq(customerIdentities.id, existing.id)).run();
  } else {
    db.insert(customerIdentities).values({
      id: `ident_${randomId()}`, storeId, memberId, channel: "h5",
      externalUserId: visitorId, displayName: member.name as string,
      createdAt: new Date().toISOString(),
    }).run();
  }
  const last = sqlite.prepare(
    "SELECT MAX(occurred_at) as d FROM consumption_records WHERE member_id = ?"
  ).get(memberId) as { d: string | null };
  const days = last.d ? Math.floor((Date.now() - new Date(last.d).getTime()) / 86400_000) : 0;
  return { ok: true, member: { id: memberId, name: member.name as string, level: member.level as string, lastVisitDays: days } };
}

export function getBoundMember(storeId: string, visitorId: string) {
  const row = sqlite.prepare(`
    SELECT i.member_id, m.name, m.level, m.phone_masked, m.tags_json, m.joined_at
    FROM customer_identities i JOIN members m ON m.id = i.member_id
    WHERE i.store_id = ? AND i.channel='h5' AND i.external_user_id = ?
  `).get(storeId, visitorId) as Record<string, unknown> | undefined;
  return row ?? null;
}

export function getBoundMemberGlobal(visitorId: string) {
  const row = sqlite.prepare(`
    SELECT i.member_id, m.name, m.level FROM customer_identities i
    JOIN members m ON m.id = i.member_id
    WHERE i.channel='h5' AND i.external_user_id = ?
    ORDER BY i.created_at DESC LIMIT 1
  `).get(visitorId) as Record<string, unknown> | undefined;
  return row ?? null;
}

function randomId() {
  return Math.random().toString(36).slice(2, 12);
}
