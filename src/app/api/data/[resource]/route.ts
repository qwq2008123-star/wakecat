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
      case "dashboard": {
        const base = await getRealDashboard(user.storeId);
        const { getLifecycleStats } = await import("@/lib/cats/engine");
        return NextResponse.json({ ...base, catLife: getLifecycleStats(user.storeId) });
      }
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
        // 三种口径:预测(策略预估)/ 实际(真实订单,剔除退款)/ 增量(AI唤回归因的订单)
        const sqlite3 = (await import("@/lib/db/client")).sqlite;
        const predicted = sqlite3.prepare(`
          SELECT COALESCE(SUM(s.predicted_uplift),0) AS v FROM strategies s
          JOIN tasks t ON t.id = s.task_id WHERE t.store_id = ?
        `).get(user.storeId) as { v: number };
        const actualRow = sqlite3.prepare(`
          SELECT COALESCE(SUM(total_amount),0) AS v FROM orders
          WHERE store_id = ? AND status != 'refunded'
        `).get(user.storeId) as { v: number };
        const aiRow = sqlite3.prepare(`
          SELECT COALESCE(SUM(total_amount),0) AS v FROM orders
          WHERE store_id = ? AND status != 'refunded' AND attribution = 'ai_recall'
        `).get(user.storeId) as { v: number };
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
          predictedRevenue: Math.round(predicted.v),
          actualRevenue: Math.round(actualRow.v),
          incrementalRevenue: Math.round(aiRow.v),
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
