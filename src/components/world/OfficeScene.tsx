"use client";

/* ============================================================
   AI 猫咪办公室 v2:保留原布局(总控台+四工位),升级为真正的
   AI 公司现场——独立工位隔断、数据终端、桌面物品、环境灯、层次。
   所有屏幕/面板动画由 activity(任务状态推导)驱动,无假动画。
   ============================================================ */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import CatCharacter from "./CatCharacter";
import { StatusDot } from "./ui";
import { Employee, EmployeeId } from "@/mock-data/types";
import { Activity, ACTIVITY_META } from "@/lib/activity";

/* 工位布置:非均匀摆放(与 v1 相同的空间关系) */
const DESKS: { id: EmployeeId; left: string; bottom: string; scale: number; glow: string; label: string; screenFrom: string }[] = [
  { id: "detective", left: "5%", bottom: "9%", scale: 1, glow: "rgba(78,168,222,.20)", label: "数据侦查台", screenFrom: "rgba(78,168,222,.5)" },
  { id: "strategist", left: "30.5%", bottom: "21%", scale: 1.05, glow: "rgba(124,108,255,.24)", label: "策略作战桌", screenFrom: "rgba(124,108,255,.5)" },
  { id: "seller", left: "56%", bottom: "9%", scale: 1, glow: "rgba(62,207,142,.18)", label: "触达通讯台", screenFrom: "rgba(62,207,142,.45)" },
  { id: "accountant", left: "79.5%", bottom: "21%", scale: 1.05, glow: "rgba(255,201,77,.16)", label: "财务账房", screenFrom: "rgba(255,201,77,.4)" },
];

/* 数据终端屏幕:内容由 activity 决定 */
function Terminal({ activity, screenFrom }: { activity: Activity; screenFrom: string }) {
  const on = activity !== "idle";
  return (
    <svg width="52" height="40" viewBox="0 0 52 40" style={{ display: "block" }} aria-hidden>
      {/* 显示器 */}
      <rect x="3" y="2" width="46" height="30" rx="4" fill="#0B1122" stroke="#32406B" strokeWidth="1.4" />
      <rect x="6" y="5" width="40" height="24" rx="2" fill="#070D1C" />
      {/* 支架 */}
      <rect x="23" y="32" width="6" height="4" fill="#32406B" />
      <rect x="17" y="36" width="18" height="2.6" rx="1.3" fill="#32406B" />
      {/* 屏幕休眠 */}
      {!on && <circle cx="26" cy="17" r="2" fill="#32406B" />}
      {/* 分析中:滚动的数据柱 + 扫描线 */}
      {activity === "analyzing" && (
        <g>
          {[10, 16, 22, 28, 34].map((x, i) => (
            <rect key={x} x={x} y={24} width="5" height="5" rx="1" fill="var(--blue)" opacity=".85"
              className="anim-screenbar" style={{ animationDelay: `${i * 0.22}s`, transformBox: "fill-box" }} />
          ))}
          <rect x="6" y="8" width="40" height="2.4" fill="rgba(78,168,222,.65)" className="anim-scanline" />
          <text x="9" y="13" fontSize="6" fill="rgba(78,168,222,.9)" fontFamily="ui-monospace">RFM ▸ 620</text>
        </g>
      )}
      {/* 规划中:方案清单逐行点亮 */}
      {activity === "planning" && (
        <g>
          <text x="9" y="12" fontSize="6" fill="var(--brand-2)" fontFamily="ui-monospace">PLAN ▸ 8人</text>
          {[16, 21, 26].map((y, i) => (
            <g key={y}>
              <rect x="9" y={y - 3} width="3.4" height="3.4" rx="0.8" fill="none" stroke="var(--brand-2)" strokeWidth="0.9" opacity={i < 2 ? 1 : 0.4} />
              {i < 2 && <path d={`M9.8 ${y - 1.6} l1.2 1.4 2 -2.6`} stroke="var(--green)" strokeWidth="1" fill="none" />}
              <rect x="15" y={y - 2.6} width={22 - i * 4} height="2.2" rx="1" fill="rgba(167,155,255,.55)" />
            </g>
          ))}
        </g>
      )}
      {/* 执行中:消息气泡弹跳 */}
      {activity === "executing" && (
        <g>
          <text x="9" y="12" fontSize="6" fill="var(--green)" fontFamily="ui-monospace">SEND ▸ 15</text>
          <rect x="9" y="16" width="18" height="6.5" rx="3" fill="rgba(62,207,142,.28)" />
          <rect x="20" y="24.5" width="18" height="6.5" rx="3" fill="rgba(62,207,142,.16)" />
          <g fill="var(--green)">
            <circle cx="13" cy="19.2" r="1.1" className="anim-msgpop" />
            <circle cx="26" cy="27.7" r="1.1" className="anim-msgpop" style={{ animationDelay: "0.9s" }} />
            <circle cx="34" cy="19.2" r="1.1" className="anim-msgpop" style={{ animationDelay: "1.8s" }} />
          </g>
        </g>
      )}
      {/* 已交付:对账完成 */}
      {activity === "done" && (
        <g>
          <circle cx="26" cy="17" r="8.5" fill="none" stroke="var(--yellow)" strokeWidth="1.6" />
          <path d="M21.8 17 l3 3 5.6 -6" stroke="var(--yellow)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text x="14" y="29" fontSize="5.4" fill="rgba(255,201,77,.9)" fontFamily="ui-monospace">已结 · +¥969</text>
        </g>
      )}
      {/* 屏幕辉光 */}
      {on && <rect x="6" y="5" width="40" height="24" rx="2" fill={screenFrom} opacity=".12" />}
    </svg>
  );
}

