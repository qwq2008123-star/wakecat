"use client";

/* AI 猫咪办公室:四位员工在工位工作,喵老板在总控台。
   悬停查看员工信息,点击进入工作台。 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import CatCharacter from "./CatCharacter";
import { StatusDot } from "./ui";
import { Employee } from "@/mock-data/types";

/* 工位布置:非均匀摆放,制造空间层次 */
const DESKS: { id: Employee["id"]; left: string; bottom: string; scale: number; glow: string; label: string }[] = [
  { id: "detective", left: "6%", bottom: "10%", scale: 1, glow: "rgba(78,168,222,.20)", label: "数据侦查台" },
  { id: "strategist", left: "31%", bottom: "22%", scale: 1.04, glow: "rgba(124,108,255,.22)", label: "策略作战桌" },
  { id: "seller", left: "57%", bottom: "10%", scale: 1, glow: "rgba(62,207,142,.18)", label: "触达通讯台" },
  { id: "accountant", left: "80%", bottom: "22%", scale: 1.04, glow: "rgba(255,201,77,.16)", label: "财务账房" },
];

function Workstation({ emp, cfg, onHover }: {
  emp: Employee; cfg: (typeof DESKS)[number]; onHover: (e: Employee | null) => void;
}) {
  const router = useRouter();
  const state = emp.status === "working" ? "awake" : emp.status === "waiting" ? "drowsy" : "sleep";
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.15 }}
      className="absolute cursor-pointer group"
      style={{ left: cfg.left, bottom: cfg.bottom, width: "17%", transform: `scale(${cfg.scale})`, transformOrigin: "bottom center" }}
      onMouseEnter={() => onHover(emp)}
      onMouseLeave={() => onHover(null)}
      onClick={() => router.push(`/agents/${emp.id}`)}
      role="button"
      aria-label={`进入${emp.name}的工作台`}
    >
      {/* 工位光池 */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-[130%] h-10 rounded-[50%]"
        style={{ background: cfg.glow, filter: "blur(18px)" }}
      />
      {/* 猫 + 桌面 */}
      <div className="relative flex flex-col items-center">
        <div className="transition-transform duration-300 group-hover:-translate-y-1.5">
          <CatCharacter colorway={emp.colorway} state={state} accessory={emp.accessory} working={emp.status === "working"} size={86} />
        </div>
        {/* 桌子 */}
        <div className="relative w-[112%] -ml-[6%]">
          <div
            className="h-3.5 rounded-t-md"
            style={{ background: "linear-gradient(180deg, #2A3559, #1B2440)", boxShadow: "0 2px 0 rgba(0,0,0,.3)" }}
          />
          <div className="h-8 rounded-b-lg relative" style={{ background: "linear-gradient(180deg, #141C33, #0D1322)", border: "1px solid var(--line-soft)", borderTop: "none" }}>
            {/* 桌上的屏幕微光 */}
            <div className="absolute left-3 top-1.5 w-8 h-4 rounded-sm" style={{ background: cfg.glow, filter: "blur(3px)" }} />
          </div>
        </div>
        {/* 工位铭牌 */}
        <div className="mt-2 text-[11.5px] font-semibold tracking-widest text-center" style={{ color: "var(--ink-2)" }}>
          {cfg.label}
        </div>
      </div>
    </motion.div>
  );
}

export default function OfficeScene({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const [hovered, setHovered] = useState<Employee | null>(null);
  const boss = employees.find((e) => e.id === "boss");
  const staff = employees.filter((e) => e.id !== "boss");

  return (
    <div
      className="surface relative overflow-hidden select-none"
      style={{ minHeight: 360 }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* 夜空与城市光 */}
      <div className="aurora" style={{ width: 380, height: 260, top: -110, left: "12%", background: "rgba(124,108,255,.16)" }} />
      <div className="aurora" style={{ width: 320, height: 220, top: -80, right: "8%", background: "rgba(255,138,76,.12)" }} />
      {/* 夜窗 + 月亮 */}
      <div
        className="absolute rounded-xl overflow-hidden"
        style={{ top: 24, right: "4%", width: 108, height: 74, background: "linear-gradient(180deg,#101A36,#0B1226)", border: "1px solid var(--line)", transform: "skewX(-4deg)" }}
      >
        <div className="absolute rounded-full" style={{ width: 26, height: 26, top: 12, right: 16, background: "radial-gradient(circle at 35% 35%, #FFF3D0, #FFC94D)", boxShadow: "0 0 18px rgba(255,201,77,.5)" }} />
        <div className="absolute left-3 bottom-2 w-14 h-1 rounded" style={{ background: "rgba(147,160,194,.25)" }} />
        <div className="absolute left-5 bottom-4 w-9 h-1 rounded" style={{ background: "rgba(147,160,194,.18)" }} />
      </div>

      {/* 喵老板总控台(居中靠后) */}
      {boss && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="absolute left-1/2 -translate-x-1/2 cursor-pointer group z-10"
          style={{ top: 44, width: 150 }}
          onMouseEnter={() => setHovered(boss)}
          onClick={() => router.push(`/agents/${boss.id}`)}
          role="button"
          aria-label="进入喵老板的总控台"
        >
          <div className="flex flex-col items-center">
            <div className="transition-transform duration-300 group-hover:-translate-y-1">
              <CatCharacter colorway={boss.colorway} state="awake" accessory={boss.accessory} size={92} working />
            </div>
            {/* 弧形总控台 */}
            <div
              className="w-[150px] h-9 -mt-2 rounded-b-2xl relative"
              style={{ background: "linear-gradient(180deg, #1B2440, #101627)", border: "1px solid var(--line)", borderTop: "1px solid #32406B" }}
            >
              <div className="absolute inset-x-4 top-1.5 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: "rgba(124,108,255,.4)" }} />
                ))}
              </div>
            </div>
            <div className="mt-1.5 text-[11px] font-bold tracking-[.3em]" style={{ color: "var(--orange)" }}>总控台</div>
          </div>
        </motion.div>
      )}

      {/* 地平线 */}
      <div className="absolute left-0 right-0" style={{ bottom: 116, height: 1, background: "linear-gradient(90deg, transparent, var(--line) 20%, var(--line) 80%, transparent)" }} />
      {/* 地面渐变 */}
      <div className="absolute left-0 right-0 bottom-0 h-[130px]" style={{ background: "linear-gradient(180deg, transparent, rgba(19,28,51,.85))" }} />

      {/* 四个工位 */}
      {DESKS.map((cfg) => {
        const emp = staff.find((e) => e.id === cfg.id);
        return emp ? <Workstation key={cfg.id} emp={emp} cfg={cfg} onHover={setHovered} /> : null;
      })}

      {/* 悬停信息卡 */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key={hovered.id}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="glass absolute z-20 rounded-2xl p-4 w-[264px] glow-brand"
            style={{ bottom: 16, right: 16 }}
          >
            <div className="flex items-center gap-3">
              <CatCharacter colorway={hovered.colorway} state="awake" accessory={hovered.accessory} size={44} />
              <div className="min-w-0">
                <div className="font-bold text-[14px]">{hovered.name}</div>
                <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>{hovered.title}</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-2)" }}>
                <StatusDot color={hovered.status === "working" ? "var(--green)" : hovered.status === "waiting" ? "var(--yellow)" : "var(--ink-3)"} pulse={hovered.status === "working"} />
                {hovered.status === "working" ? "工作中" : hovered.status === "waiting" ? "待命中" : "休息"}
              </div>
            </div>
            <p className="text-[12px] mt-2.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {hovered.statusText}
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
