/* ============================================================
   CatCharacter:参数化猫角色 SVG
   - 6 种毛色 × 4 种神态 × 员工配件(王冠/放大镜/卷轴/信封/金币)
   - 会员装饰:高价值王冠、风险警示环
   动效:尾巴摇摆 / 眨眼 / 呼吸,全部 CSS 驱动(见 globals.css)
   ============================================================ */
import { CatColorway, CatState } from "@/mock-data/types";

const PALETTES: Record<CatColorway, { base: string; dark: string; light: string; patch?: string }> = {
  orange: { base: "#F5A25D", dark: "#D98E4A", light: "#FFD9B4" },
  gray: { base: "#AEB6C2", dark: "#8F97A6", light: "#D8DDE6" },
  calico: { base: "#E8B36A", dark: "#C79046", light: "#FFE3BD", patch: "#8A5A2B" },
  cow: { base: "#E8E9EE", dark: "#3B3F4A", light: "#F7F8FA", patch: "#3B3F4A" },
  ragdoll: { base: "#EBD6BC", dark: "#CCB394", light: "#FBF0DE" },
  purple: { base: "#B7A8F5", dark: "#9687E8", light: "#E4DEFF" },
};

export type CatAccessory = "crown" | "magnifier" | "scroll" | "envelope" | "coins" | null;

