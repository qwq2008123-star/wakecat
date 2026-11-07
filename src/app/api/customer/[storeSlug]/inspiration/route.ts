import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { adoptCat } from "@/lib/cats/engine";
import { collectInspiration, listInspiration, deleteInspiration } from "@/lib/inspiration";
import { getOrCreateConversation } from "@/lib/sales/conversation-engine";
import { sqlite } from "@/lib/db/client";

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
  // 第二阶段:聊天里发的图,把「用户图片消息 + 猫的回应」落进会话(刷新后可恢复),
  // 灵感条目与消息通过 inspirationId 互相关联
  if (String(body.source ?? "") === "chat") {
    const identityId = `h5:${String(body.visitorId ?? "")}`;
    const convId = getOrCreateConversation(store.id, identityId, "h5");
    const now = new Date().toISOString();
    const ins = sqlite.prepare(`
      INSERT INTO conversation_messages (id, conversation_id, direction, content, meta_json, created_at)
      VALUES (?,?,?,?,?,?)
    `);
    ins.run(`cm_${randomUUID().replace(/-/g, "").slice(0, 12)}`, convId, "in",
      String(body.note ?? "").trim() || "[图片]",
      JSON.stringify({ type: "image", imagePath: r.item.imageUrl, inspirationId: r.item.id }), now);
    ins.run(`cm_${randomUUID().replace(/-/g, "").slice(0, 12)}`, convId, "out",
      r.analysis.catComment || "图我收下啦~",
      JSON.stringify({
        channel: "cat", type: "image_reply", inspirationId: r.item.id,
        engine: r.analysis.engine, catName: cat.name,
        imagePath: r.item.imageUrl,
        recognized: r.analysis.engine === "llm",
      }), new Date(Date.now() + 1).toISOString());
  }
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
