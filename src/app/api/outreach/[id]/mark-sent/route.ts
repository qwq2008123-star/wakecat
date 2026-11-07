import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser, HttpError } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";

/** 商家确认已在企微真实发送(半自动通道回执) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const user = await requireUser();
  const { id } = await params;
  const m = sqlite.prepare(`
    SELECT o.*, t.store_id FROM outreach_messages o JOIN tasks t ON t.id = o.task_id WHERE o.id = ?
  `).get(id) as Record<string, unknown> | undefined;
  if (!m) return NextResponse.json({ error: "消息不存在" }, { status: 404 });
  if (m.store_id !== user.storeId) return NextResponse.json({ error: "无权操作" }, { status: 403 });
  if (m.status !== "awaiting_send") return NextResponse.json({ error: `消息状态为 ${m.status},不是待发送` }, { status: 400 });

  const now = new Date().toISOString();
  sqlite.prepare("UPDATE outreach_messages SET status='sent', sent_at=?, external_id=? WHERE id=?")
    .run(now, `manual_${Date.now()}`, id);
  sqlite.prepare("INSERT INTO message_events (id, message_id, event_type, meta_json, occurred_at) VALUES (?,?,?,?,?)")
    .run(`me_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, id, "sent",
      JSON.stringify({ channel: "wecom-manual", by: user.name }), now);
  sqlite.prepare("INSERT INTO finance_entries (id, store_id, task_id, type, amount, note, occurred_at) VALUES (?,?,?,?,?,?,?)")
    .run(`fe_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, m.store_id, m.task_id, "cost", 0,
      "半自动企微发送(人工操作,无渠道成本)", now);
  return NextResponse.json({ ok: true });
}
