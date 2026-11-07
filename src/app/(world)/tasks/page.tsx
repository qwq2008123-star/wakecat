"use client";

/* AI 任务大厅:给喵老板下目标 → AI 团队编排 → 你批准 → 销售喵真实执行(半自动触达) */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleCheck, CircleX, Pause, Info, SendHorizonal, Loader2, Play } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import { DemoTag, PageHeader } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { TaskStatus, WakeTask } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

type AgentEvent =
  | { type: "stage"; stage: string; label: string; status: "start" | "ok" | "error"; engine?: string }
  | { type: "log"; agent: string; step: string; message?: string; tool?: string; detail?: string }
  | { type: "done"; taskId: string; title: string; status: string; summary: string };

/** 读 SSE 流(fetch + getReader;POST 不能用 EventSource) */
async function runSSE(url: string, body: object, onEvent: (e: AgentEvent) => void): Promise<AgentEvent[]> {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `接口错误 ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: AgentEvent[] = [];
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) {
      const line = p.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const e = JSON.parse(line.slice(6)) as AgentEvent;
        events.push(e);
        onEvent(e);
      } catch { /* 跳过不完整帧 */ }
    }
  }
  return events;
}

const STATUS_META: Record<TaskStatus, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "" },
  pending_approval: { label: "待审批", cls: "tag-yellow" },
  approved: { label: "已批准", cls: "tag-blue" },
  running: { label: "执行中", cls: "tag-brand" },
  paused: { label: "已暂停", cls: "" },
  completed: { label: "已完成", cls: "tag-green" },
  rejected: { label: "已驳回", cls: "tag-red" },
  failed: { label: "失败", cls: "tag-red" },
};

const RISK_META = { low: { label: "低风险", cls: "tag-green" }, mid: { label: "中风险", cls: "tag-yellow" }, high: { label: "高风险", cls: "tag-red" } } as const;

const FILTERS: { key: TaskStatus | "all"; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending_approval", label: "待审批" },
  { key: "running", label: "执行中" },
  { key: "paused", label: "已暂停" },
  { key: "completed", label: "已完成" },
  { key: "rejected", label: "已驳回" },
];

function TaskCard({ task, onDecide, onExecute, execBusy, execLogs, expanded, onToggle }: {
  task: WakeTask;
  onDecide: (id: string, s: TaskStatus) => void;
  onExecute: (id: string) => void;
  execBusy: boolean; execLogs: string[];
  expanded: boolean; onToggle: () => void;
}) {
  const owner = EMPLOYEE_MAP[task.ownerId];
  const sm = STATUS_META[task.status];
  return (
    <motion.div layout className="surface overflow-hidden">
      <button className="w-full text-left p-5 flex flex-wrap items-center gap-x-5 gap-y-3 bg-transparent border-0 cursor-pointer" onClick={onToggle}>
        {/* 主办员工 */}
        <CatCharacter colorway={owner.colorway} state="awake" accessory={owner.accessory} size={54} />
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <b className="text-[15px]">{task.name}</b>
            <span className="tag tag-brand">{task.kind}</span>
            <span className={`tag ${sm.cls}`}>{sm.label}</span>
            <span className={`tag ${RISK_META[task.risk].cls}`}>{RISK_META[task.risk].label}</span>
          </div>
          <div className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
            {owner.name} 主办 · 目标 {task.targetCount} 人:{task.memberNames.slice(0, 4).join("、")}{task.memberNames.length > 4 ? " 等" : ""}
          </div>
        </div>
        <div className="flex items-center gap-6 text-[13px]">
          <div className="text-right">
            <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>成本</div>
            <b style={{ color: "var(--red)" }}>¥{task.cost}</b>
          </div>
          <div className="text-right">
            <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>预估回流</div>
            <b style={{ color: "var(--green)" }}>¥{task.expectedRevenue}</b>
          </div>
          <div className="hidden md:block w-[130px]">
            <div className="flex justify-between text-[11px] mb-1" style={{ color: "var(--ink-3)" }}>
              <span>进度</span><span>{task.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
              <motion.div
                className="h-full rounded-full"
                animate={{ width: `${task.progress}%` }}
                style={{ background: "linear-gradient(90deg, var(--brand), var(--orange))" }}
              />
            </div>
          </div>
          <motion.span animate={{ rotate: expanded ? 180 : 0 }} style={{ color: "var(--ink-3)" }}>
            <ChevronDown size={17} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }} className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1" style={{ borderTop: "1px dashed var(--line)" }}>
              {/* 执行链路 */}
              <div className="flex items-center gap-0 mt-4 mb-5 overflow-x-auto">
                {task.steps.map((s, i) => (
                  <div key={s.name} className="flex items-center shrink-0">
                    <div className="flex flex-col items-center gap-1.5 px-3">
                      <span
                        className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold"
                        style={s.done
                          ? { background: "var(--green)", color: "#06251a" }
                          : { border: "1.5px solid var(--line)", color: "var(--ink-3)" }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-[11px]" style={{ color: s.done ? "var(--ink)" : "var(--ink-3)" }}>{s.name}</span>
                    </div>
                    {i < task.steps.length - 1 && (
                      <div className="w-8 h-px mb-5" style={{ background: s.done ? "var(--green)" : "var(--line)" }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 text-[12px] mb-4" style={{ color: "var(--ink-2)" }}>
                <Info size={13} className="shrink-0 mt-0.5" />
                <span>{task.engineNote}。</span>
              </div>
              {/* 操作区 */}
              <div className="flex flex-wrap gap-2">
                {task.status === "pending_approval" && (
                  <>
                    <button className="btn btn-green btn-sm" onClick={(e) => { e.stopPropagation(); onDecide(task.id, "approved"); }}>
                      <CircleCheck size={13} /> 批准执行
                    </button>
                    <button className="btn btn-red btn-sm" onClick={(e) => { e.stopPropagation(); onDecide(task.id, "rejected"); }}>
                      <CircleX size={13} /> 驳回
                    </button>
                  </>
                )}
                {task.status === "approved" && (
                  <button className="btn btn-orange btn-sm" disabled={execBusy}
                    onClick={(e) => { e.stopPropagation(); onExecute(task.id); }}>
                    {execBusy ? <Loader2 size={13} className="anim-spin" /> : null}
                    {execBusy ? "销售喵执行中…" : "开始执行(销售喵真实触达)"}
                  </button>
                )}
                {task.status === "running" && (
                  <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDecide(task.id, "paused"); }}>
                    <Pause size={13} /> 暂停
                  </button>
                )}
                {task.status === "paused" && (
                  <button className="btn btn-orange btn-sm" onClick={(e) => { e.stopPropagation(); onDecide(task.id, "running"); }}>
                    恢复执行
                  </button>
                )}
                <span className="text-[11.5px] self-center ml-1" style={{ color: "var(--ink-3)" }}>
                  执行会真实创建触达消息(半自动:AI 起草 → 你复制去企微发送)
                </span>
              </div>
              {execLogs.length > 0 && (
                <div className="panel2 mt-4 p-3.5 max-h-[240px] overflow-y-auto rounded-xl">
                  {execLogs.map((l, i) => (
                    <div key={i} className="mono text-[11.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<WakeTask[]>([]);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [goalBusy, setGoalBusy] = useState(false);
  const [goalLogs, setGoalLogs] = useState<string[]>([]);
  const [execBusyId, setExecBusyId] = useState<string | null>(null);
  const [execLogs, setExecLogs] = useState<Record<string, string[]>>({});
  const goalBoxRef = useRef<HTMLDivElement>(null);

  const refresh = () => dataProvider.getTasks().then(setTasks);
  useEffect(() => { refresh(); }, []);
  useEffect(() => { goalBoxRef.current?.scrollTo({ top: goalBoxRef.current.scrollHeight }); }, [goalLogs]);

  async function decide(id: string, status: TaskStatus) {
    await dataProvider.setTaskStatus(id, status);
    refresh();
    if (status === "approved") setExpandedId(id);
  }

  /* 下达目标 → 喵老板编排(SSE 直播:侦探体检 → 军师策略 → 待审批;全自动开启时一跑到底) */
  const DEMO_GOAL = "把 45 天没来的高价值会员唤回来,预算 50 元";
  async function submitGoal(textArg?: string) {
    const g = (textArg ?? goal).trim();
    if (!g || goalBusy) return;
    setGoalBusy(true); setGoalLogs([`▶ 你对喵老板说:「${g}」`]);
    try {
      const events = await runSSE("/api/goal", { goal: g }, (e) => {
        setGoalLogs((prev) => [...prev, formatEvent(e)]);
      });
      const done = events.find((e) => e.type === "done");
      if (done?.taskId) {
        setGoal("");
        await refresh();
        setFilter("pending_approval");
        setExpandedId(done.taskId);
      }
    } catch (e) {
      setGoalLogs((prev) => [...prev, `✗ ${e instanceof Error ? e.message : "执行失败"}`]);
    } finally { setGoalBusy(false); }
  }

  /* 批准后执行 → 销售喵真实触达(三闸门 → 半自动通道)→ 财务喵复盘 */
  async function executeTask(id: string) {
    if (execBusyId) return;
    setExecBusyId(id);
    setExecLogs((p) => ({ ...p, [id]: [`▶ 销售喵开始执行…`] }));
    try {
      const events = await runSSE(`/api/tasks/${id}/execute`, {}, (e) => {
        setExecLogs((p) => ({ ...p, [id]: [...(p[id] ?? []), formatEvent(e)] }));
      });
      const done = events.find((e) => e.type === "done");
      if (done) {
        setExecLogs((p) => ({ ...p, [id]: [...(p[id] ?? []),
          done.status === "completed"
            ? "✓ 执行完成——去「驾驶舱」今日行动清单,复制文案去企微发送"
            : `✗ 执行结束:${done.summary}`] }));
      }
      await refresh();
    } catch (e) {
      setExecLogs((p) => ({ ...p, [id]: [...(p[id] ?? []), `✗ ${e instanceof Error ? e.message : "执行失败"}`] }));
    } finally { setExecBusyId(null); }
  }

  const list = useMemo(
    () => tasks.filter((t) => filter === "all" || t.status === filter),
    [tasks, filter],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI 任务大厅"
        desc="给喵老板下一句目标,它带队体检会员、定策略;对外触达必须经你批准,执行走半自动通道(你亲自去企微发送)。"
        right={<DemoTag label="真实任务" />}
      />

      {/* ① 给喵老板下目标 */}
      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-2.5">
          <CatCharacter colorway="orange" state="awake" accessory="crown" size={30} />
          <b className="text-[14px]">给喵老板下达经营目标</b>
          <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>它拆解任务 → 侦探喵体检 → 军师喵出策略 → 回到这里等你批准</span>
        </div>
        <div className="flex gap-2">
          <input
            className="input" value={goal} disabled={goalBusy}
            placeholder="例:把 45 天没来的高价值会员唤回来,预算 50 元"
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitGoal(); }}
          />
          <button className="btn shrink-0" onClick={() => void submitGoal()} disabled={!goal.trim() || goalBusy}>
            {goalBusy ? <Loader2 size={14} className="anim-spin" /> : <SendHorizonal size={14} />} 下达
          </button>
          <button className="btn btn-ghost shrink-0" disabled={goalBusy}
            title={`预置目标「${DEMO_GOAL}」一键下达;全自动模式开启时直达触达`}
            onClick={() => { setGoal(DEMO_GOAL); void submitGoal(DEMO_GOAL); }}>
            <Play size={14} /> 一键演示
          </button>
        </div>
        {goalLogs.length > 0 && (
          <div ref={goalBoxRef} className="panel2 mt-3 p-3.5 max-h-[220px] overflow-y-auto rounded-xl">
            {goalLogs.map((l, i) => (
              <div key={i} className="mono text-[11.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{l}</div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          const count = f.key === "all" ? tasks.length : tasks.filter((t) => t.status === f.key).length;
          return (
            <button
              key={f.key} onClick={() => setFilter(f.key)} className="tag transition-all"
              style={active ? { color: "var(--brand-2)", borderColor: "var(--brand)", background: "rgba(124,108,255,.1)" } : {}}
            >
              {f.label} · {count}
            </button>
          );
        })}
      </div>
      <div className="space-y-3.5">
        <AnimatePresence initial={false}>
          {list.map((t) => (
            <TaskCard
              key={t.id} task={t}
              onDecide={decide}
              onExecute={executeTask}
              execBusy={execBusyId === t.id}
              execLogs={execLogs[t.id] ?? []}
              expanded={expandedId === t.id}
              onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
            />
          ))}
        </AnimatePresence>
        {list.length === 0 && (
          <div className="surface p-10 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
            该状态下暂无任务
          </div>
        )}
      </div>
    </div>
  );
}

function formatEvent(e: AgentEvent): string {
  if (e.type === "stage") {
    const mark = e.status === "ok" ? "✓" : e.status === "error" ? "✗" : "▸";
    return `${mark} ${e.label}${e.engine ? `(${e.engine})` : ""}`;
  }
  if (e.type === "log") {
    const bits = [e.agent ? `【${e.agent}】` : "", e.step ? `${e.step}:` : "", e.message ?? ""];
    return bits.filter(Boolean).join(" ");
  }
  return e.type === "done" ? `✓ ${e.summary}` : "";
}
