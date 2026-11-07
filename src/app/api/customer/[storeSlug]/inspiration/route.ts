import { NextResponse } from "next/server";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { adoptCat } from "@/lib/cats/engine";
import { collectInspiration, listInspiration, deleteInspiration } from "@/lib/inspiration";

/** C端灵感收藏室:GET 列表 / POST 收藏+看图分析 / DELETE 移除 */
export async function GET(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const { visitorId } = Object.fromEntries(new URL(req.url).searchParams);
  const bound = getBoundMember(store.id, String(visitorId ?? ""));
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  return NextResponse.json(listInspiration(store.id, bound.member_id as string));
}

export async function POST(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const bound = getBoundMember(store.id, String(body.visitorId ?? ""));
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  if (!body.imageDataUrl && !String(body.note ?? "").trim()) {
    return NextResponse.json({ error: "发一张图,或写一句喜欢的描述" }, { status: 400 });
  }
  const memberId = bound.member_id as string;
  const cat = adoptCat(store.id, memberId);
  const r = await collectInspiration({
    storeId: store.id, userId: memberId, catId: cat.id,
    imageDataUrl: typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined,
    note: String(body.note ?? ""), source: String(body.source ?? "upload"),
  });
  return NextResponse.json(r, { status: r.imageError ? 202 : 200 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const { visitorId, id } = Object.fromEntries(new URL(req.url).searchParams);
  const bound = getBoundMember(store.id, String(visitorId ?? ""));
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  const ok = deleteInspiration(store.id, bound.member_id as string, String(id ?? ""));
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
