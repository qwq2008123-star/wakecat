"use client";

/* 会员档案抽屉:基础信息 / AI 记忆 / 流失风险 / 推荐策略 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, Brain, ShieldAlert, Lightbulb } from "lucide-react";
import CatCharacter from "./CatCharacter";
import { ZONE_META } from "@/mock-data/members";
import { dataProvider } from "@/lib/data-provider";
import { MemberCatView, MemoryEntry } from "@/mock-data/types";

const RISK_META = {
  low: { label: "低", color: "var(--green)", pct: 22 },
  mid: { label: "中", color: "var(--yellow)", pct: 55 },
  high: { label: "高", color: "var(--red)", pct: 86 },
} as const;

export default function MemberProfileDrawer({ member, onClose }: { member: MemberCatView; onClose: () => void }) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  useEffect(() => { dataProvider.getMemories(member.id).then(setMemories); }, [member.id]);

  const risk = RISK_META[member.risk];
  const meta = ZONE_META[member.zone];

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: "rgba(5,7,15,.66)" }} onClick={onClose}
      />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] flex flex-col"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        style={{ background: "var(--bg-1)", borderLeft: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${member.name} 的会员档案`}
      >
        {/* 头部 */}
        <div className="relative overflow-hidden p-5 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="aurora" style={{ width: 260, height: 160, top: -70, right: -30, background: meta.glow }} />
          <button className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5" onClick={onClose} aria-label="关闭档案">
            <X size={16} />
          </button>
          <div className="relative flex items-center gap-4">
            <CatCharacter
              colorway={member.colorway} state={member.state} size={96}
              badge={member.zone === "premium" ? "premium" : member.risk === "high" ? "risk" : null}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[19px] font-extrabold">{member.name}</h2>
                <span className="tag tag-brand">{member.level}</span>
                <span className="tag" style={{ color: meta.accent, borderColor: meta.accent }}>{meta.label}</span>
              </div>
              <div className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
                {member.phoneMasked} · 爱猫「{member.catName}」· 入会 {member.joinedAt}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {member.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 消费画像 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: "累计消费", v: `¥${member.spend.toLocaleString()}` },
              { l: "到店次数", v: `${member.visits} 次` },
              { l: "最近到店", v: `${member.lastVisitDays} 天前` },
            ].map((x) => (
              <div key={x.l} className="panel2 p-3 text-center">
                <div className="text-[16px] font-extrabold">{x.v}</div>
                <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>{x.l}</div>
              </div>
            ))}
          </div>
          <div className="text-[12.5px] flex items-center gap-2" style={{ color: "var(--ink-2)" }}>
            偏好服务:<b style={{ color: "var(--ink)" }}>{member.favoriteService}</b>
          </div>

          {/* 流失风险 */}
          <div className="surface-2 p-4">
            <div className="flex items-center gap-2 text-[13px] font-bold mb-2.5">
              <ShieldAlert size={14} style={{ color: risk.color }} />
              流失风险 <span style={{ color: risk.color }}>{risk.label}</span>
              <span className="tag tag-demo ml-auto">演示评估</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }} animate={{ width: `${risk.pct}%` }} transition={{ duration: 0.7, delay: 0.15 }}
                style={{ background: `linear-gradient(90deg, var(--green), ${risk.color})` }}
              />
            </div>
          </div>

          {/* AI 记忆 */}
          <div>
            <div className="flex items-center gap-2 text-[13px] font-bold mb-2.5">
              <Brain size={14} style={{ color: "var(--brand-2)" }} />
              AI 记忆({memories.length > 0 ? memories.length : "全场公档"})
            </div>
            <div className="space-y-2">
              {memories.map((m) => (
                <div key={m.id} className="panel2 p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="tag tag-brand">{m.type}</span>
                    <span className="text-[10.5px] ml-auto" style={{ color: "var(--ink-3)" }}>
                      来源:{m.source} · {m.recordedAt}
                    </span>
                  </div>
                  <div className="text-[13px]">{m.content}</div>
                </div>
              ))}
              {memories.length === 0 && (
                <div className="panel2 p-3 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  该演示会员暂无专属记忆条目。真实产品中,侦探喵会从消费流水与沟通记录里持续沉淀档案。
                </div>
              )}
            </div>
          </div>

          {/* 推荐策略 */}
          <div className="surface-2 p-4 relative overflow-hidden">
            <div className="flex items-center gap-2 text-[13px] font-bold mb-1.5">
              <Lightbulb size={14} style={{ color: "var(--yellow)" }} />
              推荐经营策略 <span className="tag tag-demo">AI 建议 · 演示</span>
            </div>
            <p className="text-[13px] leading-relaxed">{member.strategyHint}。</p>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
