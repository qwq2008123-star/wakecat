import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { resolveStore } from "@/lib/store";
import { bindIdentity } from "@/lib/customer-identity";
import { adoptCat, catView, awardEnergy } from "@/lib/cats/engine";

/** 领养闺蜜猫:绑定会员即领养(每店每用户一只) */
export async function POST(req: Request) {
  await ensureBootstrap();
  const { storeSlug, visitorId, memberCode, name } = await req.json().catch(() => ({ visitorId: "", memberCode: "", name: "", storeSlug: "" }));
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  if (!visitorId || !memberCode) return NextResponse.json({ error: "缺少 visitorId 或会员码" }, { status: 400 });

  const bind = bindIdentity(store.id, visitorId, memberCode);
  if (!bind.ok || !bind.member) return NextResponse.json({ error: bind.error }, { status: 404 });

  const cat = adoptCat(store.id, bind.member.id, name);
  awardEnergy({
    catId: cat.id, userId: bind.member.id, action: "effective_interaction",
    dedupeKey: `adopt:${cat.id}`, source: "adopt",
  });
  return NextResponse.json({ ok: true, cat: catView(cat), member: bind.member });
}
