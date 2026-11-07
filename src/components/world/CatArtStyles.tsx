"use client";

/* ============================================================
   CatArtStyles:猫咪造型方案 B/C/D/E 的渲染节点(A 为原有管线)
   每种画法支持:四状态(awake/happy/drowsy/sleep)× 六配色 × 皇冠
   输出为 SVG 内部节点(不含 <svg> 包装),由 CatCharacter 统一包装。
   ============================================================ */
import type { CatState } from "@/mock-data/types";

type Palette = { base: string; dark: string; deep: string; light: string; belly: string };
const INK = "#2E2013";
const PINK = "#FFC9D6";
const GOLD = "#FFC94D";

type Eyes = "open" | "happy" | "drowsy" | "closed";
function eyesOf(state: CatState): Eyes {
  if (state === "happy") return "happy";
  if (state === "drowsy") return "drowsy";
  if (state === "sleep") return "closed";
  return "open";
}

function Zzz({ x = 88, y = 24, muted = "#8FA1C4" }: { x?: number; y?: number; muted?: string }) {
  return (
    <g fill={muted} fontWeight={900} fontFamily="ui-sans-serif">
      <text x={x} y={y} fontSize={14} className="zzz">z</text>
      <text x={x + 10} y={y - 12} fontSize={10} className="zzz" style={{ animationDelay: "0.9s" }}>z</text>
      <text x={x + 17} y={y - 23} fontSize={7.5} className="zzz" style={{ animationDelay: "1.8s" }}>z</text>
    </g>
  );
}

function Crown({ gold, gem }: { gold: string; gem: string }) {
  return (
    <g transform="translate(-6,2)">
      <path d="M44 12 l6 -8 l6 7 l6 -7 l6 7 l6 -7 v12 z" fill={gold} stroke="#9C7A1E" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="60" cy="3.2" r="2" fill={gem} />
    </g>
  );
}

/* ---------- B 贴纸描边 ---------- */
function StyleB(state: CatState, p: Palette, crown: boolean, gold: string, gem: string) {
  const e = eyesOf(state);
  const eyes = e === "closed"
    ? <path d="M42 49 q6 5 12 0 M66 49 q6 5 12 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    : e === "happy"
      ? <path d="M42 50 q6 -7 12 0 M66 50 q6 -7 12 0" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      : e === "drowsy"
        ? <g><path d="M42 49 q6 4 12 0 M66 49 q6 4 12 0" stroke={INK} strokeWidth="3.2" fill="none" strokeLinecap="round" /><circle cx="48" cy="50.5" r="1.6" fill={INK} /><circle cx="72" cy="50.5" r="1.6" fill={INK} /></g>
        : <g><circle cx="48" cy="48" r="4.6" fill={INK} /><circle cx="49.6" cy="46.6" r="1.5" fill="#fff" /><circle cx="72" cy="48" r="4.6" fill={INK} /><circle cx="73.6" cy="46.6" r="1.5" fill="#fff" /></g>;
  return (
    <g>
      {state === "sleep" && <Zzz x={88} y={24} muted={INK} />}
      <g stroke="#fff" strokeWidth={13} fill="none" strokeLinecap="round"><path d="M88 84 q22 -2 18 -22" /></g>
      <g stroke="#fff" strokeWidth={12} fill="#fff">
        <ellipse cx="60" cy="86" rx="27" ry="23" />
        <path d="M31 34 L26 8 L52 21 Z" /><path d="M89 34 L94 8 L68 21 Z" />
        <circle cx="60" cy="51" r="33" />
      </g>
      <path d="M88 84 q22 -2 18 -22 q-3 -14 -16 -12" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="86" rx="27" ry="23" fill={p.base} stroke={INK} strokeWidth={4} />
      <path d="M31 34 L26 8 L52 21 Z" fill={p.base} stroke={INK} strokeWidth={4} />
      <path d="M36.5 27 L33.5 15 L46 20.5 Z" fill={PINK} />
      <path d="M89 34 L94 8 L68 21 Z" fill={p.base} stroke={INK} strokeWidth={4} />
      <path d="M83.5 27 L86.5 15 L74 20.5 Z" fill={PINK} />
      <circle cx="60" cy="51" r="33" fill={p.base} stroke={INK} strokeWidth={4} />
      <ellipse cx="60" cy="92" rx="13" ry="11" fill={p.belly} stroke={INK} strokeWidth={3} />
      {eyes}
      <path d="M56.5 60.5 q3.5 3.5 7 0" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M30 52 h12 M30 58 h12 M78 52 h12 M78 58 h12" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {(e === "happy") && <g fill="#FF9D7E" opacity=".55"><circle cx="39" cy="57" r="4" /><circle cx="81" cy="57" r="4" /></g>}
      {crown && <Crown gold={gold} gem={gem} />}
    </g>
  );
}

