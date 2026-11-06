import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";

/** 我的记忆列表(用户可见、可管理) */
export async function GET(req: Request) {
  await ensureBootstrap();
  const url = new URL(req.url);
  const store = resolveStore(url.searchParams.get("storeSlug") ?? "");
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const visitorId = url.searchParams.get("visitorId");
  const bound = visitorId ? getBoundMember(store.id, visitorId) : null;
  if (!bound) return NextResponse.json({ memories: [] });
  const rows = sqlite.prepare(`
    SELECT id, memory_type, category, attribute, value, confidence, source, user_confirmed, updated_at
    FROM user_memories WHERE user_id = ? AND status = 'active' AND visibility = 'user_visible'
    ORDER BY updated_at DESC
  `).all(bound.member_id as string);
  return NextResponse.json({ memories: rows });
}
