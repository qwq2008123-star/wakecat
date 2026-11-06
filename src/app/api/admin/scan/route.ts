import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { requireUser } from "@/lib/session";
import { decayAllCats } from "@/lib/cats/engine";
import { runOpportunityScan } from "@/lib/sales/opportunity-engine";

/** 手动触发后台扫描:猫咪每日衰减 + 侦探喵机会池扫描(生产环境由定时任务调用) */
export async function POST() {
  await ensureBootstrap();
  const user = await requireUser();
  const decayed = decayAllCats(user.storeId);
  const scan = runOpportunityScan(user.storeId);
  return NextResponse.json({
    ok: true,
    catsDecayed: decayed,
    membersScanned: scan.scanned,
    blockedByConsent: scan.blocked,
    opportunities: scan.opportunities.length,
  });
}
