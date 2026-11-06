import { NextResponse } from "next/server";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getCatalog } from "@/lib/sales/recommendation-engine";

/** 真实服务目录(价格/时长来自店铺数据库,不编造) */
export async function GET(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = await params;
  await ensureBootstrap();
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const maxPrice = Number(new URL(req.url).searchParams.get("maxPrice") ?? NaN);
  return NextResponse.json({
    items: getCatalog(store.id, { maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined }),
  });
}
