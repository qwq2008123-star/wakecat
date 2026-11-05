"use client";

/* 记忆博物馆:档案馆质感的时间轴,每条记忆带来源(反编造原则的可视化) */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Landmark } from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import { DemoTag, PageHeader } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { MemberCatView, MemoryEntry } from "@/mock-data/types";

export default function MemoryPage() {
  const [members, setMembers] = useState<MemberCatView[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memberId, setMemberId] = useState<string>("all");

  useEffect(() => {
    dataProvider.getMembers().then(setMembers);
    dataProvider.getMemories().then(setMemories);
  }, []);

  const list = useMemo(
    () => (memberId === "all" ? memories : memories.filter((m) => m.memberId === memberId))
      .slice().sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [memories, memberId],
  );
  const withMemories = useMemo(() => members.filter((m) => memories.some((x) => x.memberId === m.id)), [members, memories]);
  const current = members.find((m) => m.id === memberId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="会员记忆博物馆"
        desc="侦探喵为每位会员建立的长期档案:每一条记忆都有数据来源,禁止编造。这里是 AI 团队「记得你」的证据馆。"
        right={<DemoTag label="演示档案" />}
      />

      {/* 馆藏选择 */}
      <div className="surface p-3.5 flex items-center gap-2.5 flex-wrap">
        <Landmark size={15} style={{ color: "var(--brand-2)" }} />
        <button
          onClick={() => setMemberId("all")}
          className="tag transition-all"
          style={memberId === "all" ? { color: "var(--brand-2)", borderColor: "var(--brand)", background: "rgba(124,108,255,.1)" } : {}}
        >
          全馆藏品 · {memories.length}
        </button>
        {withMemories.map((m) => (
          <button
            key={m.id} onClick={() => setMemberId(m.id)}
            className="tag transition-all inline-flex items-center gap-1.5"
            style={memberId === m.id ? { color: "var(--brand-2)", borderColor: "var(--brand)", background: "rgba(124,108,255,.1)" } : {}}
          >
            <CatCharacter colorway={m.colorway} state="awake" size={16} accessory={null} />
            {m.name}
          </button>
        ))}
      </div>

      {/* 展馆 */}
      {current && (
        <div className="surface p-5 flex items-center gap-5 relative overflow-hidden">
          <div className="aurora" style={{ width: 240, height: 140, top: -60, left: "10%", background: "rgba(124,108,255,.16)" }} />
          <CatCharacter
            colorway={current.colorway} state={current.state} size={84}
            badge={current.zone === "premium" ? "premium" : current.risk === "high" ? "risk" : null}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-extrabold">{current.name} 的专属展柜</h2>
              <span className="tag tag-brand">{current.level}</span>
            </div>
            <p className="text-[12.5px] mt-1" style={{ color: "var(--ink-2)" }}>
              {current.favoriteService} 常客 · 累计 ¥{current.spend.toLocaleString()} · {current.visits} 次到店
            </p>
          </div>
          <Brain className="ml-auto hidden md:block" size={44} style={{ color: "var(--line)" }} />
        </div>
      )}

      {/* 时间轴 */}
      <div className="surface p-6 md:p-8 relative overflow-hidden">
        <div className="aurora" style={{ width: 300, height: 200, bottom: -80, right: "10%", background: "rgba(124,108,255,.1)" }} />
        <div className="relative max-w-[720px]">
          {list.length === 0 && (
            <p className="text-[13px] py-8 text-center" style={{ color: "var(--ink-3)" }}>该展柜暂无藏品</p>
          )}
          <div className="relative pl-6 space-y-7">
            <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: "linear-gradient(180deg, var(--brand), var(--line) 80%)" }} />
            {list.map((m, i) => {
              const mem = members.find((x) => x.id === m.memberId);
              return (
                <motion.div
                  key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.06, 0.6) }} className="relative"
                >
                  <span className="absolute -left-[25px] top-1.5 w-3 h-3 rounded-full" style={{ background: "var(--panel)", border: "2px solid var(--brand)", boxShadow: "0 0 10px var(--glow-brand)" }} />
                  <div className="panel2 p-4">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="tag tag-brand">{m.type}</span>
                      {mem && (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold">
                          <CatCharacter colorway={mem.colorway} state="awake" size={15} accessory={null} />
                          {mem.name}
                        </span>
                      )}
                      <span className="mono ml-auto text-[10.5px]" style={{ color: "var(--ink-3)" }}>{m.recordedAt}</span>
                    </div>
                    <div className="text-[14px]">{m.content}</div>
                    <div className="text-[11px] mt-1.5" style={{ color: "var(--ink-3)" }}>
                      来源:{m.source} —— AI 引用记忆时只能来自这些出处
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
