import { NextResponse } from "next/server";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { getOrCreatePrefs, updatePrefs } from "@/lib/contact/engine";

/** C端联系偏好:GET 查看 / PUT 修改(授权是客户的权利,随时可改) */
export async function GET(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const { visitorId } = Object.fromEntries(new URL(req.url).searchParams);
  const bound = getBoundMember(store.id, String(visitorId ?? ""));
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  return NextResponse.json(getOrCreatePrefs(store.id, bound.member_id as string));
}

export async function PUT(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const bound = getBoundMember(store.id, String(body.visitorId ?? ""));
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  const patch: Record<string, unknown> = {};
  if (typeof body.allowCommercial === "boolean") patch.allowCommercial = body.allowCommercial;
  if (typeof body.allowNewItems === "boolean") patch.allowNewItems = body.allowNewItems;
  if (typeof body.allowPromotions === "boolean") patch.allowPromotions = body.allowPromotions;
  if (typeof body.allowAppointmentReminder === "boolean") patch.allowAppointmentReminder = body.allowAppointmentReminder;
  if (typeof body.weeklyCap === "number") patch.weeklyCap = Math.max(0, Math.min(7, Math.round(body.weeklyCap)));
  if (typeof body.reject === "string" && body.reject.trim()) {
    const cur = getOrCreatePrefs(store.id, bound.member_id as string);
    const kw = body.reject.trim().slice(0, 6);
    patch.rejectedCategories = [...new Set([...cur.rejectedCategories, kw])];
  }
  const next = updatePrefs(store.id, bound.member_id as string, patch);
  return NextResponse.json(next);
}
