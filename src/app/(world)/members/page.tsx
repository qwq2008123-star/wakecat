"use client";

/* 会员宇宙:五大街区 × 猫咪角色 × 档案抽屉 + 搜索/筛选/排序 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import MemberProfileDrawer from "@/components/world/MemberProfileDrawer";
import ZoneBackdrop from "@/components/world/ZoneBackdrop";
import { DemoTag, PageHeader } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { MemberCatView, Zone } from "@/mock-data/types";
import { ZONE_META, ZONE_ORDER } from "@/mock-data/members";

type SortKey = "spend" | "recent" | "risk";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "spend", label: "消费额最高" },
  { key: "recent", label: "最近到店" },
  { key: "risk", label: "流失风险" },
];

const RISK_WEIGHT = { high: 2, mid: 1, low: 0 } as const;

export default function MembersPage() {
  const [members, setMembers] = useState<MemberCatView[]>([]);
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState<Zone | "all">("all");
  const [sort, setSort] = useState<SortKey>("spend");
  const [selected, setSelected] = useState<MemberCatView | null>(null);

  useEffect(() => { dataProvider.getMembers().then(setMembers); }, []);

  const filtered = useMemo(() => {
    let list = members.filter((m) => m.name.includes(query.trim()));
    if (zone !== "all") list = list.filter((m) => m.zone === zone);
    list = [...list].sort((a, b) => {
      if (sort === "spend") return b.spend - a.spend;
      if (sort === "recent") return a.lastVisitDays - b.lastVisitDays;
      return RISK_WEIGHT[b.risk] - RISK_WEIGHT[a.risk] || b.spend - a.spend;
    });
    return list;
  }, [members, query, zone, sort]);

  const zones: (Zone | "all")[] = ["all", ...ZONE_ORDER];

  return (
    <div className="space-y-6">
      <PageHeader
        title="会员宇宙"
        desc="每一位会员都是一只猫:她的消费让猫精神,她的沉默让猫打盹。点击猫咪打开档案。"
        right={<DemoTag label="演示会员 · 46 只上屏" />}
      />

      {/* 控制台:搜索 / 分区 / 排序 */}
      <div className="surface p-3.5 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
          <input className="input pl-9" placeholder="搜索会员昵称…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {zones.map((z) => {
            const active = zone === z;
            const label = z === "all" ? "全部街区" : ZONE_META[z].label;
            return (
              <button
                key={z} onClick={() => setZone(z)}
                className="tag transition-all"
                style={active
                  ? { color: z === "all" ? "var(--brand-2)" : ZONE_META[z].accent, borderColor: z === "all" ? "var(--brand)" : ZONE_META[z].accent, background: "rgba(124,108,255,.08)" }
                  : {}}
              >
                {label}{z !== "all" && ` · ${members.filter((m) => m.zone === z).length}`}
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

      {/* 街区 */}
      {ZONE_ORDER.filter((z) => zone === "all" || zone === z).map((z) => {
        const meta = ZONE_META[z];
        const list = filtered.filter((m) => m.zone === z);
        return (
          <section key={z} className="relative">
            {/* 街区氛围光 */}
            <div className="aurora" style={{ width: "40%", height: 140, top: -30, left: "4%", background: meta.glow }} />
            <div className="relative flex items-baseline gap-3 mb-1 px-1">
              <h2 className="text-[16px] font-extrabold tracking-wide" style={{ color: meta.accent }}>{meta.label}</h2>
              <span className="text-[12px]" style={{ color: "var(--ink-2)" }}>{meta.desc}</span>
              <span className="tag ml-auto">{list.length} 只</span>
            </div>
            {/* 猫群:错落排布 + 街区布景 */}
            <div className="surface relative overflow-hidden px-5 pt-8 pb-6 min-h-[172px]">
              <ZoneBackdrop zone={z} />
              <div className="absolute left-0 right-0 bottom-0 h-12" style={{ background: `linear-gradient(180deg, transparent, ${meta.glow})` }} />
              {list.length === 0 ? (
                <div className="py-10 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>这个街区暂时没有匹配的会员</div>
              ) : (
                <div className="relative flex flex-wrap items-end gap-x-5 gap-y-6">
                  {list.map((m, i) => {
                    const size = m.zone === "premium" ? 84 : 72 - (i % 3) * 4;
                    const lift = [0, 10, 4, 14, 6][i % 5];
                    return (
                      <motion.button
                        key={m.id}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.5), duration: 0.4 }}
                        whileHover={{ y: -6 }}
                        onClick={() => setSelected(m)}
                        className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                        style={{ transform: `translateY(${-lift}px)`, minWidth: 76 }}
                        aria-label={`打开 ${m.name} 的档案`}
                      >
                        <CatCharacter
                          colorway={m.colorway} state={m.state} size={size}
                          badge={m.zone === "premium" ? "premium" : m.risk === "high" ? "risk" : null}
                        />
                        <span className="text-[12px] font-bold leading-tight">{m.name}</span>
                        <span className="text-[10px]" style={{ color: "var(--ink-3)" }}>
                          {m.zone === "premium" ? "Lv.9 庄园" : `${m.lastVisitDays}天前`}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              )}
              <div className="relative mt-4 text-[11px]" style={{ color: "var(--ink-3)" }}>
                全店该分区共 {zone === "all" ? "" : ""}{z === "sleeping" ? "620" : z === "active" ? "1,860" : z === "premium" ? "96" : z === "new" ? "144" : "120"} 位会员(演示唱数),此处展示有完整档案的个体。
              </div>
            </div>
          </section>
        );
      })}

      {/* 档案抽屉 */}
      <AnimatePresence>
        {selected && (
          <MemberProfileDrawer member={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
