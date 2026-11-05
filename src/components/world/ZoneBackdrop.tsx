"use client";

/* 街区主题布景:每个分区一套原创 SVG 氛围(低饱和,不抢猫的主角位) */
import { Zone } from "@/mock-data/types";

export default function ZoneBackdrop({ zone }: { zone: Zone }) {
  if (zone === "active") {
    /* 活跃街区:暖色暮色 + 挂旗 + 店铺灯 */
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,138,76,.10), transparent 55%)" }} />
        <svg className="absolute top-2 left-0 right-0 w-full" height="26" preserveAspectRatio="none" viewBox="0 0 400 26">
          <path d="M0 4 H400" stroke="rgba(255,138,76,.35)" strokeWidth="1" />
          {Array.from({ length: 16 }).map((_, i) => (
            <path key={i} d={`M${i * 26 + 4} 4 l10 0 l-5 12 Z`} fill={i % 2 ? "rgba(255,138,76,.4)" : "rgba(124,108,255,.35)"} />
          ))}
        </svg>
        <div className="absolute right-[6%] bottom-0 flex items-end gap-1 opacity-40">
          {[26, 34, 22].map((h, i) => (
            <div key={i} className="w-7 rounded-t-md" style={{ height: h, background: "linear-gradient(180deg, rgba(255,138,76,.28), rgba(255,138,76,.05))" }}>
              <div className="mx-auto mt-1.5 w-3.5 h-3 rounded-sm" style={{ background: "rgba(255,201,77,.4)" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (zone === "sleeping") {
    /* 沉睡森林:暗色树影 + 弦月 + 萤火虫 */
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(30,26,64,.4), rgba(10,12,24,.55) 70%)" }} />
        <svg className="absolute inset-x-0 bottom-0 w-full" height="86" preserveAspectRatio="none" viewBox="0 0 400 86">
          {[[30, 60], [78, 74], [130, 52], [210, 70], [268, 48], [330, 68], [372, 56]].map(([x, h], i) => (
            <g key={i} opacity=".5">
              <rect x={x - 2.4} y={86 - h * 0.42} width="4.8" height={h * 0.42} fill="#141B33" />
              <path d={`M${x} ${86 - h} L${x - h * 0.3} ${86 - h * 0.34} L${x + h * 0.3} ${86 - h * 0.34} Z`} fill="#141B33" />
              <path d={`M${x} ${86 - h * 0.72} L${x - h * 0.24} ${86 - h * 0.14} L${x + h * 0.24} ${86 - h * 0.14} Z`} fill="#182140" />
            </g>
          ))}
        </svg>
        <div className="absolute rounded-full" style={{ top: 14, right: "12%", width: 20, height: 20, background: "radial-gradient(circle at 38% 38%, #FFF3D0, #E8C96A)", boxShadow: "0 0 14px rgba(255,201,77,.4)", opacity: .8 }} />
        {[[14, 30], [42, 22], [70, 36], [86, 18]].map(([l, t], i) => (
          <span key={i} className="absolute rounded-full anim-firefly"
            style={{ left: `${l}%`, top: `${t}%`, width: 4, height: 4, background: "#B7E87E", boxShadow: "0 0 8px rgba(183,232,126,.8)", animationDelay: `${i * 0.9}s` }} />
        ))}
      </div>
    );
  }
  if (zone === "premium") {
    /* 高价值庄园:金柱 + 丝绒围栏 + 星钻 */
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,201,77,.10), rgba(124,108,255,.08) 60%, transparent)" }} />
        <div className="absolute left-[3%] top-3 bottom-0 w-9 rounded-t-full" style={{ background: "linear-gradient(180deg, rgba(255,201,77,.16), rgba(255,201,77,.03))", border: "1px solid rgba(255,201,77,.2)", borderBottom: "none" }} />
        <div className="absolute right-[3%] top-3 bottom-0 w-9 rounded-t-full" style={{ background: "linear-gradient(180deg, rgba(255,201,77,.16), rgba(255,201,77,.03))", border: "1px solid rgba(255,201,77,.2)", borderBottom: "none" }} />
        <svg className="absolute left-[3%] right-[3%] w-full" style={{ top: "38%" }} height="30" preserveAspectRatio="none" viewBox="0 0 400 30">
          <path d="M14 8 Q200 30 386 8" stroke="rgba(255,95,126,.5)" strokeWidth="3" fill="none" />
          {[70, 160, 250, 330].map((x, i) => (
            <g key={i}>
              <rect x={x} y="4" width="5" height="22" rx="2" fill="rgba(255,201,77,.55)" />
              <circle cx={x + 2.5} cy="4" r="3.4" fill="rgba(255,201,77,.7)" />
            </g>
          ))}
        </svg>
        {[[20, 24], [78, 12], [55, 40], [88, 30]].map(([l, t], i) => (
          <svg key={i} className="absolute anim-sparkle" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.6}s` }} width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z" fill="#FFF3D0" />
          </svg>
        ))}
      </div>
    );
  }
  if (zone === "new") {
    /* 新会员村:清晨天色 + 帐篷小屋 + 旗帜 */
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(78,207,224,.13), transparent 60%)" }} />
        <svg className="absolute right-[5%] bottom-0" width="120" height="54" viewBox="0 0 120 54" opacity=".5">
          <path d="M10 54 L30 16 L50 54 Z" fill="rgba(78,207,224,.3)" />
          <path d="M30 16 L30 54" stroke="rgba(10,20,35,.6)" strokeWidth="1.4" />
          <path d="M62 54 L78 26 L94 54 Z" fill="rgba(124,108,255,.3)" />
          <rect x="100" y="34" width="16" height="20" rx="1.5" fill="rgba(255,201,77,.32)" />
          <path d="M100 34 L108 26 L116 34 Z" fill="rgba(255,138,76,.4)" />
        </svg>
        <svg className="absolute left-[6%] top-2 w-full max-w-[220px]" height="22" viewBox="0 0 220 22">
          <path d="M0 3 H220" stroke="rgba(78,207,224,.4)" strokeWidth="1" />
          {Array.from({ length: 8 }).map((_, i) => (
            <path key={i} d={`M${i * 28 + 6} 3 l12 0 l-6 11 Z`} fill={i % 2 ? "rgba(78,207,224,.4)" : "rgba(62,207,142,.4)"} />
          ))}
        </svg>
      </div>
    );
  }
  /* 风险警戒区:警示纹 + 网格 + 警戒灯 */
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,95,126,.10), rgba(10,12,24,.4) 70%)" }} />
      <div
        className="absolute top-0 left-0 right-0 h-2.5"
        style={{ background: "repeating-linear-gradient(-45deg, rgba(255,95,126,.55) 0 10px, rgba(10,12,24,.9) 10px 20px)" }}
      />
      <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: "linear-gradient(rgba(255,95,126,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,95,126,.6) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
      <div className="absolute right-[5%] top-5 flex items-center gap-2 px-2.5 py-1 rounded-md" style={{ background: "rgba(255,95,126,.12)", border: "1px solid rgba(255,95,126,.4)" }}>
        <span className="w-1.5 h-1.5 rounded-full anim-breathe" style={{ background: "var(--red)" }} />
        <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--red)" }}>WATCH</span>
      </div>
    </div>
  );
}