function Workstation({ emp, cfg, activity, onHover }: {
  emp: Employee; cfg: (typeof DESKS)[number]; activity: Activity; onHover: (e: Employee | null) => void;
}) {
  const router = useRouter();
  const meta = ACTIVITY_META[activity];
  const catState = activity === "idle" ? "drowsy" : activity === "done" ? "happy" : "awake";
  const effect = activity === "executing" ? "bubble" : activity === "planning" ? "holo" : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15 }}
      className="absolute cursor-pointer group"
      style={{ left: cfg.left, bottom: cfg.bottom, width: "18%", transform: `scale(${cfg.scale})`, transformOrigin: "bottom center" }}
      onMouseEnter={() => onHover(emp)}
      onMouseLeave={() => onHover(null)}
      onClick={() => router.push(`/agents/${emp.id}`)}
      role="button"
      aria-label={`进入${emp.name}的工作台`}
    >
      {/* 工位隔断(空间层次) */}
      <div
        className="absolute rounded-t-lg"
        style={{
          left: "-4%", right: "-4%", bottom: 58, height: 46,
          background: "linear-gradient(180deg, #1B2440 0%, #131B31 100%)",
          border: "1px solid var(--line-soft)", borderBottom: "none",
          boxShadow: "inset 0 1px 0 rgba(167,155,255,.08)",
        }}
      >
        {/* 隔板上的便签与业绩条 */}
        <div className="absolute left-2.5 top-2 w-3.5 h-4 rounded-[2px]" style={{ background: "rgba(255,201,77,.2)", transform: "rotate(-5deg)" }} />
        <div className="absolute right-3 top-2.5 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? meta.color : "var(--line)" }} />
          ))}
        </div>
      </div>
      {/* 工位聚光 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[135%] h-12 rounded-[50%]"
        style={{
          background: activity === "idle" ? "rgba(90,110,160,.14)" : cfg.glow,
          filter: "blur(20px)",
          transition: "background .5s",
        }}
      />
      <div className="relative flex flex-col items-center">
        {/* 猫(带状态特效) */}
        <div className="relative z-10 transition-transform duration-300 group-hover:-translate-y-1.5 -mb-1.5">
          <CatCharacter
            colorway={emp.colorway}
            state={catState}
            accessory={emp.accessory}
            working={activity !== "idle"}
            effect={effect}
            size={84}
          />
        </div>
        {/* 桌面 + 终端 + 物品 */}
        <div className="relative z-10 w-[116%] -ml-[8%]">
          {/* 桌上物:左侧杯子/纸张,右侧终端 */}
          <div className="absolute -top-9 left-[8%] flex items-end gap-1.5">
            {/* 马克杯 */}
            <div className="w-4 h-4.5 rounded-b-md rounded-t-sm relative" style={{ background: "linear-gradient(180deg,#3A4568,#242E4C)", height: 17 }}>
              <div className="absolute -right-1.5 top-1 w-2 h-2.5 rounded-r-full" style={{ border: "1.6px solid #3A4568", borderLeft: "none" }} />
              <div className="absolute inset-x-1 top-0.5 h-1 rounded-full" style={{ background: "rgba(255,138,76,.5)" }} />
            </div>
            {/* 纸张 */}
            <div className="w-5 h-3 rounded-[2px]" style={{ background: "#E9E4D4", transform: "rotate(-6deg)" }} />
            <div className="w-5 h-3 rounded-[2px] -ml-4 mt-0.5" style={{ background: "#D9D2BE", transform: "rotate(4deg)" }} />
          </div>
          <div className="absolute -top-12 right-[6%]">
            <Terminal activity={activity} screenFrom={cfg.screenFrom} />
          </div>
          {/* 台面 */}
          <div className="h-3.5 rounded-t-md" style={{ background: "linear-gradient(180deg, #2E3A61, #1B2440)", boxShadow: "0 2px 0 rgba(0,0,0,.35)" }} />
          <div className="h-9 rounded-b-lg relative" style={{ background: "linear-gradient(180deg, #141C33, #0C1220)", border: "1px solid var(--line-soft)", borderTop: "none" }}>
            <div className="absolute left-3 top-2 w-9 h-4 rounded-sm" style={{ background: cfg.glow, filter: "blur(3px)" }} />
            {/* 桌腿间抽屉 */}
            <div className="absolute right-3 top-2 w-10 h-5 rounded-[3px]" style={{ border: "1px solid var(--line)" }}>
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-4 h-1 rounded-full" style={{ background: "var(--line)" }} />
            </div>
          </div>
        </div>
        {/* 工位铭牌 + 状态 */}
        <div className="mt-2 flex items-center gap-1.5">
          <StatusDot color={meta.color} pulse={activity !== "idle"} />
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: "var(--ink-2)" }}>
            {cfg.label}
          </span>
        </div>
        <div className="text-[10px] font-semibold" style={{ color: meta.color }}>{meta.label === "" ? "" : meta.desc}</div>
      </div>
    </motion.div>
  );
}

