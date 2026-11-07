import { NextResponse } from "next/server";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { setCatStyle, getCatStyle } from "@/lib/cats/engine";

/** 客户自选猫造型(A-E) */
export async function POST(req: Request) {
  await ensureBootstrap();
  const { visitorId, storeSlug, style } = await req.json().catch(() => ({}));
  const store = resolveStore(String(storeSlug ?? ""));
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const bound = getBoundMember(store.id, String(visitorId ?? ""));
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  if (!/^[A-E]$/.test(String(style ?? ""))) return NextResponse.json({ error: "无效造型" }, { status: 400 });
  setCatStyle(store.id, bound.member_id as string, String(style));
  return NextResponse.json({ ok: true, style: getCatStyle(store.id, bound.member_id as string) });
}