export default function CatCharacter({
  colorway = "orange",
  state = "awake",
  accessory = null,
  badge = null,
  size = 96,
  working = false,
  className = "",
}: {
  colorway?: CatColorway;
  state?: CatState;
  accessory?: CatAccessory;
  badge?: "premium" | "risk" | null;
  size?: number;
  working?: boolean;
  className?: string;
}) {
  const p = PALETTES[colorway] ?? PALETTES.orange;
  const isCalico = colorway === "calico";
  const isCow = colorway === "cow";

  /* 神态 */
  let eyes: React.ReactNode;
  let mouth: React.ReactNode;
  let extra: React.ReactNode = null;
  if (state === "happy") {
    eyes = (
      <g stroke="#42321F" strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M43 46 q7 -7.5 14 0" />
        <path d="M63 46 q7 -7.5 14 0" />
      </g>
    );
    mouth = <path d="M55 57 q2.5 3 5 0 q2.5 3 5 0" stroke="#42321F" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
    extra = (
      <g fill="#FFB1B1" opacity=".8">
        <circle cx="40" cy="55" r="3.4" /><circle cx="80" cy="55" r="3.4" />
      </g>
    );
  } else if (state === "drowsy") {
    eyes = (
      <g>
        <g stroke="#42321F" strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M43 46 q7 4 14 0" /><path d="M63 46 q7 4 14 0" />
        </g>
        <circle cx="50" cy="47.5" r="1.4" fill="#42321F" /><circle cx="70" cy="47.5" r="1.4" fill="#42321F" />
      </g>
    );
    mouth = <path d="M57 58 q3 2 6 0" stroke="#42321F" strokeWidth="1.6" fill="none" strokeLinecap="round" />;
  } else if (state === "sleep") {
    eyes = (
      <g stroke="#42321F" strokeWidth="2.4" fill="none" strokeLinecap="round">
        <path d="M43 47 q7 5 14 0" /><path d="M63 47 q7 5 14 0" />
      </g>
    );
    mouth = <path d="M58 58 q2 1.8 4 0" stroke="#42321F" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    extra = (
      <g fill="#8FA1C4" fontWeight="900" fontFamily="ui-sans-serif">
        <text x="88" y="30" fontSize="13" className="zzz">z</text>
        <text x="97" y="18" fontSize="9" className="zzz" style={{ animationDelay: "0.9s" }}>z</text>
        <text x="103" y="9" fontSize="7" className="zzz" style={{ animationDelay: "1.8s" }}>z</text>
      </g>
    );
  } else {
    eyes = (
      <g className="anim-blink">
        <circle cx="50" cy="46" r="3.6" fill="#3B2B1B" /><circle cx="51.4" cy="44.8" r="1.2" fill="#fff" />
        <circle cx="70" cy="46" r="3.6" fill="#3B2B1B" /><circle cx="71.4" cy="44.8" r="1.2" fill="#fff" />
      </g>
    );
    mouth = <path d="M56 57 q2 2.4 4 0 q2 2.4 4 0" stroke="#42321F" strokeWidth="1.7" fill="none" strokeLinecap="round" />;
  }

  const stripes = colorway === "orange" || isCalico ? (
    <g stroke={p.light} strokeWidth="3" strokeLinecap="round" fill="none" opacity=".9">
      <path d="M50 27 q3 -4 6 0" /><path d="M60 25 q3 -4 6 0" /><path d="M70 27 q3 -4 6 0" />
      <path d="M50 66 q-2 5 0 9" /><path d="M62 68 q-2 5 0 9" />
    </g>
  ) : null;

  const patches = isCalico ? (
    <g fill={p.patch} opacity=".8">
      <path d="M40 30 a18 18 0 0 1 12 -8 l4 6 a22 22 0 0 0 -12 10 Z" />
      <ellipse cx="47" cy="86" rx="9" ry="6" />
    </g>
  ) : isCow ? (
    <g fill={p.patch} opacity=".85">
      <ellipse cx="46" cy="84" rx="11" ry="8" transform="rotate(-14 46 84)" />
      <ellipse cx="77" cy="72" rx="6" ry="9" transform="rotate(18 77 72)" />
      <path d="M42 30 a16 16 0 0 1 9 -7 l3 5 a20 20 0 0 0 -8 9 Z" />
    </g>
  ) : null;

  /* 员工配件 */
  let gear: React.ReactNode = null;
  if (accessory === "crown") {
    gear = (
      <g>
        <path d="M44 20 l5 -12 8 8 8 -10 8 10 8 -8 5 12 Z" fill="#FFC94D" stroke="#E8A93D" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="60" cy="13" r="2" fill="#FF5F7E" />
        <circle cx="48" cy="16" r="1.6" fill="#7C6CFF" /><circle cx="72" cy="16" r="1.6" fill="#7C6CFF" />
      </g>
    );
  } else if (accessory === "magnifier") {
    gear = (
      <g transform="rotate(18 96 62)">
        <circle cx="96" cy="60" r="10" fill="rgba(78,207,224,.14)" stroke="#4ECFE0" strokeWidth="2.6" />
        <line x1="103" y1="67" x2="112" y2="77" stroke="#4ECFE0" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="93" cy="57" r="2.6" fill="rgba(255,255,255,.5)" />
      </g>
    );
  } else if (accessory === "scroll") {
    gear = (
      <g transform="rotate(-8 22 66)">
        <rect x="12" y="60" width="24" height="13" rx="3" fill="#F3E9D2" stroke="#D9C9A3" strokeWidth="1.2" />
        <path d="M16 60 a4.5 4.5 0 1 0 0 13 M32 60 a4.5 4.5 0 1 1 0 13" fill="none" stroke="#D9C9A3" strokeWidth="1.4" />
        <g stroke="#B49A6A" strokeWidth="1.3" strokeLinecap="round">
          <line x1="21" y1="64" x2="28" y2="64" /><line x1="21" y1="67.5" x2="29" y2="67.5" /><line x1="21" y1="71" x2="26" y2="71" />
        </g>
      </g>
    );
  } else if (accessory === "envelope") {
    gear = (
      <g transform="rotate(6 96 64)">
        <rect x="84" y="58" width="24" height="15" rx="2.5" fill="#FDF6EC" stroke="#D9C9A3" strokeWidth="1.3" />
        <path d="M84 60 L96 68 L108 60" fill="none" stroke="#D9C9A3" strokeWidth="1.3" />
        <circle cx="96" cy="66" r="2" fill="#FF5F7E" />
      </g>
    );
  } else if (accessory === "coins") {
    gear = (
      <g>
        <g fill="#FFC94D" stroke="#E8A93D" strokeWidth="1.2">
          <ellipse cx="95" cy="92" rx="11" ry="4.2" />
          <ellipse cx="95" cy="86" rx="11" ry="4.2" />
          <ellipse cx="95" cy="80" rx="11" ry="4.2" />
        </g>
        <path d="M95 77 l1.6 3.2 3.2 1.6 -3.2 1.6 -1.6 3.2 -1.6 -3.2 -3.2 -1.6 3.2 -1.6 Z" fill="#FFF3D0" />
      </g>
    );
  }

  const badgeRing = badge === "risk" ? (
    <circle cx="60" cy="58" r="55" fill="none" stroke="var(--red)" strokeWidth="1.6" strokeDasharray="7 9" opacity=".55" style={{ animation: "breathe 2.4s ease-in-out infinite" }} />
  ) : badge === "premium" ? (
    <circle cx="60" cy="58" r="55" fill="none" stroke="var(--yellow)" strokeWidth="1.4" strokeDasharray="2 7" opacity=".5" />
  ) : null;

  const premiumCrown = badge === "premium" ? (
    <path d="M50 20 l4.4 -10 6.6 6.6 6.6 -8.4 6.6 8.4 6.6 -6.6 4.4 10 Z" fill="none" stroke="#FFC94D" strokeWidth="1.8" strokeLinejoin="round" opacity=".9" />
  ) : null;

  return (
    <svg
      width={size} height={(size * 110) / 120} viewBox="0 0 120 110"
      className={className} style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <ellipse cx="60" cy="103" rx="34" ry="5" fill="rgba(0,0,0,.35)" />
      {badgeRing}
      <g className={working ? "anim-bob" : undefined}>
        {/* 尾巴 */}
        <path d="M84 94 q22 3 24 -16 q1 -11 -11 -12" fill="none" stroke={p.dark} strokeWidth="9" strokeLinecap="round" className="anim-sway" />
        {/* 身体 */}
        <ellipse cx="60" cy="82" rx="27" ry="23" fill={p.base} />
        <ellipse cx="60" cy="90" rx="15" ry="11" fill={p.light} opacity=".55" />
        {patches}
        {/* 耳朵 */}
        <path d="M40 34 L33 12 L55 25 Z" fill={p.base} />
        <path d="M80 34 L87 12 L65 25 Z" fill={p.base} />
        <path d="M42.5 30 L38.5 17.5 L52 25 Z" fill="#FFC9B0" />
        <path d="M77.5 30 L81.5 17.5 L68 25 Z" fill="#FFC9B0" />
        {/* 头 */}
        <circle cx="60" cy="48" r="25" fill={p.base} />
        {stripes}
        {/* 胡须 */}
        <g stroke="rgba(233,238,251,.5)" strokeWidth="1.2" strokeLinecap="round">
          <line x1="30" y1="52" x2="40" y2="53" /><line x1="30" y1="58" x2="40" y2="57" />
          <line x1="90" y1="52" x2="80" y2="53" /><line x1="90" y1="58" x2="80" y2="57" />
        </g>
        {eyes}
        {/* 鼻子 + 嘴 */}
        <path d="M58 53.5 L62 53.5 L60 56.5 Z" fill="#E8887F" />
        {mouth}
        {extra}
        {premiumCrown}
      </g>
      {gear}
    </svg>
  );
}
