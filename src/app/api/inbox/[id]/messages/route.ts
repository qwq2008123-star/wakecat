import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";

function assertOwned(convId: string, storeId: string) {
  const c = sqlite.prepare("SELECT * FROM conversations WHERE id = ?").get(convId) as
    | Record<string, unknown>
    | undefined;
  if (!c || c.store_id !== storeId) return null;
  return c;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const user = await requireUser();
  const { id } = await params;
  const c = assertOwned(id, user.storeId);
  if (!c) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  const rows = sqlite.prepare(`
    SELECT direction, content, meta_json, created_at FROM conversation_messages
    WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC
  `).all(id);
  const memberName = (sqlite.prepare("SELECT name FROM members WHERE id = ?").get(c.member_id) as { name?: string } | undefined)?.name ?? "访客";
  return NextResponse.json({ memberName, messages: rows });
}

/** 老板娘以自己名义回复 → 写入对话,C 端轮询可见(meta.human=true) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const user = await requireUser();
  const { id } = await params;
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text?.trim()) return NextResponse.json({ error: "内容为空" }, { status: 400 });
  const c = sqlite.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  if (!c || c.store_id !== user.storeId) return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  const now = new Date().toISOString();
  sqlite.prepare(`
    INSERT INTO conversation_messages (id, conversation_id, direction, content, meta_json, created_at)
    VALUES (?,?,?,?,?,?)
  `).run(`cm_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, id, "out", text.trim(),
    JSON.stringify({ human: true, by: user.name }), now);
  if (c.status === "needs_human") {
    sqlite.prepare("UPDATE conversations SET status='open' WHERE id = ?").run(id);
  }
  return NextResponse.json({ ok: true });
}
