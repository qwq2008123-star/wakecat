import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sqlite } from "@/lib/db/client";
import { customerIdentities } from "@/lib/db/schema";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";

/** 会员身份绑定:会员码(会员ID 或手机尾号)→ customer_identities
    未绑定访客仍可浏览/询价/预约,但读不到任何个人档案。 */
export async function POST(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  await ensureBootstrap();
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });

  const { visitorId, memberCode } = await req.json().catch(() => ({ visitorId: "", memberCode: "" }));
  if (!visitorId || !memberCode?.trim()) {
    return NextResponse.json({ error: "缺少 visitorId 或会员码" }, { status: 400 });
  }
  const code = String(memberCode).trim();

  // 支持两种演示码:完整会员ID(m_001)或手机尾号 4 位
  let member: Record<string, unknown> | undefined =
    sqlite.prepare("SELECT * FROM members WHERE id = ? AND store_id = ?").get(code, store.id) as Record<string, unknown> | undefined;
  if (!member && /^\d{4}$/.test(code)) {
    member = sqlite.prepare(
      "SELECT * FROM members WHERE store_id = ? AND phone_masked LIKE '%' || ? LIMIT 1"
    ).get(store.id, code) as Record<string, unknown> | undefined;
  }
  if (!member) {
    return NextResponse.json({ error: "会员码无效:试试会员ID(如 m_001)或手机尾号 4 位" }, { status: 404 });
  }

  const memberId = member.id as string;
  const existing = sqlite.prepare(
    "SELECT id FROM customer_identities WHERE store_id = ? AND channel='h5' AND external_user_id = ?"
  ).get(store.id, visitorId) as { id: string } | undefined;
  if (existing) {
    db.update(customerIdentities).set({ memberId })
      .where(eq(customerIdentities.id, existing.id)).run();
  } else {
    db.insert(customerIdentities).values({
      id: `ident_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      storeId: store.id, memberId, channel: "h5",
      externalUserId: visitorId, displayName: member.name as string,
      createdAt: new Date().toISOString(),
    }).run();
  }

  const last = sqlite.prepare(
    "SELECT MAX(occurred_at) as d FROM consumption_records WHERE member_id = ?"
  ).get(memberId) as { d: string | null };
  const days = last.d ? Math.floor((Date.now() - new Date(last.d).getTime()) / 86400_000) : 0;

  return NextResponse.json({
    ok: true,
    member: { name: member.name, level: member.level, lastVisitDays: days },
  });
}

/** 查询当前绑定状态 */
export async function GET(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  await ensureBootstrap();
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const visitorId = new URL(req.url).searchParams.get("visitorId");
  if (!visitorId) return NextResponse.json({ member: null });
  const row = sqlite.prepare(`
    SELECT m.name, m.level FROM customer_identities i
    JOIN members m ON m.id = i.member_id
    WHERE i.store_id = ? AND i.channel='h5' AND i.external_user_id = ?
  `).get(store.id, visitorId) as { name: string; level: string } | undefined;
  return NextResponse.json({ member: row ?? null });
}
