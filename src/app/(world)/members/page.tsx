"use client";

/* ============================================================
   会员生态 Member Habitat
   地图视图(四大生态区域卡片) ⇄ 列表视图(精致会员卡片网格)
   搜索 / 区域筛选 / 消费排序 / 档案抽屉 / AI 分析按钮
   ============================================================ */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Search, SlidersHorizontal } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import MemberCard from "@/components/world/MemberCard";
import MemberProfileDrawer from "@/components/world/MemberProfileDrawer";
import RegionCard from "@/components/world/RegionCard";
import ZoneBackdrop from "@/components/world/ZoneBackdrop";
import { DemoTag, PageHeader, StatTile } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { DASHBOARD } from "@/mock-data/workspace";
import { MemberCatView, Zone } from "@/mock-data/types";
import { ZONE_META } from "@/mock-data/members";

/* 四大生态区域:活跃街区并入新会员村(村民) */
type HabitatKey = "street" | "forest" | "manor" | "alert";

const HABITATS: {
  key: HabitatKey; title: string; zones: Zone[]; backdrop: Zone;
  accent: string; glow: string; desc: string; advice: string; extraNote?: (n: number) => string;
}[] = [
  {
    key: "street", title: "活跃街区", zones: ["active", "new"], backdrop: "active",
    accent: ZONE_META.active.accent, glow: ZONE_META.active.glow,
    desc: ZONE_META.active.desc, advice: ZONE_META.active.advice,
    extraNote: (n) => `含新村民 ${n} 只`,
  },
  {
    key: "forest", title: "沉睡森林", zones: ["sleeping"], backdrop: "sleeping",
    accent: ZONE_META.sleeping.accent, glow: ZONE_META.sleeping.glow,
    desc: ZONE_META.sleeping.desc, advice: ZONE_META.sleeping.advice,
  },
  {
    key: "manor", title: "高价值庄园", zones: ["premium"], backdrop: "premium",
    accent: ZONE_META.premium.accent, glow: ZONE_META.premium.glow,
    desc: ZONE_META.premium.desc, advice: ZONE_META.premium.advice,
  },
  {
    key: "alert", title: "风险警戒区", zones: ["risk"], backdrop: "risk",
    accent: ZONE_META.risk.accent, glow: ZONE_META.risk.glow,
    desc: ZONE_META.risk.desc, advice: ZONE_META.risk.advice,
  },
];

const habitatOf = (m: MemberCatView): HabitatKey =>
  m.zone === "sleeping" ? "forest" : m.zone === "premium" ? "manor" : m.zone === "risk" ? "alert" : "street";

