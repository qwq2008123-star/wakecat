import { ensureSeeded, ensureSalesSeed } from "./seed-data";
import { startScheduler } from "./scheduler";

declare global {
  // eslint-disable-next-line no-var
  var __wxCatBootstrapped: Promise<void> | undefined;
}

/** 幂等引导:首次访问时自动建库、播种(演示数据带 is_demo 标记) */
export function ensureBootstrap(): Promise<void> {
  if (!globalThis.__wxCatBootstrapped) {
    globalThis.__wxCatBootstrapped = (async () => {
      ensureSeeded();
      ensureSalesSeed(); // 服务目录/排班/授权账本:可对旧库增量补充
      // 启动恢复:上次进程可能在任务执行中重启——把滞留的 running 任务标为暂停,避免假状态
      try {
        const { sqlite } = await import("./db/client");
        const stuck = sqlite.prepare("SELECT id FROM tasks WHERE status='running'").all() as { id: string }[];
        for (const t of stuck) {
          sqlite.prepare("UPDATE tasks SET status='paused', updated_at=datetime('now') WHERE id=?").run(t.id);
          sqlite.prepare("INSERT INTO task_logs (id, task_id, agent, step, status, message, created_at) VALUES (?,?,?,?,?,?,datetime('now'))")
            .run(`tl_recover_${t.id.slice(5, 13)}`, t.id, "喵老板", "服务器重启中断", "error", "服务器重启时任务正在执行,已标记暂停;可从任务卡片恢复执行");
        }
      } catch { /* 首次建库时表尚不存在,跳过 */ }
      startScheduler();  // 后台调度:猫咪每日衰减 + 机会池扫描(事件驱动 + 定时)
    })();
  }
  return globalThis.__wxCatBootstrapped;
}