/* ---------- C 毛绒绒 ---------- */
function fluff(cx: number, cy: number, r: number, n: number, fill: string, amp: number) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r - amp;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return <polygon points={pts.join(" ")} fill={fill} />;
}
function StyleC(state: CatState, p: Palette, crown: boolean, gold: string, gem: string) {
  const e = eyesOf(state);
  const eyes = e === "closed"
    ? <path d="M43 49 q6 4 12 0 M65 49 q6 4 12 0" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    : e === "happy"
      ? <path d="M43 50 q6 -7 12 0 M65 50 q6 -7 12 0" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      : e === "drowsy"
        ? <g><path d="M43 49 q6 3.6 12 0 M65 49 q6 3.6 12 0" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" /><circle cx="49" cy="50.4" r="1.5" fill={INK} /><circle cx="71" cy="50.4" r="1.5" fill={INK} /></g>
        : <g><circle cx="48" cy="48" r="5.4" fill={INK} /><path d="M45 45 l3.2 3.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /><circle cx="72" cy="48" r="5.4" fill={INK} /><path d="M69 45 l3.2 3.2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></g>;
  const spikes: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    spikes.push(<path key={i} d={`M${34 + i * 9} ${26 - (i % 2) * 4} l4 -7 l3 7`} stroke={p.base} strokeWidth={3} fill={p.base} strokeLinejoin="round" />);
  }
  return (
    <g>
      {state === "sleep" && <Zzz x={88} y={24} />}
      <path d="M86 86 q20 0 18 -18 q-2 -12 -14 -11" stroke={p.dark} strokeWidth={9} fill="none" strokeLinecap="round" strokeDasharray="0.5 7" />
      {fluff(60, 86, 27, 22, p.dark, 3)}
      {fluff(60, 86, 24, 22, p.base, 3)}
      {fluff(60, 51, 32, 26, p.base, 4)}
      <path d="M34 30 L29 10 L50 22 Z" fill={p.base} /><path d="M86 30 L91 10 L70 22 Z" fill={p.base} />
      <path d="M37 26 L34 15 L45 20 Z" fill={PINK} /><path d="M83 26 L86 15 L75 20 Z" fill={PINK} />
      <ellipse cx="60" cy="64" rx="12" ry="9" fill={p.belly} />
      <ellipse cx="60" cy="92" rx="11" ry="9" fill={p.belly} />
      {eyes}
      <path d="M57 60.5 q3 2.8 6 0" stroke={INK} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="57" r="4" fill="#FF9D7E" opacity=".5" /><circle cx="80" cy="57" r="4" fill="#FF9D7E" opacity=".5" />
      {crown && <Crown gold={gold} gem={gem} />}
    </g>
  );
}