const SORTS = [
  { key: "spend", label: "消费额最高" },
  { key: "recent", label: "最近到店" },
  { key: "risk", label: "流失风险" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];
const RISK_W = { high: 2, mid: 1, low: 0 } as const;

export default function MembersPage() {
  const [members, setMembers] = useState<MemberCatView[]>([]);
  const [mode, setMode] = useState<"map" | "list">("map");
  const [habitat, setHabitat] = useState<HabitatKey>("street");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("spend");
  const [selected, setSelected] = useState<MemberCatView | null>(null);

  useEffect(() => { dataProvider.getMembers().then(setMembers); }, []);

  const k = DASHBOARD.kpis;
  const newCount = members.filter((m) => m.zone === "new").length;

  const filtered = useMemo(() => {
    let list = members.filter((m) => m.name.includes(query.trim()));
    if (mode === "list") list = list.filter((m) => habitatOf(m) === habitat);
    return [...list].sort((a, b) => {
      if (sort === "spend") return b.spend - a.spend;
      if (sort === "recent") return a.lastVisitDays - b.lastVisitDays;
      return RISK_W[b.risk] - RISK_W[a.risk] || b.spend - a.spend;
    });
  }, [members, query, sort, mode, habitat]);

  const activeHabitat = HABITATS.find((h) => h.key === habitat)!;

  function openRegion(key: HabitatKey) {
    setHabitat(key);
    setMode("list");
    setQuery("");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="会员生态"
        desc="你的每一位会员,都有自己的故事。AI 团队负责观察、分析和经营这片生态。"
        right={<DemoTag label="演示生态" />}
      />

      {/* 顶部核心指标(与驾驶舱同源的演示唱数) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        <StatTile label="总会员数" value={k.totalMembers.toLocaleString()} sub="喵屋美甲全量档案" />
        <StatTile label="活跃会员" value={k.activeMembers.toLocaleString()} accent="var(--green)" sub="30 天内有到店" />
        <StatTile label="沉睡会员" value={k.sleepingMembers.toLocaleString()} accent="var(--brand-2)" sub="35 天以上未到店" />
        <StatTile label="高价值会员" value={k.premiumMembers.toLocaleString()} accent="var(--yellow)" sub="庄园常住居民" />
        <StatTile label="高流失风险" value={k.highRiskMembers.toLocaleString()} accent="var(--red)" sub="需要立刻行动" />
      </div>

      {/* 搜索与筛选(常驻) */}
      <div className="surface p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
          <input
            className="input pl-9" placeholder="搜索会员昵称…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (e.target.value && mode === "map") setMode("list"); }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setMode("list"); setHabitat(habitat); }}
            className="tag transition-all"
            style={mode === "list" ? { color: "var(--brand-2)", borderColor: "var(--brand)", background: "rgba(124,108,255,.08)" } : {}}
          >
            会员列表
          </button>
          {HABITATS.map((h) => {
            const count = members.filter((m) => habitatOf(m) === h.key).length;
            const active = mode === "list" && habitat === h.key;
            return (
              <button key={h.key} onClick={() => { setMode("list"); setHabitat(h.key); }}
                className="tag transition-all"
                style={active ? { color: h.accent, borderColor: h.accent, background: "rgba(124,108,255,.08)" } : {}}>
                {h.title} · {count}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <SlidersHorizontal size={14} style={{ color: "var(--ink-3)" }} />
          <select className="input !w-auto !py-1.5 text-[12.5px]" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === "map" ? (
          /* ============ 生态地图 ============ */
          <motion.div
            key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }} className="space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-4">
              {HABITATS.map((h) => {
                const list = members.filter((m) => habitatOf(m) === h.key);
                const preview = [...list].sort((a, b) =>
                  h.key === "manor" || h.key === "alert" ? b.spend - a.spend : a.lastVisitDays - b.lastVisitDays);
                return (
                  <RegionCard
                    key={h.key}
                    title={h.title} desc={h.desc} advice={h.advice} accent={h.accent}
                    count={list.length}
                    extraNote={h.extraNote?.(newCount)}
                    backdrop={h.backdrop}
                    previewMembers={preview}
                    onClick={() => openRegion(h.key)}
                  />
                );
              })}
            </div>
            <p className="text-[11.5px] text-center" style={{ color: "var(--ink-3)" }}>
              生态唱数(总 2,800 只)为演示数据;以下 {members.length} 只有完整档案,点击区域进入街区管理。
            </p>
          </motion.div>
        ) : (
          /* ============ 街区列表 ============ */
          <motion.div
            key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }} className="space-y-4"
          >
            {/* 街区横幅 */}
            <div className="surface relative overflow-hidden p-5">
              <ZoneBackdrop zone={activeHabitat.backdrop} />
              <div className="relative flex items-center gap-4 flex-wrap">
                <button
                  onClick={() => { setMode("map"); setQuery(""); }}
                  className="btn btn-ghost btn-sm shrink-0"
                >
                  <ArrowLeft size={13} /> 生态地图
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-[17px] font-extrabold" style={{ color: activeHabitat.accent }}>{activeHabitat.title}</h2>
                    <span className="tag" style={{ color: activeHabitat.accent, borderColor: activeHabitat.accent }}>
                      {filtered.length} 只匹配
                    </span>
                  </div>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-2)" }}>{activeHabitat.desc}</p>
                </div>
                <div className="ml-auto flex items-start gap-1.5 max-w-[360px]">
                  <span className="tag tag-brand shrink-0 mt-px">AI 建议</span>
                  <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{activeHabitat.advice}</p>
                </div>
              </div>
            </div>

            {/* 会员卡片网格 */}
            {filtered.length === 0 ? (
              <div className="surface p-12 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
                没有匹配「{query}」的会员,换个名字试试?
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filtered.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.035, 0.4), duration: 0.35 }}
                  >
                    <MemberCard member={m} onOpen={() => setSelected(m)} />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 档案抽屉 */}
      <AnimatePresence>
        {selected && <MemberProfileDrawer member={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
