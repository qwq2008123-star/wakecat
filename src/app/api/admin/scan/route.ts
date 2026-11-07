import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { requireUser } from "@/lib/session";
import { decayAllCats } from "@/lib/cats/engine";
import { runCatMissCheck } from "@/lib/cats/miss";
import { runOpportunityScan } from "@/lib/sales/opportunity-engine";

/**
 * 后台扫描:猫咪每日衰减 + 猫想念检查 + 侦探喵机会池扫描。
 * 两种调用方式:
 * 1) Vercel Cron(每小时):携带 Authorization: Bearer $CRON_SECRET(Vercel 自动注入)
 * 2) B端手动触发:requireUser 会话
 */
export async function POST(req: Request) {
  await ensureBootstrap();
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const isCron = Boolean(cronSecret) && auth === `Bearer ${cronSecret}`;
  if (!isCron) await requireUser();
  const storeId = (await import("@/lib/store")).resolveStore((await import("@/lib/store")).DEFAULT_STORE_SLUG)?.id;
  if (!storeId) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const decayed = decayAllCats(storeId);
  const scan = runOpportunityScan(storeId);
  const miss = await runCatMissCheck(storeId);
  return NextResponse.json({
    ok: true,
    catsDecayed: decayed,
    membersScanned: scan.scanned,
    blockedByConsent: scan.blocked,
    opportunities: scan.opportunities.length,
    catMissSent: miss.sent,
  });
}
