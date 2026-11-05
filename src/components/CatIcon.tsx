/**
 * 猫咪 SVG:会员关系的可视化 + AI 员工的角色形象。
 * state: sleep | drowsy | awake | happy
 */
const COLORWAYS: Record<string, { tone: string; dark: string; light: string }> = {
  orange: { tone: "#F5A25D", dark: "#D98E4A", light: "#FFD9B4" },
  gray: { tone: "#AEB6C2", dark: "#8F97A6", light: "#D8DDE6" },
  calico: { tone: "#E8B36A", dark: "#C79046", light: "#FFE3BD" },
  cow: { tone: "#C9CDD4", dark: "#A9ADB6", light: "#F0F2F5" },
  ragdoll: { tone: "#EBD6BC", dark: "#CCB394", light: "#FBF0DE" },
};

function shade(hex: string, p: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (p / 100) * 255)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function CatIcon({
  state, colorway = "orange", size = 56,
}: { state: "sleep" | "drowsy" | "awake" | "happy"; colorway?: string; size?: number }) {
  const c = COLORWAYS[colorway] ?? COLORWAYS.orange;
  const tone = c.tone, dark = shade(c.tone, -18), light = c.light;
  let eyes: string, mouth: string, extra = "";
  if (state === "sleep") {
    eyes = `<path d="M27 34 q3 3 6 0 M39 34 q3 3 6 0" stroke="#4A3524" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M34.5 40 q1.8 1.6 3.6 0" stroke="#4A3524" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    extra = `<text x="46" y="16" font-size="8" font-weight="900" fill="#8FA1C4">z</text><text x="51" y="10" font-size="6" font-weight="900" fill="#8FA1C4">z</text>`;
  } else if (state === "drowsy") {
    eyes = `<path d="M27 34 q3 1.6 6 0 M39 34 q3 1.6 6 0" stroke="#4A3524" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="30" cy="33.2" r="1" fill="#4A3524"/><circle cx="42" cy="33.2" r="1" fill="#4A3524"/>`;
    mouth = `<path d="M34.5 40 q1.8 1.2 3.6 0" stroke="#4A3524" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  } else if (state === "happy") {
    eyes = `<path d="M27 33 q3 -3.4 6 0 M39 33 q3 -3.4 6 0" stroke="#4A3524" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    mouth = `<path d="M33 39.5 q2.6 2.6 5.2 0" stroke="#4A3524" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="25.5" cy="38.5" r="2" fill="#FFB3B3" opacity=".85"/><circle cx="46.5" cy="38.5" r="2" fill="#FFB3B3" opacity=".85"/>`;
  } else {
    eyes = `<circle cx="30" cy="33" r="2.6" fill="#3E2C1D"/><circle cx="31" cy="32.2" r=".9" fill="#fff"/><circle cx="42" cy="33" r="2.6" fill="#3E2C1D"/><circle cx="43" cy="32.2" r=".9" fill="#fff"/>`;
    mouth = `<path d="M34.5 39.5 q1.9 1.8 3.8 0" stroke="#4A3524" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
  }
  const stripes = colorway === "orange" || colorway === "calico"
    ? `<path d="M28 21.5 q2 -3 4.5 0 M39 21 q2 -3 4.5 0" stroke="${light}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : "";
  const patches = colorway === "calico"
    ? `<path d="M44 26 a7 7 0 0 1 6 6 l-2 4 a9 9 0 0 1 -7 -8 Z" fill="#B4763B" opacity=".8"/><ellipse cx="26" cy="47" rx="7" ry="5" fill="#7A4A22" opacity=".55"/>`
    : colorway === "cow"
      ? `<ellipse cx="45" cy="44" rx="8" ry="6" fill="#3B3F4A" opacity=".85"/><ellipse cx="27" cy="38" rx="5" ry="4" fill="#3B3F4A" opacity=".7"/>`
      : "";
  return (
    <svg width={size} height={(size * 58) / 72} viewBox="0 0 72 58" style={{ display: "block" }}>
      <ellipse cx="36" cy="52" rx="24" ry="4.5" fill="rgba(0,0,0,.28)" />
      <path d="M57 47 q9 -3 8 -12 q-1 -6 -7 -5" stroke={dark} stroke-width="6.5" fill="none" stroke-linecap="round" />
      <ellipse cx="36" cy="42" rx="19" ry="13" fill={tone} />
      <ellipse cx="36" cy="46" rx="10" ry="7" fill={light} opacity=".4" />
      <circle cx="36" cy="33" r="14" fill={tone} />
      <path d="M23.5 23.5 L19.5 11 L31.5 19 Z" fill={tone} />
      <path d="M48.5 23.5 L52.5 11 L40.5 19 Z" fill={tone} />
      <path d="M24.3 21 L22.4 14.8 L28.6 18.6 Z" fill="#FFC9B0" />
      <path d="M47.7 21 L49.6 14.8 L43.4 18.6 Z" fill="#FFC9B0" />
      {stripes}{patches}{eyes}{mouth}{extra}
    </svg>
  );
}
