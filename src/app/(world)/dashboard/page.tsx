"use client";

/* 驾驶舱 v4:第一屏 = 今日行动清单。真实工作流——每个动作都有真实后果。 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Target } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import OfficeScene from "@/components/world/OfficeScene";
import CustomerEntryCard from "@/components/world/CustomerEntryCard";
import ActionList from "@/components/world/ActionList";
import { StatTile } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { deriveActivities } from "@/lib/activity";
import { DashboardData, Employee, WakeTask } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

const fmt = (n: number) => n.toLocaleString("zh-CN");

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<WakeTask[]>([]);
  const [actionRefresh, setActionRefresh] = useState(0);

  useEffect(() => {
    (async () => {
      const [d, e, t] = await Promise.all([
        dataProvider.getDashboard(), dataProvider.getEmployees(), dataProvider.getTasks(),
      ]);
      setData(d); setEmployees(e); setTasks(t);
    })();
  }, [actionRefresh]);

  const activities = useMemo(() => deriveActivities(tasks), [tasks]);
  const workingCount = Object.values(activities).filter((a) => a !== "idle").length;

  if (!data) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="flex flex-col items-center gap-3" style={{ color: "var(--ink-2)" }}>
          <CatCharacter state="awake" colorway="orange" accessory="crown" size={64} working />
          <span className="text-[13px] anim-breathe">AI 团队正在打卡上班…</span>
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const health = [
    { label: "活跃", v: k.activeMembers, color: "var(--green)" },
    { label: "沉睡", v: k.sleepingMembers, color: "var(--brand-2)" },
    { label: "高风险", v: k.highRiskMembers, color: "var(--red)" },
  ];
  const healthTotal = health.reduce((s, x) => s + x.v, 0);

  return (
    <div className="space-y-5">
      {/* ① 今日行动清单(第一屏核心) */}
      <div className="surface p-5">
        <ActionList refreshKey={actionRefresh} />
      </div>

      {/* ② 今日目标 + 喵老板简报 */}
      <div className="surface relative overflow-hidden p-6">
        <div className="aurora" style={{ width: 360, height: 210, top: -100, left: "8%", background: "rgba(124,108,255,.2)" }} />
        <div className="relative grid lg:grid-cols-[1fr_380px] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={15} style={{ color: "var(--brand-2)" }} />
              <span className="text-[12px] font-semibold tracking-wide" style={{ color: "var(--brand-2)" }}>WAKECAT 每日开工</span>
            </div>
            <h1 className="text-[21px] md:text-[24px] font-extrabold leading-snug">{data.greeting}</h1>
            <div className="mt-3 inline-flex items-center gap-2.5 surface-2 px-4 py-2.5 text-[13.5px]">
              <Target size={15} style={{ color: "var(--orange)" }} />
              <span style={{ color: "var(--ink-2)" }}>今日经营目标</span>
              <span className="font-bold">{data.goal}</span>
            </div>
          </div>
          <div className="relative flex gap-3 items-start">
            <div className="shrink-0 -mt-6"><CatCharacter colorway="orange" state="awake" accessory="crown" size={72} /></div>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="panel2 p-3.5 text-[12.5px] leading-relaxed rounded-tl-none relative"
            >
              <span className="absolute -left-2 top-3 w-3 h-3 rotate-45" style={{ background: "var(--panel-2)", borderLeft: "1px solid var(--line-soft)", borderBottom: "1px solid var(--line-soft)" }} />
              <b className="block mb-1" style={{ color: "var(--orange)" }}>喵老板今日简报</b>
              {data.briefing}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ③ 核心数据(一行) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="surface p-4">
          <div className="text-[11.5px] font-medium" style={{ color: "var(--ink-2)" }}>会员健康度 · {fmt(k.totalMembers)} 人</div>
          <div className="mt-2.5 flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {health.map((h) => (
              <motion.div key={h.label} initial={{ width: 0 }} animate={{ width: `${healthTotal > 0 ? (h.v / healthTotal) * 100 : 0}%` }} transition={{ duration: 0.7 }}
                style={{ background: h.color, borderRadius: 4 }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
            {health.map((h) => (
              <span key={h.label} className="inline-flex items-center gap-1" style={{ color: "var(--ink-2)" }}>
                <i className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: h.color }} />
                {h.label} <b style={{ color: "var(--ink)" }}>{fmt(h.v)}</b>
              </span>
            ))}
          </div>
        </div>
        <StatTile label="本月唤醒会员" value={fmt(k.awakenedThisMonth)} accent="var(--yellow)" sub="成功回流到店" />
        <StatTile label="本月回流消费" value={`¥${fmt(k.monthRevenue)}`} accent="var(--green)" sub="唤回到店实际消费" />
        <StatTile label="营销成本" value={`¥${fmt(k.monthCost)}`} sub={k.monthCost > 0 ? `产出比 ${(k.monthRevenue / k.monthCost).toFixed(1)} 倍` : "暂无支出"} />
      </div>

      {/* 猫咪生命周期(WAKE LIFE ENGINE) */}
      {data.catLife && (
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold">猫咪生命周期</h2>
            <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>WAKE LIFE ENGINE · 真实能量账本</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
            {[
              { l: "活力中", v: data.catLife.active, c: "var(--green)" },
              { l: "低能量/慵懒", v: data.catLife.low, c: "var(--yellow)" },
              { l: "休眠中", v: data.catLife.dormant, c: "var(--ink-3)" },
              { l: "近7天被唤醒", v: data.catLife.woken7d, c: "var(--brand-2)" },
            ].map((x) => (
              <div key={x.l} className="panel2 p-3">
                <div className="text-[18px] font-extrabold" style={{ color: x.c }}>{x.v}</div>
                <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{x.l}</div>
              </div>
            ))}
          </div>
          <div className="text-[11px] mb-1.5" style={{ color: "var(--ink-2)" }}>能量来源占比(累计)——消费是来源之一,不是全部</div>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {[
              { l: "真实消费", v: data.catLife.sources.order, c: "var(--green)" },
              { l: "聊天陪伴", v: data.catLife.sources.care, c: "var(--brand-2)" },
              { l: "分享灵感", v: data.catLife.sources.inspiration, c: "var(--yellow)" },
            ].map((x) => (
              <motion.div key={x.l} initial={{ width: 0 }} animate={{ width: `${x.v > 0 ? Math.max(4, (x.v / Math.max(1, data.catLife!.sources.order + data.catLife!.sources.care + data.catLife!.sources.inspiration)) * 100) : 0}%` }} transition={{ duration: 0.7 }}
                title={`${x.l} +${x.v}`} style={{ background: x.c, borderRadius: 4 }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px]" style={{ color: "var(--ink-3)" }}>
            <span>🟢 真实消费 <b style={{ color: "var(--foreground)" }}>+{data.catLife.sources.order}</b>({data.catLife.orderPct}%)</span>
            <span>🟣 聊天陪伴 <b style={{ color: "var(--foreground)" }}>+{data.catLife.sources.care}</b>({data.catLife.carePct}%)</span>
            <span>🟡 分享灵感 <b style={{ color: "var(--foreground)" }}>+{data.catLife.sources.inspiration}</b>({data.catLife.inspirationPct}%)</span>
          </div>
        </div>
      )}

      {/* ④ AI 员工办公室 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold tracking-wide">AI 员工办公室</h2>
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            <b style={{ color: "var(--green)" }}>{workingCount}</b> / 5 在岗 · 悬停查看 · 点击进工作台
          </span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {employees.map((e) => {
            const a = activities[e.id];
            const m = a === "idle" ? "空闲" : a === "analyzing" ? "分析中" : a === "planning" ? "规划中" : a === "executing" ? "执行中" : "已交付";
            return (
              <div key={e.id} className="surface-2 px-3 py-1.5 flex items-center gap-2">
                <span className="inline-flex w-2 h-2 relative">
                  {a !== "idle" && <span className="absolute inset-0 rounded-full" style={{ background: "var(--green)", animation: "pulse-ring 1.8s ease-out infinite" }} />}
                  <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: a !== "idle" ? "var(--green)" : "var(--ink-3)" }} />
                </span>
                <span className="text-[12px] font-semibold">{e.name}</span>
                <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{m}</span>
              </div>
            );
          })}
        </div>
        <OfficeScene employees={employees} activities={activities} />
      </div>

      {/* ⑤ 接待入口 */}
      <CustomerEntryCard storeSlug="miaowu" />

      {/* ⑥ 今日经营结果 + 工作日志(次级) */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold">今日经营结果</h2>
            <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>真实订单口径</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="panel2 p-3">
              <div className="text-[18px] font-extrabold" style={{ color: "var(--green)" }}>¥{fmt(k.monthRevenue)}</div>
              <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>回流消费</div>
            </div>
            <div className="panel2 p-3">
              <div className="text-[18px] font-extrabold" style={{ color: "var(--yellow)" }}>{fmt(k.awakenedThisMonth)}</div>
              <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>唤醒成功</div>
            </div>
          </div>
        </div>
        <div className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-bold">今日工作日志</h2>
            <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>实时滚动</span>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {data.logs.map((l, i) => {
              const emp = EMPLOYEE_MAP[l.employeeId as keyof typeof EMPLOYEE_MAP];
              if (!emp) return null;
              return (
                <motion.div key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }} className="flex gap-2.5">
                  <CatCharacter colorway={emp.colorway} state="awake" accessory={null} size={26} />
                  <div className="min-w-0">
                    <div className="text-[12.5px] leading-snug">
                      <b className="mr-1.5">{emp.name}</b>
                      <span style={{ color: "var(--ink-2)" }}>{l.text}</span>
                    </div>
                    <div className="mono mt-0.5" style={{ color: "var(--ink-3)" }}>{l.time}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
