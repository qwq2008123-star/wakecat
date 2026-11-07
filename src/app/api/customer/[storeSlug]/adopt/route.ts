import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { resolveStore } from "@/lib/store";
import { bindIdentity } from "@/lib/customer-identity";
import { adoptCat, catView, awardEnergy } from "@/lib/cats/engine";
import { deliverQueuedInSite } from "@/lib/services";

/** 领养闺蜜猫:绑定会员即领养(每店每用户一只) */
export async function POST(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const { visitorId, memberCode, name } = await req.json().catch(() => ({ visitorId: "", memberCode: "", name: "" }));
  if (!visitorId || !memberCode) return NextResponse.json({ error: "缺少 visitorId 或会员码" }, { status: 400 });

  const bind = bindIdentity(store.id, visitorId, memberCode);
  if (!bind.ok || !bind.member) return NextResponse.json({ error: bind.error }, { status: 404 });

  const cat = adoptCat(store.id, bind.member.id, name);
  // 会员上线:TA 名下排队的站内消息此刻真实送达
  const delivered = await deliverQueuedInSite(store.id, bind.member.id);
  awardEnergy({
    catId: cat.id, userId: bind.member.id, action: "effective_interaction",
    dedupeKey: `adopt:${cat.id}`, source: "adopt",
  });
  return NextResponse.json({ ok: true, cat: catView(cat), member: bind.member, queuedDelivered: delivered });
}
