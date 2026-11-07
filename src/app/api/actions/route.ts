import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { filterProcessed, generateDailyActions } from "@/lib/actions/generator";

/** 今日行动清单:从真实业务数据派生(已处理的会被过滤) */
export async function GET() {
  await ensureBootstrap();
  const user = await requireUser();
  const all = generateDailyActions(user.storeId);
  const items = filterProcessed(all, user.storeId);
  return NextResponse.json({
    items,
    pendingCount: items.filter((i) => i.type === "approval").length,
    date: new Date().toISOString().slice(0, 10),
  });
}