export default function OfficeScene({ employees, activities }: {
  employees: Employee[];
  activities: Record<EmployeeId, Activity>;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<Employee | null>(null);
  const boss = employees.find((e) => e.id === "boss");
  const staff = employees.filter((e) => e.id !== "boss");
  const bossActivity = activities.boss;

  return (
    <div
      className="surface relative overflow-hidden select-none"
      style={{ minHeight: 380 }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* 夜色环境 */}
      <div className="aurora" style={{ width: 380, height: 260, top: -110, left: "12%", background: "rgba(124,108,255,.16)" }} />
      <div className="aurora" style={{ width: 320, height: 220, top: -80, right: "8%", background: "rgba(255,138,76,.12)" }} />
      {/* 夜窗 */}
      <div
        className="absolute rounded-xl overflow-hidden"
        style={{ top: 22, right: "3%", width: 104, height: 72, background: "linear-gradient(180deg,#101A36,#0B1226)", border: "1px solid var(--line)", transform: "skewX(-4deg)" }}
      >
        <div className="absolute rounded-full" style={{ width: 24, height: 24, top: 11, right: 15, background: "radial-gradient(circle at 35% 35%, #FFF3D0, #FFC94D)", boxShadow: "0 0 16px rgba(255,201,77,.5)" }} />
        <div className="absolute left-3 bottom-2 w-14 h-1 rounded" style={{ background: "rgba(147,160,194,.25)" }} />
      </div>
      {/* 墙面装饰:公司铭牌与挂钟 */}
      <div className="absolute left-[4%] top-6 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "rgba(19,28,51,.8)", border: "1px solid var(--line-soft)" }}>
        <span className="text-[10px] font-bold tracking-[.25em]" style={{ color: "var(--orange)" }}>WAKECAT HQ</span>
        <span className="text-[9.5px]" style={{ color: "var(--ink-3)" }}>会员经营部</span>
      </div>
      <div className="absolute rounded-full hidden md:grid place-items-center" style={{ left: "22%", top: 20, width: 34, height: 34, background: "#101A36", border: "2px solid var(--line)" }}>
        <span className="text-[9px] font-bold mono" style={{ color: "var(--ink-2)" }}>24h</span>
      </div>

      {/* 喵老板总控台(居中靠后) */}
      {boss && (
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          className="absolute left-1/2 -translate-x-1/2 cursor-pointer group z-10"
          style={{ top: 40, width: 158 }}
          onMouseEnter={() => setHovered(boss)}
          onClick={() => router.push(`/agents/${boss.id}`)}
          role="button"
          aria-label="进入喵老板的总控台"
        >
          <div className="flex flex-col items-center">
            <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
              <CatCharacter
                colorway={boss.colorway} state={bossActivity === "idle" ? "awake" : "happy"}
                accessory={boss.accessory} size={94} working
              />
            </div>
            <div
              className="w-[158px] h-10 -mt-2.5 rounded-b-2xl relative"
              style={{ background: "linear-gradient(180deg, #1B2440, #101627)", border: "1px solid var(--line)", borderTop: "1px solid #32406B" }}
            >
              <div className="absolute inset-x-4 top-2 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full"
                    style={{ background: bossActivity === "idle" ? "var(--line)" : "rgba(124,108,255,.55)", animation: bossActivity !== "idle" ? "breathe 1.8s ease-in-out infinite" : undefined, animationDelay: `${i * 0.3}s` }} />
                ))}
              </div>
            </div>
            <div className="mt-1.5 text-[11px] font-bold tracking-[.3em]" style={{ color: "var(--orange)" }}>总控台</div>
          </div>
        </motion.div>
      )}

      {/* 地平线 + 地面 */}
      <div className="absolute left-0 right-0" style={{ bottom: 122, height: 1, background: "linear-gradient(90deg, transparent, var(--line) 20%, var(--line) 80%, transparent)" }} />
      <div className="absolute left-0 right-0 bottom-0 h-[136px]" style={{ background: "linear-gradient(180deg, transparent, rgba(19,28,51,.9))" }} />

      {/* 四个工位 */}
      {DESKS.map((cfg) => {
        const emp = staff.find((e) => e.id === cfg.id);
        return emp ? <Workstation key={cfg.id} emp={emp} cfg={cfg} activity={activities[cfg.id]} onHover={setHovered} /> : null;
      })}

      {/* 悬停信息卡 */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key={hovered.id}
            initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.18 }}
            className="glass absolute z-20 rounded-2xl p-4 w-[268px] glow-brand"
            style={{ bottom: 16, right: 16 }}
          >
            <div className="flex items-center gap-3">
              <CatCharacter colorway={hovered.colorway} state="awake" accessory={hovered.accessory} size={44} />
              <div className="min-w-0">
                <div className="font-bold text-[14px]">{hovered.name}</div>
                <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{hovered.title}</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: ACTIVITY_META[activities[hovered.id]].color }}>
                <StatusDot color={ACTIVITY_META[activities[hovered.id]].color} pulse={activities[hovered.id] !== "idle"} />
                {ACTIVITY_META[activities[hovered.id]].label}
              </div>
            </div>
            <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {ACTIVITY_META[activities[hovered.id]].desc}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--brand-2)" }}>
              进入工作台 <ArrowRight size={13} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
