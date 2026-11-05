"use client";

/* ============================================================
   CatCharacter v2:统一 2.5D 渲染管线的原创猫角色
   - 体积:头身双向渐变 + 顶部高光 + 右侧轮廓光 + 接地阴影
   - 五位员工职业装备:王冠披风勋章 / 侦探圆框镜+银边放大镜 /
     金丝眼镜+战略卷轴 / 耳麦+消息气泡 / 金币+悬浮账本
   - 动效:摇尾、眨眼、工作浮动;effect 由办公场景按任务状态传入
   ============================================================ */
import { useId } from "react";
import { CatColorway, CatState } from "@/mock-data/types";

const PALETTES: Record<CatColorway, { base: string; dark: string; deep: string; light: string; belly: string; patch?: string }> = {
  orange: { base: "#F5A25D", dark: "#C97F3D", deep: "#A86428", light: "#FFE3C2", belly: "#FFEED6" },
  gray: { base: "#AEB6C2", dark: "#7E8794", deep: "#626B78", light: "#DDE2EA", belly: "#EEF1F6" },
  calico: { base: "#E8B36A", dark: "#B98A40", deep: "#91672B", light: "#FFE3BD", belly: "#FFF2DC", patch: "#7A4E22" },
  cow: { base: "#F2F3F7", dark: "#C6CAD4", deep: "#A6ABB8", light: "#FFFFFF", belly: "#FFFFFF", patch: "#383C48" },
  ragdoll: { base: "#EBD6BC", dark: "#C9AF8E", deep: "#A98F6E", light: "#FBF0DE", belly: "#FDF6EA" },
  purple: { base: "#B7A8F5", dark: "#8F7EE0", deep: "#7463C9", light: "#E4DEFF", belly: "#F1EDFF" },
};

export type CatAccessory = "crown" | "magnifier" | "scroll" | "envelope" | "coins" | null;

