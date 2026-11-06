import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { getCatByMember, catView } from "@/lib/cats/engine";
import { topMemoriesForPrompt } from "@/lib/memory/extractor";

/** 我的闺蜜猫:状态 + 记忆 + 最近能量流水 */
export async function GET(req: Request) {
  await ensureBootstrap();
  const url = new URL(req.url);
  const store = resolveStore(url.searchParams.get("storeSlug") ?? "");
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const visitorId = url.searchParams.get("visitorId");
  const bound = visitorId ? getBoundMember(store.id, visitorId) : null;
  if (!bound) return NextResponse.json({ cat: null, member: null });

  const catRow = getCatByMember(store.id, bound.member_id as string);
  if (!catRow) return NextResponse.json({ cat: null, member: bound });
  const cat = catView(catRow);
  const memories = topMemoriesForPrompt(bound.member_id as string, 30);
  const transactions = sqlite.prepare(`
    SELECT action, source, delta, reversed, created_at FROM energy_transactions
    WHERE cat_id = ? ORDER BY created_at DESC LIMIT 12
  `).all(cat.id);
  return NextResponse.json({ cat, member: bound, memories, transactions });
}
