import { decayAllCats } from "./cats/engine";
import { runOpportunityScan } from "./sales/opportunity-engine";
import { DEFAULT_STORE_SLUG, resolveStore } from "./store";

/* ============================================================
   后台调度器(事件驱动 + 定时任务的最小实现)
   本地演示:进程内 setInterval(每小时);
   生产部署:替换为平台 Cron / 队列,业务逻辑不变(decayAllCats / runOpportunityScan)。
   猫咪的每日衰减也是「真实数据事件」——不是随机动画。
   ============================================================ */

declare global {
  // eslint-disable-next-line no-var
  var __wxCatScheduler: NodeJS.Timeout | undefined;
  // eslint-disable-next-line no-var
  var __wxCatLastScan: string | undefined;
}

export function runScheduledJobs(): {
  catsDecayed: number; membersScanned: number; blocked: number; opportunities: number;
} {
  const store = resolveStore(DEFAULT_STORE_SLUG);
  if (!store) return { catsDecayed: 0, membersScanned: 0, blocked: 0, opportunities: 0 };
  const catsDecayed = decayAllCats(store.id);
  const scan = runOpportunityScan(store.id);
  globalThis.__wxCatLastScan = new Date().toISOString();
  return { catsDecayed, membersScanned: scan.scanned, blocked: scan.blocked, opportunities: scan.opportunities.length };
}

export function startScheduler() {
  if (globalThis.__wxCatScheduler) return;
  // 首次立即执行一次(建库后种子已就绪)
  try { runScheduledJobs(); } catch { /* 首次建库中,忽略 */ }
  globalThis.__wxCatScheduler = setInterval(() => {
    try { runScheduledJobs(); } catch { /* 单次失败不影响后续 */ }
  }, 60 * 60 * 1000); // 每小时
}
