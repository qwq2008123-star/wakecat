"use client";

/* AI 员工中心:喵老板 + 四位专业员工,点击进入工作台 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import { DemoTag, PageHeader, StatusDot } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { Employee } from "@/mock-data/types";

function StatusText({ e }: { e: Employee }) {
  const color = e.status === "working" ? "var(--green)" : e.status === "waiting" ? "var(--yellow)" : "var(--ink-3)";
  const label = e.status === "working" ? "工作中" : e.status === "waiting" ? "待命中" : "休息中";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color }}>
      <StatusDot color={color} pulse={e.status === "working"} /> {label}
    </span>
  );
}

export default function AgentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => { dataProvider.getEmployees().then(setEmployees); }, []);

  const boss = employees.find((e) => e.id === "boss");
  const staff = employees.filter((e) => e.id !== "boss");

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 员工中心"
        desc="他们是这支销售团队的五名正式员工:各有性格、各司其职、全部对结果负责。点击任意员工进入工作台。"
        right={<DemoTag label="演示角色" />}
      />

      {/* 喵老板 · 总控横幅 */}
      {boss && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Link
            href={`/agents/${boss.id}`}
            className="surface relative overflow-hidden flex items-center gap-5 p-5 md:p-6 group glow-brand block"
          >
            <div className="aurora" style={{ width: 300, height: 180, top: -70, left: "20%", background: "rgba(255,138,76,.15)" }} />
            <div className="relative transition-transform duration-300 group-hover:-translate-y-1 shrink-0">
              <CatCharacter colorway={boss.colorway} state="awake" accessory={boss.accessory} size={110} working />
            </div>
            <div className="relative min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[11px] font-bold tracking-[.25em] px-2 py-0.5 rounded-md" style={{ background: "rgba(255,138,76,.14)", color: "var(--orange)" }}>总控 AI</span>
                <h2 className="text-[19px] font-extrabold">{boss.name}</h2>
                <StatusText e={boss} />
              </div>
              <p className="text-[13px] mt-1.5 max-w-[560px]" style={{ color: "var(--ink-2)" }}>{boss.personality}</p>
              <p className="text-[12.5px] mt-2.5 font-semibold">{boss.currentTask}</p>
              <div className="text-[11.5px] mt-2 flex gap-4" style={{ color: "var(--ink-3)" }}>
                <span>今日完成 {boss.tasksDoneToday} 项</span>
                <span>管理 4 名员工</span>
                <span>直接向老板娘汇报</span>
              </div>
            </div>
            <ArrowUpRight className="ml-auto hidden md:block shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" size={22} style={{ color: "var(--brand-2)" }} />
          </Link>
        </motion.div>
      )}

      {/* 四位专业员工 */}
      <div className="grid sm:grid-cols-2 gap-4">
        {staff.map((e, i) => (
          <motion.div
            key={e.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 * i }}
          >
            <Link href={`/agents/${e.id}`} className="surface p-5 flex gap-4 group block hover:-translate-y-0.5 transition-transform">
              <div className="shrink-0 transition-transform duration-300 group-hover:-translate-y-1">
                <CatCharacter
                  colorway={e.colorway} accessory={e.accessory} size={88}
                  state={e.status === "working" ? "awake" : e.status === "waiting" ? "drowsy" : "sleep"}
                  working={e.status === "working"}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[16px] font-extrabold">{e.name}</h3>
                  <StatusText e={e} />
                </div>
                <div className="text-[12px] font-semibold mt-0.5" style={{ color: "var(--brand-2)" }}>{e.title}</div>
                <p className="text-[12.5px] mt-1.5 line-clamp-2" style={{ color: "var(--ink-2)" }}>{e.personality}</p>
                <p className="text-[12.5px] mt-2 font-medium truncate">
                  <span style={{ color: "var(--ink-3)" }}>正在:</span>{e.currentTask}
                </p>
                <div className="text-[11.5px] mt-2 flex gap-4" style={{ color: "var(--ink-3)" }}>
                  <span>今日完成 {e.tasksDoneToday} 项</span>
                  <span>工具 ×{e.tools.length}</span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
