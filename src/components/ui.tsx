import { CatState } from "@/lib/queries";

export const STATE_META: Record<CatState, { label: string; cls: string; icon: string; cat: "sleep" | "drowsy" | "awake" | "happy" }> = {
  active: { label: "活跃", cls: "tag-green", icon: "🐟", cat: "happy" },
  drowsy: { label: "打瞌睡", cls: "tag-yellow", icon: "😪", cat: "drowsy" },
  hibernate: { label: "冬眠", cls: "tag-blue", icon: "❄️", cat: "sleep" },
  sick: { label: "卡快过期", cls: "tag-red", icon: "😿", cat: "sleep" },
};

export function StateBadge({ state }: { state: CatState }) {
  const m = STATE_META[state];
  return <span className={`tag ${m.cls}`}>{m.icon} {m.label}</span>;
}

export function DemoBadge() {
  return <span className="tag tag-yellow" title="种子数据,非真实会员">演示数据</span>;
}

export function EngineBadge({ engine }: { engine: string }) {
  return engine === "llm"
    ? <span className="tag tag-purple">✦ LLM</span>
    : <span className="tag">⚙ 规则引擎</span>;
}

export const TASK_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "" },
  pending_approval: { label: "待审批", cls: "tag-yellow" },
  approved: { label: "已批准", cls: "tag-blue" },
  rejected: { label: "已驳回", cls: "tag-red" },
  running: { label: "执行中", cls: "tag-purple" },
  completed: { label: "已完成", cls: "tag-green" },
  failed: { label: "失败", cls: "tag-red" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const m = TASK_STATUS_META[status] ?? { label: status, cls: "" };
  return <span className={`tag ${m.cls}`}>{m.label}</span>;
}

export function IntentBadge({ intent }: { intent: string | null }) {
  if (!intent) return null;
  const map: Record<string, { t: string; c: string }> = {
    accept: { t: "😊 有意向", c: "tag-green" },
    price: { t: "💰 问价格", c: "tag-yellow" },
    decline: { t: "🙃 暂无意向", c: "" },
  };
  const m = map[intent] ?? { t: intent, c: "" };
  return <span className={`tag ${m.c}`}>{m.t}</span>;
}
