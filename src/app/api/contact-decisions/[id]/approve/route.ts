import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser, HttpError } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { markDecision } from "@/lib/contact/engine";
import { queueAndSend } from "@/lib/services";

/** 人工批准一条 needs_review 的联系建议(0.6–0.8 区间的唯一放行通道) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  try {
    const user = await requireUser();
    const { id } = await params;
    const d = sqlite.prepare("SELECT * FROM contact_decisions WHERE id = ? AND store_id = ?")
      .get(id, user.storeId) as Record<string, unknown> | undefined;
    if (!d) return NextResponse.json({ error: "决策不存在" }, { status: 404 });
    if (d.decision !== "needs_review") return NextResponse.json({ error: `该决策状态为 ${d.decision},无需审核` }, { status: 400 });
    if (!d.strategy_id || !d.task_id) return NextResponse.json({ error: "该决策没有关联策略,无法发送" }, { status: 400 });
    markDecision(id, "approved_by_human");
    const r = await queueAndSend(user, String(d.task_id), String(d.strategy_id));
    return NextResponse.json({ ok: r.ok, msgId: r.msgId });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
