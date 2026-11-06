import { NextResponse } from "next/server";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { getCatByMember, wakeUp, catView } from "@/lib/cats/engine";

/** 免费唤醒休眠的猫咪(不强制消费) */
export async function POST(req: Request) {
  await ensureBootstrap();
  const { storeSlug, visitorId } = await req.json().catch(() => ({ storeSlug: "", visitorId: "" }));
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const bound = visitorId ? getBoundMember(store.id, visitorId) : null;
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  const catRow = getCatByMember(store.id, bound.member_id as string);
  if (!catRow) return NextResponse.json({ error: "还没有领养猫咪" }, { status: 404 });
  const r = wakeUp(catRow.id, bound.member_id as string);
  return NextResponse.json({ ...r, cat: catView(getCatByMember(store.id, bound.member_id as string)!) });
}
