import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser, HttpError } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";

/** 联系决策中心:今日决策统计 + 沉默原因 + 待人工审核列表(全部来自真实决策日志) */
export async function GET() {
  await ensureBootstrap();
  try {
    const user = await requireUser();
    const today = new Date().toISOString().slice(0, 10);
    const one = (sql: string, ...a: unknown[]) =>
      (sqlite.prepare(sql).get(...a) as Record<string, unknown>);
    const stats = {
      needsFound: Number(one(`SELECT COUNT(*) c FROM contact_decisions WHERE store_id=? AND date(created_at)=? AND need_type != 'none'`, user.storeId, today).c),
      silent: Number(one(`SELECT COUNT(*) c FROM contact_decisions WHERE store_id=? AND date(created_at)=? AND decision='stay_silent'`, user.storeId, today).c),
      contact: Number(one(`SELECT COUNT(*) c FROM contact_decisions WHERE store_id=? AND date(created_at)=? AND decision='contact'`, user.storeId, today).c),
      review: Number(one(`SELECT COUNT(*) c FROM contact_decisions WHERE store_id=? AND date(created_at)=? AND decision='needs_review' AND outcome IS NULL`, user.storeId, today).c),
      sent: Number(one(`SELECT COUNT(*) c FROM outreach_messages o JOIN tasks t ON t.id=o.task_id WHERE t.store_id=? AND o.status='sent' AND date(o.created_at)=?`, user.storeId, today).c),
      replied: Number(one(`SELECT COUNT(*) c FROM outreach_messages o JOIN tasks t ON t.id=o.task_id WHERE t.store_id=? AND o.status='replied'`, user.storeId, today).c),
    };
    const silentReasons = sqlite.prepare(`
      SELECT reason, COUNT(*) AS c FROM contact_decisions
      WHERE store_id = ? AND date(created_at) = ? AND decision = 'stay_silent'
      GROUP BY reason ORDER BY c DESC LIMIT 8
    `).all(user.storeId, today) as Array<Record<string, unknown>>;
    const reviewList = sqlite.prepare(`
      SELECT d.*, m.name AS member_name, s.kind AS strategy_kind, s.content AS strategy_content
      FROM contact_decisions d
      JOIN members m ON m.id = d.member_id
      LEFT JOIN strategies s ON s.id = d.strategy_id
      WHERE d.store_id = ? AND d.decision = 'needs_review' AND d.outcome IS NULL
      ORDER BY d.created_at DESC LIMIT 10
    `).all(user.storeId) as Array<Record<string, unknown>>;
    const recent = sqlite.prepare(`
      SELECT d.decision, d.category, d.reason, d.total_score, d.created_at, m.name AS member_name
      FROM contact_decisions d JOIN members m ON m.id = d.member_id
      WHERE d.store_id = ? ORDER BY d.created_at DESC LIMIT 12
    `).all(user.storeId) as Array<Record<string, unknown>>;
    return NextResponse.json({ stats, silentReasons, reviewList, recent });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
