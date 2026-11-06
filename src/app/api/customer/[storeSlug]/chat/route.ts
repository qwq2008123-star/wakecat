import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { handleCustomerMessage } from "@/lib/sales/conversation-engine";
import { MemberCatView } from "@/mock-data/types";

/** 客户侧对话入口:身份识别 → 对话状态机(真实目录/排班/预约) */
export async function POST(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  await ensureBootstrap();
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });

  const { visitorId, message } = await req.json().catch(() => ({ visitorId: "", message: "" }));
  if (!visitorId || !message?.trim()) {
    return NextResponse.json({ error: "缺少 visitorId 或 message" }, { status: 400 });
  }

  // 身份识别:游客可浏览/询价/预约;绑定后才能读个人档案
  const ident = sqlite.prepare(
    "SELECT member_id FROM customer_identities WHERE store_id = ? AND channel='h5' AND external_user_id = ?"
  ).get(store.id, visitorId) as { member_id: string | null } | undefined;
  const memberId = ident?.member_id ?? null;
  let member: MemberCatView | null = null;
  if (memberId) {
    const m = sqlite.prepare("SELECT * FROM members WHERE id = ?").get(memberId) as Record<string, unknown> | undefined;
    if (m) {
      const tags = JSON.parse((m.tags_json as string) || "[]");
      const last = sqlite.prepare(
        "SELECT MAX(occurred_at) as d FROM consumption_records WHERE member_id = ?"
      ).get(memberId) as { d: string | null };
      const days = last.d ? Math.floor((Date.now() - new Date(last.d).getTime()) / 86400_000) : 0;
      member = {
        id: m.id as string, name: m.name as string, phoneMasked: m.phone_masked as string,
        level: m.level as MemberCatView["level"], zone: "active", state: "awake",
        colorway: "orange", spend: 0, visits: 0, lastVisitDays: days,
        favoriteService: "", tags, risk: "low", strategyHint: "", joinedAt: "",
        catName: "",
      };
    }
  }

  const reply = handleCustomerMessage({
    storeId: store.id, identityId: `h5:${visitorId}`, memberId, member, message: String(message),
  });
  return NextResponse.json(reply);
}
