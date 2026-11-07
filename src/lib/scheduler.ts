import { decayAllCats } from "./cats/engine";
import { runCatMissCheck, runCatFollowUps } from "./cats/miss";
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

export async function runScheduledJobs(): Promise<{
  catsDecayed: number; membersScanned: number; blocked: number; opportunities: number; catMissSent: number; followSent: number;
}> {
  const store = resolveStore(DEFAULT_STORE_SLUG);
  if (!store) return { catsDecayed: 0, membersScanned: 0, blocked: 0, opportunities: 0, catMissSent: 0, followSent: 0 };
  const catsDecayed = decayAllCats(store.id);
  const scan = runOpportunityScan(store.id);
  const miss = await runCatMissCheck(store.id); // 主人 30 天没来,猫主动发想念消息(7天/条防打扰)
  const follow = await runCatFollowUps(store.id); // 收藏/意图的陪伴式跟进(2天节流)
  globalThis.__wxCatLastScan = new Date().toISOString();
  return { catsDecayed, membersScanned: scan.scanned, blocked: scan.blocked, opportunities: scan.opportunities.length, catMissSent: miss.sent, followSent: follow.sent };
}

export function startScheduler() {
  if (globalThis.__wxCatScheduler) return;
  // 首次立即执行一次(建库后种子已就绪)
  void runScheduledJobs().catch(() => { /* 首次建库中,忽略 */ });
  globalThis.__wxCatScheduler = setInterval(() => {
    void runScheduledJobs().catch(() => { /* 单次失败不影响后续 */ });
  }, 60 * 60 * 1000); // 每小时
}
