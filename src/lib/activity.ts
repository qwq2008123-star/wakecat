import { EmployeeId, TaskStatus, WakeTask } from "@/mock-data/types";

/* ============================================================
   员工工作状态:完全由任务状态推导,不做任何"假动画"。
   办公室的屏幕内容、策略面板、消息气泡都跟随这里的输出。
   ============================================================ */
export type Activity = "idle" | "analyzing" | "planning" | "executing" | "done";

export const ACTIVITY_META: Record<Activity, { label: string; color: string; desc: string }> = {
  idle: { label: "空闲待命", color: "var(--ink-3)", desc: "工位待机,屏幕休眠" },
  analyzing: { label: "分析中", color: "var(--blue)", desc: "数据屏幕滚动,正在体检会员档案" },
  planning: { label: "规划中", color: "var(--brand-2)", desc: "策略面板展开,正在撰写唤醒方案" },
  executing: { label: "执行中", color: "var(--green)", desc: "消息终端活跃,正在触达会员" },
  done: { label: "已交付", color: "var(--yellow)", desc: "本轮工作完成,等待验收入账" },
};

export function deriveActivities(tasks: WakeTask[]): Record<EmployeeId, Activity> {
  const has = (s: TaskStatus) => tasks.some((t) => t.status === s);
  return {
    boss: has("running") ? "executing" : has("pending_approval") ? "planning" : has("completed") ? "done" : "idle",
    detective: has("pending_approval") || has("approved") ? "analyzing" : "idle",
    strategist: has("pending_approval") ? "planning" : has("running") ? "planning" : "idle",
    seller: has("running") || has("approved") ? "executing" : "idle",
    accountant: has("completed") ? "done" : "idle",
  };
}

/** 状态条上的一句话说明 */
export function activityLine(a: Activity, name: string): string {
  const m = ACTIVITY_META[a];
  return `${name} · ${m.label}`;
}
