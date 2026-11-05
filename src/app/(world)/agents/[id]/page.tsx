"use client";

/* 员工工作台:角色介绍 + 工具调用区 + 演示对话 + 执行日志 */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Wrench, ScrollText, MessageSquareText, LayoutPanelTop } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import DemoChat from "@/components/world/DemoChat";
import { DemoTag, StatusDot } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { Employee } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

const TABS = [
  { key: "work", label: "工作台", icon: LayoutPanelTop },
  { key: "chat", label: "对话窗口", icon: MessageSquareText },
  { key: "logs", label: "执行日志", icon: ScrollText },
] as const;

/* 模拟工具调用可视化(演示) */
function ToolCallSim({ tool }: { tool: { name: string; desc: string } }) {
  return (
    <motion.div
      className="panel2 p-3.5"
      initial={{ opacity: 0, borderColor: "rgba(124,108,255,.5)" }}
      whileHover={{ scale: 1.015 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2">
        <Wrench size={13} style={{ color: "var(--brand-2)" }} />
        <code className="mono text-[12px]" style={{ color: "var(--brand-2)" }}>{tool.name}()</code>
        <span className="ml-auto tag tag-green">只读</span>
      </div>
      <p className="text-[12px] mt-1.5" style={{ color: "var(--ink-2)" }}>{tool.desc}</p>
    </motion.div>
  );
}

export default function AgentWorkbenchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [emp, setEmp] = useState<Employee | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("work");

  useEffect(() => { dataProvider.getEmployee(id as Employee["id"]).then(setEmp); }, [id]);

  if (!emp) {
    return (
      <div className="min-h-[50vh] grid place-items-center" style={{ color: "var(--ink-2)" }}>
        <span className="anim-breathe text-[13px]">员工走向工位…</span>
      </div>
    );
  }
  const state = emp.status === "working" ? "awake" : emp.status === "waiting" ? "drowsy" : "sleep";

  return (
    <div className="space-y-5">
      <Link href="/agents" className="inline-flex items-center gap-1.5 text-[12.5px] hover:underline" style={{ color: "var(--ink-2)" }}>
        <ArrowLeft size={13} /> AI 员工中心
      </Link>

      {/* 角色头牌 */}
      <div className="surface relative overflow-hidden p-6 flex flex-wrap items-center gap-6">
        <div className="aurora" style={{ width: 320, height: 200, top: -80, left: "6%", background: "rgba(124,108,255,.18)" }} />
        <div className="relative anim-floaty shrink-0">
          <CatCharacter colorway={emp.colorway} state={state} accessory={emp.accessory} size={128} working={emp.status === "working"} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[24px] font-extrabold">{emp.name}</h1>
            <span className="tag tag-brand">{emp.title}</span>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: emp.status === "working" ? "var(--green)" : "var(--yellow)" }}>
              <StatusDot color={emp.status === "working" ? "var(--green)" : "var(--yellow)"} pulse={emp.status === "working"} />
              {emp.statusText}
            </span>
          </div>
          <p className="text-[13.5px] mt-2 max-w-[600px]" style={{ color: "var(--ink-2)" }}>{emp.personality}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {emp.duties.map((d) => <span key={d} className="tag">{d}</span>)}
          </div>
        </div>
        <div className="relative text-right shrink-0">
          <div className="text-[30px] font-extrabold" style={{ color: "var(--brand-2)" }}>{emp.tasksDoneToday}</div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>今日完成任务</div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex gap-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key} onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
              style={active
                ? { background: "rgba(124,108,255,.16)", color: "var(--brand-2)", boxShadow: "inset 0 0 0 1px rgba(124,108,255,.4)" }
                : { color: "var(--ink-2)", border: "1px solid transparent" }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "work" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-2 gap-4">
          <div className="surface p-5">
            <h3 className="text-[15px] font-bold mb-1">正在执行的任务</h3>
            <div className="panel2 p-4 mt-3">
              <p className="text-[14px] font-semibold">{emp.currentTask}</p>
              <div className="mt-3 flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
                <span className="tag tag-brand">{EMPLOYEE_MAP[emp.id].name}</span>
                <span>归属任务链:喵老板统一验收</span>
              </div>
            </div>
            <h3 className="text-[15px] font-bold mt-6 mb-3">工具调用区域(演示视图)</h3>
            <p className="text-[11.5px] mb-3" style={{ color: "var(--ink-3)" }}>
              这些是员工在真实执行时会调用的工具。接入 GLM 后,每次调用都会在这里实时展示入参与出参。
            </p>
            <div className="space-y-2.5">
              {emp.tools.map((t) => <ToolCallSim key={t.name} tool={t} />)}
            </div>
          </div>
          <div className="surface p-5">
            <h3 className="text-[15px] font-bold mb-3">角色档案</h3>
            <dl className="space-y-3 text-[13px]">
              <div className="panel2 p-3.5">
                <dt className="text-[11.5px] font-semibold mb-1" style={{ color: "var(--ink-3)" }}>职责范围</dt>
                <dd>{emp.duties.join(";")}。</dd>
              </div>
              <div className="panel2 p-3.5">
                <dt className="text-[11.5px] font-semibold mb-1" style={{ color: "var(--ink-3)" }}>性格底色</dt>
                <dd>{emp.personality}</dd>
              </div>
              <div className="panel2 p-3.5">
                <dt className="text-[11.5px] font-semibold mb-1" style={{ color: "var(--ink-3)" }}>协作关系</dt>
                <dd>产出交给喵老板验收;与其它员工通过任务链交接,不私下插单。</dd>
              </div>
            </dl>
          </div>
        </motion.div>
      )}

      {tab === "chat" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-[680px]">
          <DemoChat emp={emp} />
        </motion.div>
      )}

      {tab === "logs" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold">执行日志</h3>
            <DemoTag label="演示日志" />
          </div>
          <div className="relative pl-5 space-y-5">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: "var(--line)" }} />
            {emp.recentLogs.map((l, i) => (
              <motion.div
                key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }} className="relative"
              >
                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: "var(--brand)", boxShadow: "0 0 8px var(--glow-brand)" }} />
                <div className="text-[13.5px]">{l.text}</div>
                <div className="mono mt-0.5" style={{ color: "var(--ink-3)" }}>今日 {l.time}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
