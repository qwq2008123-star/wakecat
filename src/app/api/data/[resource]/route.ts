import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/session";
import {
  getRealDashboard, getRealTaskViews, getRealMemories, getReports,
} from "@/lib/queries";

/** 真实数据只读接口:供 HttpApiProvider 使用(阶段① UI 接真库) */
export async function GET(req: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const user = await requireUser();
    const { resource } = await params;
    const url = new URL(req.url);
    switch (resource) {
      case "dashboard":
        return NextResponse.json(await getRealDashboard(user.storeId));
      case "members":
        return NextResponse.json(await (await import("@/lib/queries")).listMembers(user.storeId, "all"));
      case "memories": {
        const memberId = url.searchParams.get("memberId") ?? undefined;
        return NextResponse.json(await getRealMemories(user.storeId, memberId || undefined));
      }
      case "tasks":
        return NextResponse.json(await getRealTaskViews(user.storeId));
      case "finance": {
        const r = await getReports(user.storeId);
        // 月度趋势:近 6 个月真实成本/回流(预测线由前端隐藏)
        const trendRows = (await import("@/lib/db/client")).sqlite.prepare(`
          SELECT strftime('%m', occurred_at) AS mon,
            COALESCE(SUM(CASE WHEN type='cost' THEN amount END),0) AS cost,
            COALESCE(SUM(CASE WHEN type='revenue' THEN amount END),0) AS revenue
          FROM finance_entries WHERE store_id = ?
          GROUP BY strftime('%Y-%m', occurred_at) ORDER BY strftime('%Y-%m', occurred_at)
        `).all(user.storeId) as Record<string, unknown>[];
        return NextResponse.json({
          cost: r.cost, reached: r.funnel.sent, replied: r.funnel.replied ?? 0,
          appointments: r.funnel.accepted ?? 0, visited: r.visited,
          consumption: Math.round(r.revenue), profit: Math.round(r.revenue - r.cost),
          trend: trendRows.map((t) => ({
            month: `${t.mon}月`, cost: t.cost, revenue: t.revenue, predicted: null,
          })),
        });
      }
      default:
        return NextResponse.json({ error: `未知数据资源 ${resource}` }, { status: 404 });
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
