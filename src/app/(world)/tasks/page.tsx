"use client";

/* AI 任务大厅:AI 发现的经营机会,批准/拒绝/暂停通过前端状态机演示 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleCheck, CircleX, Pause, Info } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import { DemoTag, PageHeader } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { TaskStatus, WakeTask } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

const STATUS_META: Record<TaskStatus, { label: string; cls: string }> = {
  pending_approval: { label: "待审批", cls: "tag-yellow" },
  approved: { label: "已批准", cls: "tag-blue" },
  running: { label: "执行中", cls: "tag-brand" },
  paused: { label: "已暂停", cls: "" },
  completed: { label: "已完成", cls: "tag-green" },
  rejected: { label: "已驳回", cls: "tag-red" },
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

function TaskCard({ task, onDecide, expanded, onToggle }: {
  task: WakeTask; onDecide: (id: string, s: TaskStatus) => void;
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
                  <button className="btn btn-orange btn-sm" onClick={(e) => { e.stopPropagation(); onDecide(task.id, "running"); }}>
                    开始执行
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
                  状态变更即时生效,刷新页面恢复演示初始状态
                </span>
              </div>
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

  useEffect(() => { dataProvider.getTasks().then(setTasks); }, []);

  async function decide(id: string, status: TaskStatus) {
    setTasks(await dataProvider.setTaskStatus(id, status));
  }

  const list = useMemo(
    () => tasks.filter((t) => filter === "all" || t.status === filter),
    [tasks, filter],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI 任务大厅"
        desc="AI 员工主动发现经营机会并立项;所有对外触达都要在这里经你批准。批准、拒绝、暂停的流转在本页即时演示。"
        right={<DemoTag label="演示任务" />}
      />
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