export default function CatCharacter({
  colorway = "orange",
  state = "awake",
  accessory = null,
  badge = null,
  size = 96,
  working = false,
  effect = null,
  className = "",
}: {
  colorway?: CatColorway;
  state?: CatState;
  accessory?: CatAccessory;
  badge?: "premium" | "risk" | null;
  size?: number;
  working?: boolean;
  /** 办公场景专用:executing→消息气泡,planning→悬浮策略面板 */
  effect?: "bubble" | "holo" | null;
  className?: string;
}) {
  const uid = useId().replace(/[:]/g, "");
  const p = PALETTES[colorway] ?? PALETTES.orange;
  const G = (n: string) => `${n}_${uid}`;
  const isCalico = colorway === "calico";
  const isCow = colorway === "cow";

  /* ---------- 神态(玻璃质感眼睛) ---------- */
  let eyes: React.ReactNode;
  let mouth: React.ReactNode;
  let extra: React.ReactNode = null;
  if (state === "happy") {
    eyes = (
      <g stroke="#33241573" strokeWidth="0" fill="none">
        <g stroke="#2E2013" strokeWidth="2.6" strokeLinecap="round">
          <path d="M43 49 q7 -8 14 -0.5" /><path d="M63 49 q7 -8 14 -0.5" />
        </g>
        <g stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" opacity=".55">
          <path d="M46 44.5 q4 -3 8 -1" /><path d="M66 44.5 q4 -3 8 -1" />
        </g>
      </g>
    );
    mouth = <path d="M55 60 q2.5 3.2 5 0 q2.5 3.2 5 0" stroke="#2E2013" strokeWidth="1.9" fill="none" strokeLinecap="round" />;
    extra = (
      <g fill={`url(#${G("blush")})`}>
        <circle cx="38" cy="58" r="4" /><circle cx="82" cy="58" r="4" />
      </g>
    );
  } else if (state === "drowsy") {
    eyes = (
      <g>
        <path d="M43 50 q7 4.5 14 0.5 M63 50 q7 4.5 14 0.5" stroke="#2E2013" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M43 47.5 q7 -3.5 14 0 M63 47.5 q7 -3.5 14 0" stroke="#2E2013" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".65" />
        <circle cx="50" cy="50.5" r="1.5" fill="#2E2013" /><circle cx="70" cy="50.5" r="1.5" fill="#2E2013" />
      </g>
    );
    mouth = <path d="M57 61 q3 2.2 6 0" stroke="#2E2013" strokeWidth="1.7" fill="none" strokeLinecap="round" />;
  } else if (state === "sleep") {
    eyes = (
      <g stroke="#2E2013" strokeWidth="2.6" fill="none" strokeLinecap="round">
        <path d="M43 51 q7 5.5 14 0" /><path d="M63 51 q7 5.5 14 0" />
      </g>
    );
    mouth = <path d="M58 61 q2 2 4 0" stroke="#2E2013" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
    extra = (
      <g fill="#8FA1C4" fontWeight="900" fontFamily="ui-sans-serif">
        <text x="90" y="30" fontSize="14" className="zzz">z</text>
        <text x="100" y="17" fontSize="10" className="zzz" style={{ animationDelay: "0.9s" }}>z</text>
        <text x="106" y="7" fontSize="7.5" className="zzz" style={{ animationDelay: "1.8s" }}>z</text>
      </g>
    );
  } else {
    eyes = (
      <g className="anim-blink">
        <ellipse cx="50" cy="49" rx="4.2" ry="5" fill="#2E2013" />
        <ellipse cx="70" cy="49" rx="4.2" ry="5" fill="#2E2013" />
        <circle cx="48.4" cy="47" r="1.7" fill="#FFFFFF" />
        <circle cx="68.4" cy="47" r="1.7" fill="#FFFFFF" />
        <circle cx="51.6" cy="51.4" r="0.9" fill="#FFFFFF" opacity=".8" />
        <circle cx="71.6" cy="51.4" r="0.9" fill="#FFFFFF" opacity=".8" />
        <path d="M44 43.5 q6 -3.4 12 -0.6 M64 43.5 q6 -3.4 12 -0.6" stroke="#2E2013" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".7" />
      </g>
    );
    mouth = <path d="M56 60 q2 2.6 4 0 q2 2.6 4 0" stroke="#2E2013" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  }

  const stripes = colorway === "orange" || isCalico ? (
    <g stroke={p.light} strokeWidth="3.2" strokeLinecap="round" fill="none" opacity=".85">
      <path d="M49 28 q3 -4.5 6.5 -0.5" /><path d="M59 25.5 q3 -4.5 6.5 -0.5" /><path d="M69 28 q3 -4.5 6.5 -0.5" />
      <path d="M47 70 q-2 5.5 0 10" /><path d="M60 73 q-2 5.5 0 10" />
    </g>
  ) : null;

  const patches = isCalico ? (
    <g fill={p.patch as string} opacity=".82">
      <path d="M40 34 a19 19 0 0 1 11 -9 l5 7 a23 23 0 0 0 -11 11 Z" />
      <ellipse cx="47" cy="92" rx="10" ry="6.5" transform="rotate(-8 47 92)" />
    </g>
  ) : isCow ? (
    <g fill={p.patch as string} opacity=".88">
      <ellipse cx="47" cy="90" rx="12" ry="8.5" transform="rotate(-14 47 90)" />
      <ellipse cx="78" cy="76" rx="6.5" ry="10" transform="rotate(18 78 76)" />
      <path d="M42 32 a17 17 0 0 1 9 -7.5 l3.4 5.4 a21 21 0 0 0 -8.4 9.6 Z" />
    </g>
  ) : null;

  /* ---------- 职业装备 v2 ---------- */
  let gear: React.ReactNode = null;
  let backGear: React.ReactNode = null;

  if (accessory === "crown") {
    backGear = (
      <path d="M34 72 q26 12 52 0 l-5 12 q-21 9 -42 0 Z" fill={`url(#${G("cape")})`} opacity=".96" />
    );
    gear = (
      <g transform="rotate(-3 60 18)">
        <path d="M41 25 l6.5 -15 9.5 9.5 9.5 -12 9.5 12 9.5 -9.5 6.5 15 Z" fill={`url(#${G("gold")})`} stroke="#9C7A1E" strokeWidth="1.3" strokeLinejoin="round" />
        <rect x="42" y="24" width="36" height="5.5" rx="2.5" fill={`url(#${G("gold")})`} stroke="#9C7A1E" strokeWidth="1" />
        <circle cx="60" cy="10.5" r="2.6" fill={`url(#${G("gem")})`} />
        <circle cx="48" cy="14" r="1.7" fill="#FFF7DF" /><circle cx="72" cy="14" r="1.7" fill="#FFF7DF" />
        <path d="M52 20.5 q8 3.4 16 0" stroke="#B8860B" strokeWidth="1" fill="none" opacity=".7" />
      </g>
    );
  } else if (accessory === "magnifier") {
    gear = (
      <g>
        {/* 侦探圆框眼镜 */}
        <g>
          <circle cx="50" cy="48.5" r="8.4" fill="rgba(140,215,255,.13)" stroke="#2B3550" strokeWidth="2.6" />
          <circle cx="70" cy="48.5" r="8.4" fill="rgba(140,215,255,.13)" stroke="#2B3550" strokeWidth="2.6" />
          <path d="M58.4 48.5 q1.6 -2 3.2 0" stroke="#2B3550" strokeWidth="2.4" fill="none" />
          <path d="M41.6 47.5 L33 44.5 M78.4 47.5 L87 44.5" stroke="#2B3550" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M45.5 44.5 l4 -3 M65.5 44.5 l4 -3" stroke="#FFFFFF" strokeWidth="1.6" opacity=".5" strokeLinecap="round" />
        </g>
        {/* 银边放大镜 */}
        <g transform="rotate(16 98 64)">
          <circle cx="98" cy="62" r="11.5" fill="rgba(120,215,255,.14)" stroke={`url(#${G("metal")})`} strokeWidth="4" />
          <path d="M91 55.5 a9.5 9.5 0 0 1 9 -3.5" stroke="#FFFFFF" strokeWidth="1.6" fill="none" opacity=".65" strokeLinecap="round" />
          <line x1="106" y1="70" x2="115" y2="81" stroke={`url(#${G("metal")})`} strokeWidth="4.6" strokeLinecap="round" />
        </g>
      </g>
    );
  } else if (accessory === "scroll") {
    gear = (
      <g>
        {/* 金丝眼镜(指挥官阅读款) */}
        <g stroke="#D9B45A" strokeWidth="1.8" fill="none">
          <rect x="41.5" y="43.5" width="14" height="10" rx="4.5" />
          <rect x="64.5" y="43.5" width="14" height="10" rx="4.5" />
          <path d="M55.5 48 h9" />
          <path d="M41.5 47 L34 44 M78.5 47 L86 44" strokeLinecap="round" />
        </g>
        {/* 战略卷轴:展开的羊皮地图 + 朱印 */}
        <g transform="rotate(-9 20 66)">
          <rect x="7" y="58" width="28" height="15" rx="2.5" fill={`url(#${G("parch")})`} stroke="#C9B384" strokeWidth="1.1" />
          <path d="M7 60.5 a4 4 0 1 0 0 10 M35 60.5 a4 4 0 1 1 0 10" fill="none" stroke="#C9B384" strokeWidth="1.5" />
          <path d="M12 68 q5 -6 9 -2 q4 4 9 -3" stroke="#B4763B" strokeWidth="1.3" fill="none" strokeDasharray="2.4 2" />
          <circle cx="27" cy="64.5" r="1.9" fill="#E25555" />
          <circle cx="27" cy="64.5" r="3.4" fill="none" stroke="#E25555" strokeWidth="0.8" opacity=".6" />
        </g>
      </g>
    );
  } else if (accessory === "envelope") {
    gear = (
      <g>
        {/* 通讯耳麦 */}
        <path d="M35 40 a25.5 25.5 0 0 1 50 0" fill="none" stroke="#39415E" strokeWidth="4.6" strokeLinecap="round" />
        <rect x="31" y="46" width="10.5" height="15" rx="4.5" fill={`url(#${G("headset")})`} stroke="#2B3550" strokeWidth="1.2" />
        <circle cx="36.2" cy="53.5" r="2.2" fill="var(--orange)" />
        <path d="M37 61 q5 10.5 16 11" fill="none" stroke="#39415E" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="55" cy="72.4" r="2.8" fill="#39415E" />
        <circle cx="55" cy="72.4" r="1.2" fill="var(--orange)" />
      </g>
    );
  } else if (accessory === "coins") {
    gear = (
      <g>
        {/* 金币堆 */}
        <g stroke="#B8860B" strokeWidth="1">
          <ellipse cx="96" cy="95" rx="12" ry="4.6" fill={`url(#${G("coin")})`} />
          <ellipse cx="96" cy="88.6" rx="12" ry="4.6" fill={`url(#${G("coin")})`} />
          <ellipse cx="96" cy="82.2" rx="12" ry="4.6" fill={`url(#${G("coin")})`} />
        </g>
        <text x="93" y="85.4" fontSize="6.4" fontWeight="900" fill="#8A6508">¥</text>
        <path d="M104 74 l1.8 3.6 3.6 1.8 -3.6 1.8 -1.8 3.6 -1.8 -3.6 -3.6 -1.8 3.6 -1.8 Z" fill="#FFF3D0" className="anim-sparkle" />
        {/* 单片账本镜(财务的细致) */}
        <circle cx="76" cy="48.5" r="6" fill="rgba(255,201,77,.1)" stroke="#D9B45A" strokeWidth="1.6" />
        <path d="M76 44.8 a3.6 3.6 0 0 1 3.6 3.6" stroke="#FFF7DF" strokeWidth="1.1" fill="none" opacity=".7" />
        <line x1="82" y1="46" x2="86.5" y2="41.5" stroke="#D9B45A" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  }

  /* 效果层:由任务状态驱动 */
  const effectLayer = effect === "bubble" ? (
    <g>
      <g className="anim-msgpop">
        <rect x="80" y="18" width="30" height="14" rx="7" fill="rgba(62,207,142,.16)" stroke="var(--green)" strokeWidth="1.2" />
        <circle cx="88" cy="25" r="1.6" fill="var(--green)" /><circle cx="95" cy="25" r="1.6" fill="var(--green)" /><circle cx="102" cy="25" r="1.6" fill="var(--green)" />
        <path d="M88 32 l-3 5 6 -3 Z" fill="var(--green)" opacity=".7" />
      </g>
    </g>
  ) : effect === "holo" ? (
    <g className="anim-holo">
      <rect x="82" y="14" width="30" height="24" rx="4" fill="rgba(124,108,255,.14)" stroke="var(--brand-2)" strokeWidth="1.2" />
      <g stroke="var(--brand-2)" strokeWidth="1.6" strokeLinecap="round">
        <line x1="87" y1="21" x2="104" y2="21" /><line x1="87" y1="26" x2="101" y2="26" /><line x1="87" y1="31" x2="97" y2="31" />
      </g>
      <circle cx="107" cy="31" r="2.2" fill="var(--orange)" />
    </g>
  ) : null;

  const badgeRing = badge === "risk" ? (
    <circle cx="60" cy="60" r="57" fill="none" stroke="var(--red)" strokeWidth="1.6" strokeDasharray="7 9" opacity=".55" style={{ animation: "breathe 2.4s ease-in-out infinite" }} />
  ) : badge === "premium" ? (
    <circle cx="60" cy="60" r="57" fill="none" stroke="var(--yellow)" strokeWidth="1.4" strokeDasharray="2 7" opacity=".5" />
  ) : null;

  const premiumCrown = badge === "premium" ? (
    <path d="M49 21 l4.6 -10.5 7 7 7 -8.8 7 8.8 7 -7 4.6 10.5 Z" fill="none" stroke="#FFC94D" strokeWidth="1.9" strokeLinejoin="round" opacity=".92" />
  ) : null;

  return (
    <svg
      width={size} height={(size * 116) / 120} viewBox="0 0 120 116"
      className={className} style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <linearGradient id={G("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.light} /><stop offset="38%" stopColor={p.base} /><stop offset="100%" stopColor={p.dark} />
        </linearGradient>
        <radialGradient id={G("head")} cx="38%" cy="26%" r="86%">
          <stop offset="0%" stopColor={p.light} /><stop offset="45%" stopColor={p.base} /><stop offset="100%" stopColor={p.dark} />
        </radialGradient>
        <radialGradient id={G("headSheen")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".4" /><stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={G("gold")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE59A" /><stop offset="45%" stopColor="#FFC94D" /><stop offset="100%" stopColor="#D9A428" />
        </linearGradient>
        <radialGradient id={G("gem")} cx="35%" cy="35%" r="80%">
          <stop offset="0%" stopColor="#FFB3C2" /><stop offset="100%" stopColor="#E23A5F" />
        </radialGradient>
        <linearGradient id={G("metal")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8EDF6" /><stop offset="55%" stopColor="#9AA6BC" /><stop offset="100%" stopColor="#6E7A94" />
        </linearGradient>
        <linearGradient id={G("parch")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F8EFD8" /><stop offset="100%" stopColor="#E9D9B4" />
        </linearGradient>
        <linearGradient id={G("headset")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A5578" /><stop offset="100%" stopColor="#2B3550" />
        </linearGradient>
        <linearGradient id={G("coin")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE59A" /><stop offset="100%" stopColor="#E8B83E" />
        </linearGradient>
        <linearGradient id={G("cape")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8A4DBF" /><stop offset="100%" stopColor="#5C3390" />
        </linearGradient>
        <linearGradient id={G("blush")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB1B1" stopOpacity=".75" /><stop offset="100%" stopColor="#FFB1B1" stopOpacity=".3" />
        </linearGradient>
        <radialGradient id={G("ground")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000000" stopOpacity=".38" /><stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="109" rx="38" ry="6" fill={`url(#${G("ground")})`} />
      {badgeRing}
      <g className={working ? "anim-bob" : undefined}>
        {accessory === "crown" && backGear}
        {/* 尾巴 */}
        <path d="M84 96 q25 3 27 -18 q1 -12 -12 -13" fill="none" stroke={p.dark} strokeWidth="10" strokeLinecap="round" className="anim-sway" />
        <path d="M84 96 q25 3 27 -18 q1 -12 -12 -13" fill="none" stroke={p.light} strokeWidth="3.4" strokeLinecap="round" opacity=".35" className="anim-sway" />
        {/* 身体 */}
        <path d="M37 102 q-6 -31 23 -35 q29 4 23 35 q-23 9.5 -46 0 Z" fill={`url(#${G("body")})`} />
        <ellipse cx="60" cy="92" rx="14" ry="10.5" fill={p.belly} opacity=".9" />
        {patches}
        {/* 前爪 */}
        <ellipse cx="49" cy="101" rx="7.5" ry="4.6" fill={p.base} stroke={p.deep} strokeWidth="0.8" opacity=".95" />
        <ellipse cx="71" cy="101" rx="7.5" ry="4.6" fill={p.base} stroke={p.deep} strokeWidth="0.8" opacity=".95" />
        {/* 耳朵 */}
        <path d="M40 34 L32.5 9 L58 24 Z" fill={`url(#${G("body")})`} />
        <path d="M80 34 L87.5 9 L62 24 Z" fill={`url(#${G("body")})`} />
        <path d="M42.5 29.5 L38.5 15.5 L52.5 24 Z" fill="#FFC9B0" />
        <path d="M77.5 29.5 L81.5 15.5 L67.5 24 Z" fill="#FFC9B0" />
        {/* 头 */}
        <circle cx="60" cy="52" r="27" fill={`url(#${G("head")})`} />
        <ellipse cx="48" cy="34" rx="15" ry="8.5" fill={`url(#${G("headSheen")})`} transform="rotate(-16 48 34)" />
        {/* 轮廓光 */}
        <path d="M84 34 a27 27 0 0 1 2.6 24" stroke={p.light} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity=".55" />
        {/* 腮边绒毛 */}
        <g stroke={p.dark} strokeWidth="1.4" strokeLinecap="round" opacity=".5">
          <path d="M33.5 56 l4 -2.5 -1 4 M86.5 56 l-4 -2.5 1 4" fill="none" />
        </g>
        {stripes}
        {/* 胡须 */}
        <g stroke="rgba(233,238,251,.55)" strokeWidth="1.2" strokeLinecap="round">
          <line x1="27" y1="57" x2="38" y2="58" /><line x1="27" y1="63" x2="38" y2="62" />
          <line x1="93" y1="57" x2="82" y2="58" /><line x1="93" y1="63" x2="82" y2="62" />
        </g>
        {eyes}
        <path d="M57.8 57.5 L62.2 57.5 L60 60.8 Z" fill={`url(#${G("gem")})`} opacity=".9" />
        {mouth}
        {extra}
        {premiumCrown}
        {accessory === "crown" && (
          <circle cx="60" cy="78" r="4.6" fill={`url(#${G("gold")})`} stroke="#9C7A1E" strokeWidth="0.9" />
        )}
      </g>
      {gear}
      {effectLayer}
    </svg>
  );
}