/* ---------- D 果冻高光 ---------- */
function StyleD(state: CatState, p: Palette, crown: boolean, gold: string, gem: string, uid: string) {
  const e = eyesOf(state);
  const eyes = e === "closed"
    ? <path d="M42 50 q6 4.5 12 0 M66 50 q6 4.5 12 0" stroke="#5B3413" strokeWidth={3} fill="none" strokeLinecap="round" />
    : e === "happy"
      ? <path d="M42 51 q6 -8 12 0 M66 51 q6 -8 12 0" stroke="#5B3413" strokeWidth={3} fill="none" strokeLinecap="round" />
      : e === "drowsy"
        ? <g><path d="M42 50 q6 4 12 0 M66 50 q6 4 12 0" stroke="#5B3413" strokeWidth={2.8} fill="none" strokeLinecap="round" /><circle cx="48" cy="51" r="1.6" fill="#5B3413" /><circle cx="72" cy="51" r="1.6" fill="#5B3413" /></g>
        : <g>
          <ellipse cx="48" cy="49" rx="7" ry="7.6" fill="#3A2410" /><ellipse cx="48" cy="51" rx="4.6" ry="4.8" fill="#120A04" />
          <circle cx="45.6" cy="46.6" r="2.4" fill="#fff" /><circle cx="50.4" cy="52.6" r="1.2" fill="#fff" opacity=".8" />
          <ellipse cx="72" cy="49" rx="7" ry="7.6" fill="#3A2410" /><ellipse cx="72" cy="51" rx="4.6" ry="4.8" fill="#120A04" />
          <circle cx="69.6" cy="46.6" r="2.4" fill="#fff" /><circle cx="74.4" cy="52.6" r="1.2" fill="#fff" opacity=".8" />
        </g>;
  return (
    <g>
      {state === "sleep" ? <Zzz x={88} y={24} muted="#B9C2D8" /> : (
        <g fill="#FFE9B8">
          <path d="M100 30 l2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 z" />
          <path d="M14 42 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8 z" opacity=".8" />
        </g>
      )}
      <ellipse cx="60" cy="108" rx="30" ry="6" fill="#000" opacity=".35" />
      <path d="M34 96 q-4 -18 6 -26 l40 0 q10 8 6 26 q-26 8 -52 0 z" fill={`url(#jd_${uid})`} />
      <path d="M60 14 q34 0 34 36 q0 10 -6 13 q-28 8 -56 0 q-6 -3 -6 -13 q0 -36 34 -36 z" fill={`url(#jd_${uid})`} />
      <path d="M33 32 L29 8 L53 20 Z" fill={`url(#jd_${uid})`} opacity=".95" />
      <path d="M87 32 L91 8 L67 20 Z" fill={`url(#jd_${uid})`} opacity=".95" />
      <ellipse cx="44" cy="30" rx="13" ry="7" fill="#fff" opacity=".55" transform="rotate(-18 44 30)" />
      <circle cx="52" cy="22" r="2.6" fill="#fff" opacity=".8" />
      {eyes}
      <path d="M56 62 q4 4 8 0" stroke="#5B3413" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <ellipse cx="38" cy="60" rx="5" ry="3.4" fill="#FF8FA0" opacity=".65" />
      <ellipse cx="82" cy="60" rx="5" ry="3.4" fill="#FF8FA0" opacity=".65" />
      {crown && <Crown gold={gold} gem={gem} />}
    </g>
  );
}

/* ---------- E 像素猫舍 ---------- */
const PIXMAP = [
  "....G.GG.G.G....",
  "....GGGGGGGG....",
  "...PPP....PPP...",
  "..PPBBB..BBBPP..",
  "..PBBBBBBBBBBP..",
  "..BBBBBBBBBBBB..",
  "..BWEBBBBBBWEB..",
  "..BEEBBBBBBEEB..",
  "..BBBBBPPBBBBB..",
  "..BBBBBBBBBBBB..",
  "...BBLLLLLLBB...",
  "..BBLLLLLLLLBB..",
  "..BBLLLLLLLLBB.T",
  "..BBBBBBBBBBB.T.",
  "..BBBBBBBBBBB.T.",
  "...BBBBBBBBB..T."
];
function StyleE(state: CatState, p: Palette, crown: boolean) {
  const col: Record<string, string> = {
    B: p.base, L: p.belly, W: "#FFFFFF", E: INK, P: PINK, G: GOLD, T: p.dark,
  };
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < PIXMAP.length; y++) {
    for (let x = 0; x < PIXMAP[y].length; x++) {
      let ch = PIXMAP[y][x];
      if (ch === ".") continue;
      if (state === "sleep" && (ch === "W" || ch === "E")) ch = "B";
      if (state === "happy" && ch === "E" && (y === 6 || y === 7) && x !== 4 && x !== 12) continue; // happy:眯眼
      rects.push(<rect key={`${x}-${y}`} x={4 + x * 7} y={6 + y * 6.6} width={7} height={6.6} fill={col[ch]} />);
    }
  }
  return (
    <g shapeRendering="crispEdges">
      {state === "sleep" && <Zzz x={88} y={22} />}
      {rects}
      {crown && <Crown gold={GOLD} gem="#E25555" />}
      {state === "awake" && <text x={86} y={16} fontSize={12} fill="#8B93A8" fontWeight={800}>★</text>}
    </g>
  );
}

/** 出口:按 style 返回身体节点(不含 svg 包装);crown 由调用方决定 */
export function AltCatArt(opts: {
  style: "B" | "C" | "D" | "E";
  state: CatState;
  p: Palette;
  crown: boolean;
  gold: string; gem: string; uid: string;
}) {
  const { style, state, p, crown, gold, gem, uid } = opts;
  switch (style) {
    case "B": return StyleB(state, p, crown, gold, gem);
    case "C": return StyleC(state, p, crown, gold, gem);
    case "D": return StyleD(state, p, crown, gold, gem, uid);
    case "E": return StyleE(state, p, crown);
  }
}
