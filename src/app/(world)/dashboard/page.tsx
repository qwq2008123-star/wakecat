"use client";

/* 公司驾驶舱:欢迎区 + 经营数据 + AI 猫咪办公室 + 工作日志/待审批/简报 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Target, ChevronRight, CircleCheck, CircleX, Info } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import OfficeScene from "@/components/world/OfficeScene";
import { DemoTag, SectionTitle, StatTile } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { DashboardData, Employee, TaskStatus, WakeTask } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

const fmt = (n: number) => n.toLocaleString("zh-CN");

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<WakeTask[]>([]);
  const [decided, setDecided] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [d, e, t] = await Promise.all([
        dataProvider.getDashboard(), dataProvider.getEmployees(), dataProvider.getTasks(),
      ]);
      setData(d); setEmployees(e); setTasks(t);
    })();
  }, []);

  async function decide(id: string, status: TaskStatus) {
    setDecided(id);
    const next = await dataProvider.setTaskStatus(id, status);
    setTimeout(() => {
      setTasks(next);
      setDecided(null);
    }, 650);
  }

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

  return (
    <div className="space-y-6">
      {/* 欢迎区 */}
      <div className="surface relative overflow-hidden p-6 md:p-7">
        <div className="aurora" style={{ width: 340, height: 200, top: -90, left: "8%", background: "rgba(124,108,255,.2)" }} />
        <div className="aurora" style={{ width: 280, height: 180, top: -70, right: "20%", background: "rgba(255,138,76,.14)" }} />
        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={15} style={{ color: "var(--brand-2)" }} />
              <span className="text-[12px] font-semibold tracking-wide" style={{ color: "var(--brand-2)" }}>WAKECAT 每日开工</span>
              <DemoTag />
            </div>
            <h1 className="text-[20px] md:text-[24px] font-extrabold leading-snug max-w-[640px]">
              {data.greeting.split("。")[0]}。<span className="grad-text">{data.greeting.split("。")[1]}</span>
            </h1>
            <div className="mt-3 inline-flex items-center gap-2 surface-2 px-3.5 py-2 text-[13px]">
              <Target size={14} style={{ color: "var(--orange)" }} />
              <span style={{ color: "var(--ink-2)" }}>今日经营目标:</span>
              <span className="font-semibold">{data.goal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 核心数据 */}
      <div>
        <SectionTitle right={<DemoTag />}>今日经营全景</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
          <StatTile label="会员总数" value={fmt(k.totalMembers)} sub="喵屋美甲全量档案" />
          <StatTile label="活跃会员" value={fmt(k.activeMembers)} accent="var(--green)" sub="30 天内有到店" />
          <StatTile label="沉睡会员" value={fmt(k.sleepingMembers)} accent="var(--brand-2)" sub="35 天以上未到店" />
          <StatTile label="高风险会员" value={fmt(k.highRiskMembers)} accent="var(--red)" sub="流失概率最高" />
          <StatTile label="本月唤醒" value={fmt(k.awakenedThisMonth)} accent="var(--yellow)" sub="成功回流到店" />
          <StatTile label="本月营销成本" value={`¥${fmt(k.monthCost)}`} sub="券 + 触达成本" />
          <StatTile label="本月回流消费" value={`¥${fmt(k.monthRevenue)}`} accent="var(--green)" sub="唤回到店实际消费" />
        </div>
      </div>

      {/* AI 猫咪办公室 */}
      <div>
        <SectionTitle right={<span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>悬停查看 · 点击进入工作台</span>}>
          AI 员工办公室
        </SectionTitle>
        <OfficeScene employees={employees} />
      </div>

      {/* 日志 / 待审批 / 简报 */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* 今日工作日志 */}
        <div className="surface p-5">
          <SectionTitle right={<span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>实时滚动</span>}>
            今日 AI 工作日志
          </SectionTitle>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {data.logs.map((l, i) => {
              const emp = EMPLOYEE_MAP[l.employeeId as keyof typeof EMPLOYEE_MAP];
              return (
                <motion.div
                  key={l.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }} className="flex gap-2.5"
                >
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

        {/* 待审批任务 */}
        <div className="surface p-5">
          <SectionTitle right={<span className="tag tag-yellow">{pending.length} 个待批</span>}>
            待审批任务
          </SectionTitle>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {pending.map((t) => (
                <motion.div
                  key={t.id} layout
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
                      决定已同步给喵老板…
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2.5">
                      <button className="btn btn-green btn-sm" onClick={() => decide(t.id, "approved")}>
                        <CircleCheck size={13} /> 批准
                      </button>
                      <button className="btn btn-red btn-sm" onClick={() => decide(t.id, "rejected")}>
                        <CircleX size={13} /> 拒绝
                      </button>
                      <a className="btn btn-ghost btn-sm ml-auto" href={`/tasks`}>
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

        {/* AI 今日简报 */}
        <div className="surface p-5 relative overflow-hidden">
          <div className="aurora" style={{ width: 220, height: 150, bottom: -60, right: -40, background: "rgba(255,138,76,.13)" }} />
          <SectionTitle right={<span className="tag tag-brand">喵老板亲述</span>}>AI 今日经营简报</SectionTitle>
          <div className="relative flex gap-3">
            <CatCharacter colorway="orange" state="awake" accessory="crown" size={52} />
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="panel2 p-3.5 text-[13px] leading-relaxed rounded-tl-none"
            >
              {data.briefing}
              <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
                <Info size={11} />
                简报基于演示数据生成,接入真实 Agent 后由大模型实时撰写
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
