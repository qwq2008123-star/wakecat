"use client";

/* 公司驾驶舱 v2:第一眼看到「目标 / AI 员工在做什么 / 待审批 / 今日结果」。
   员工工作状态由任务状态实时推导(见 lib/activity.ts),非装饰动画。 */
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Target, ChevronRight, CircleCheck, CircleX } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import OfficeScene from "@/components/world/OfficeScene";
import { DemoTag, SectionTitle, StatTile, StatusDot } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { deriveActivities, ACTIVITY_META } from "@/lib/activity";
import { DashboardData, Employee, FinanceSummary, TaskStatus, WakeTask } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

const fmt = (n: number) => n.toLocaleString("zh-CN");

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<WakeTask[]>([]);
  const [fin, setFin] = useState<FinanceSummary | null>(null);
  const [decided, setDecided] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [d, e, t, f] = await Promise.all([
        dataProvider.getDashboard(), dataProvider.getEmployees(),
        dataProvider.getTasks(), dataProvider.getFinance(),
      ]);
      setData(d); setEmployees(e); setTasks(t); setFin(f);
    })();
  }, []);

  async function decide(id: string, status: TaskStatus) {
    setDecided(id);
    const next = await dataProvider.setTaskStatus(id, status);
    setTimeout(() => { setTasks(next); setDecided(null); }, 650);
  }

  /* 员工活动:任务状态 → 工作状态(屏幕/面板/气泡全部跟随) */
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

  const pending = tasks.filter((t) => t.status === "pending_approval");
  const k = data.kpis;
  const health = [
    { label: "活跃", v: k.activeMembers, color: "var(--green)" },
    { label: "沉睡", v: k.sleepingMembers, color: "var(--brand-2)" },
    { label: "高风险", v: k.highRiskMembers, color: "var(--red)" },
  ];
  const healthTotal = health.reduce((s, x) => s + x.v, 0);

  return (
    <div className="space-y-5">
      {/* ① 欢迎区:目标 + 喵老板简报气泡 */}
      <div className="surface relative overflow-hidden p-6">
        <div className="aurora" style={{ width: 360, height: 210, top: -100, left: "8%", background: "rgba(124,108,255,.2)" }} />
        <div className="aurora" style={{ width: 300, height: 190, top: -80, right: "18%", background: "rgba(255,138,76,.14)" }} />
        <div className="relative grid lg:grid-cols-[1fr_380px] gap-5 items-center">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={15} style={{ color: "var(--brand-2)" }} />
              <span className="text-[12px] font-semibold tracking-wide" style={{ color: "var(--brand-2)" }}>WAKECAT 每日开工</span>
              <DemoTag />
            </div>
            <h1 className="text-[21px] md:text-[26px] font-extrabold leading-snug">
              {data.greeting.split("。")[0]}。
            </h1>
            <div className="mt-3.5 inline-flex items-center gap-2.5 surface-2 px-4 py-2.5 text-[13.5px]">
              <Target size={15} style={{ color: "var(--orange)" }} />
              <span style={{ color: "var(--ink-2)" }}>今日经营目标</span>
              <span className="font-bold">{data.goal}</span>
            </div>
          </div>
          {/* 喵老板简报(原独立面板并入英雄区) */}
          <div className="relative flex gap-3 items-start">
            <div className="shrink-0 -mt-6">
              <CatCharacter colorway="orange" state="awake" accessory="crown" size={72} />
            </div>
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

      {/* ② 核心数据(收敛为 4 块,7 个数字全保留) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-medium" style={{ color: "var(--ink-2)" }}>会员健康度 · {fmt(k.totalMembers)} 人</span>
            <DemoTag />
          </div>
          <div className="mt-2.5 flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {health.map((h) => (
              <motion.div key={h.label} initial={{ width: 0 }} animate={{ width: `${(h.v / healthTotal) * 100}%` }} transition={{ duration: 0.7 }}
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
        <StatTile label="本月唤醒会员" value={fmt(k.awakenedThisMonth)} accent="var(--yellow)"
          sub={<span>成功回流到店 · 环比 +12%(演示)</span> as never} />
        <StatTile label="本月回流消费" value={`¥${fmt(k.monthRevenue)}`} accent="var(--green)" sub="唤回到店实际消费" />
        <StatTile label="营销成本 / 产出比" value={`¥${fmt(k.monthCost)}`}
          sub={<span className="inline-flex items-center gap-1.5">投入产出比 <b style={{ color: "var(--yellow)" }}>{(k.monthRevenue / k.monthCost).toFixed(1)} 倍</b></span> as never} />
      </div>

      {/* ③ AI 员工办公室 + 全员状态条 */}
      <div>
        <SectionTitle
          right={
            <div className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              <span><b style={{ color: "var(--green)" }}>{workingCount}</b> / 5 人在岗</span>
              <span>·</span>
              <span>悬停查看 · 点击进工作台</span>
            </div>
          }
        >
          AI 员工办公室
        </SectionTitle>
        {/* 全员状态条:与办公室动画同源(任务状态推导) */}
        <div className="flex flex-wrap gap-2 mb-3">
          {employees.map((e) => {
            const a = activities[e.id];
            const m = ACTIVITY_META[a];
            return (
              <div key={e.id} className="surface-2 px-3 py-1.5 flex items-center gap-2">
                <StatusDot color={m.color} pulse={a !== "idle"} />
                <span className="text-[12px] font-semibold">{e.name}</span>
                <span className="text-[11px]" style={{ color: m.color }}>{m.label}</span>
              </div>
            );
          })}
        </div>
        <OfficeScene employees={employees} activities={activities} />
      </div>

      {/* ④ 待审批 / 今日结果 / 工作日志 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* 待审批 */}
        <div className="surface p-5">
          <SectionTitle right={<span className={`tag ${pending.length ? "tag-yellow" : ""}`}>{pending.length} 个待批</span>}>
            待审批经营任务
          </SectionTitle>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {pending.map((t) => (
                <motion.div key={t.id} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.35 } }}
                  className="panel2 p-3.5"
                >
                  <div className="flex items-center gap-2">
                    <b className="text-[13.5px]">{t.name}</b>
                    <span className="tag">{t.kind}</span>
                  </div>
                  <div className="text-[12px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "var(--ink-2)" }}>
                    <span>{EMPLOYEE_MAP[t.ownerId].name} 主办</span>
                    <span>目标 {t.targetCount} 人</span>
                    <span>成本 ¥{t.cost}</span>
                    <span style={{ color: "var(--green)" }}>预估回流 ¥{t.expectedRevenue}</span>
                  </div>
                  {decided === t.id ? (
                    <div className="mt-2.5 text-[12px] anim-breathe" style={{ color: "var(--brand-2)" }}>
                      决定已同步给喵老板,办公室状态已更新…
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2.5">
                      <button className="btn btn-green btn-sm" onClick={() => decide(t.id, "approved")}>
                        <CircleCheck size={13} /> 批准
                      </button>
                      <button className="btn btn-red btn-sm" onClick={() => decide(t.id, "rejected")}>
                        <CircleX size={13} /> 拒绝
                      </button>
                      <a className="btn btn-ghost btn-sm ml-auto" href="/tasks">
                        详情 <ChevronRight size={12} />
                      </a>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {pending.length === 0 && (
              <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                全部处理完毕,猫员工们正在等你下一个目标。
              </p>
            )}
          </div>
        </div>

        {/* 今日经营结果 */}
        <div className="surface p-5">
          <SectionTitle right={<DemoTag />}>今日经营结果</SectionTitle>
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            <div className="panel2 p-3">
              <div className="text-[20px] font-extrabold" style={{ color: "var(--green)" }}>¥{fmt(fin?.consumption ?? k.monthRevenue)}</div>
              <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>实际回流消费</div>
            </div>
            <div className="panel2 p-3">
              <div className="text-[20px] font-extrabold" style={{ color: "var(--yellow)" }}>{fmt(k.awakenedThisMonth)}</div>
              <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>唤醒成功</div>
            </div>
          </div>
          {fin && (
            <div className="space-y-2">
              {[
                { l: "触达", v: fin.reached, c: "var(--brand)" },
                { l: "回复", v: fin.replied, c: "var(--cyan)" },
                { l: "预约", v: fin.appointments, c: "var(--yellow)" },
                { l: "到店", v: fin.visited, c: "var(--orange)" },
              ].map((x) => (
                <div key={x.l} className="flex items-center gap-2.5 text-[12px]">
                  <span className="w-8" style={{ color: "var(--ink-2)" }}>{x.l}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
                    <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                      animate={{ width: `${(x.v / fin.reached) * 100}%` }} transition={{ duration: 0.7 }}
                      style={{ background: x.c }} />
                  </div>
                  <b className="mono w-8 text-right">{x.v}</b>
                </div>
              ))}
              <p className="text-[11px] pt-1" style={{ color: "var(--ink-3)" }}>
                完整账本见「收益中心」——实际与预测分色呈现。
              </p>
            </div>
          )}
        </div>

        {/* 今日工作日志 */}
        <div className="surface p-5">
          <SectionTitle right={<span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>实时滚动</span>}>
            今日工作日志
          </SectionTitle>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {data.logs.map((l, i) => {
              const emp = EMPLOYEE_MAP[l.employeeId as keyof typeof EMPLOYEE_MAP];
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
