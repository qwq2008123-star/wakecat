"use client";

/* 会员档案 v2:基本资料 / 消费历史 / 偏好 / 沟通 / 记忆 / 流失风险 / AI 建议 / 营销效果
   + 「让 AI 分析这位会员」演示按钮(本地规则引擎拼装,明确标注) */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  X, Brain, ShieldAlert, Lightbulb, Sparkles, Receipt,
  MessagesSquare, BarChart3, UserRound, HeartHandshake,
} from "lucide-react";
import CatCharacter from "./CatCharacter";
import { ZONE_META } from "@/mock-data/members";
import { dataProvider } from "@/lib/data-provider";
import { analyzeMember, getMarketingEffect, getPurchaseHistory } from "@/lib/member-analysis";
import { MemberCatView, MemoryEntry } from "@/mock-data/types";

const RISK_META = {
  low: { label: "低", color: "var(--green)", pct: 22 },
  mid: { label: "中", color: "var(--yellow)", pct: 55 },
  high: { label: "高", color: "var(--red)", pct: 86 },
} as const;

function Block({ icon, title, right, children }: {
  icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[13px] font-bold mb-2.5">
        {icon}{title}
        {right && <span className="ml-auto">{right}</span>}
      </div>
      {children}
    </div>
  );
}

export default function MemberProfileDrawer({ member, onClose }: { member: MemberCatView; onClose: () => void }) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeMember> | null>(null);

  useEffect(() => {
    dataProvider.getMemories(member.id).then(setMemories);
    // 每次切换会员重置分析
    setAnalysis(null); setAnalyzing(false);
  }, [member.id]);

  const runAnalysis = () => {
    setAnalyzing(true);
    setTimeout(() => {
      setAnalysis(analyzeMember(member, memories));
      setAnalyzing(false);
    }, 1100);
  };

  const risk = RISK_META[member.risk];
  const meta = ZONE_META[member.zone];
  const history = getPurchaseHistory(member);
  const mkt = getMarketingEffect(member);
  const comms = memories.filter((m) => m.type === "沟通记录" || m.type === "会员反馈");

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: "rgba(5,7,15,.66)" }} onClick={onClose}
      />
      <motion.aside
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] flex flex-col"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        style={{ background: "var(--bg-1)", borderLeft: "1px solid var(--line)" }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${member.name} 的会员档案`}
      >
        {/* 头部 */}
        <div className="relative overflow-hidden p-5 shrink-0" style={{ borderBottom: "1px solid var(--line)" }}>
          <div className="aurora" style={{ width: 260, height: 160, top: -70, right: -30, background: meta.glow }} />
          <button className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/5 z-10" onClick={onClose} aria-label="关闭档案">
            <X size={16} />
          </button>
          <div className="relative flex items-center gap-4">
            <CatCharacter
              colorway={member.colorway} state={member.state} size={92}
              badge={member.zone === "premium" ? "premium" : member.risk === "high" ? "risk" : null}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[19px] font-extrabold">{member.name}</h2>
                <span className="tag tag-brand">{member.level}</span>
                <span className="tag" style={{ color: meta.accent, borderColor: meta.accent }}>{meta.label}</span>
              </div>
              <div className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>
                {member.phoneMasked} · 爱猫「{member.catName}」 · 入会 {member.joinedAt}
              </div>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {member.tags.map((t) => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* 「让 AI 分析这位会员」 */}
          <div>
            <button className="btn btn-orange w-full" onClick={runAnalysis} disabled={analyzing}>
              <Sparkles size={14} />
              {analyzing ? "侦探喵 × 军师喵 联合分析中…" : analysis ? "重新让 AI 分析这位会员" : "让 AI 分析这位会员"}
            </button>
            {analyzing && (
              <div className="mt-3 panel2 p-3.5 space-y-2">
                {["翻阅消费流水与沟通记录", "比对同类会员的流失曲线", "匹配军师喵的策略库"].map((s, i) => (
                  <div key={s} className="flex items-center gap-2 text-[12px] anim-breathe"
                    style={{ color: "var(--ink-2)", animationDelay: `${i * 0.25}s` }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--brand-2)" }} />
                    {s}…
                  </div>
                ))}
              </div>
            )}
            {analysis && !analyzing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 panel2 p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="tag tag-brand">侦探喵 × 军师喵</span>
                  <span className="text-[12px] font-bold" style={{ color: "var(--orange)" }}>{analysis.headline}</span>
                </div>
                <p className="text-[13px] leading-relaxed">{analysis.summary}</p>
                <div className="mt-3 space-y-1.5">
                  {analysis.actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12.5px]">
                      <span className="mono shrink-0 mt-0.5 w-4 h-4 grid place-items-center rounded-full text-[10px]"
                        style={{ background: "rgba(124,108,255,.16)", color: "var(--brand-2)" }}>{i + 1}</span>
                      {a}
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] mt-3" style={{ color: "var(--ink-3)" }}>
                  演示分析:本地规则引擎拼装;接入 GLM 后由大模型基于真实档案实时生成。
                </p>
              </motion.div>
            )}
          </div>

          {/* 流失风险 */}
          <Block icon={<ShieldAlert size={14} style={{ color: risk.color }} />} title="流失风险"
            right={<span className="tag tag-demo">演示评估</span>}>
            <div className="surface-2 p-4">
              <div className="flex items-center justify-between text-[12.5px] mb-2">
                <span>当前风险 <b style={{ color: risk.color }}>{risk.label}</b></span>
                <span className="mono" style={{ color: risk.color }}>{risk.pct}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${risk.pct}%` }} transition={{ duration: 0.7 }}
                  style={{ background: `linear-gradient(90deg, var(--green), ${risk.color})` }} />
              </div>
            </div>
          </Block>

          {/* 消费历史 + 偏好 */}
          <Block icon={<Receipt size={14} style={{ color: "var(--brand-2)" }} />} title="消费历史"
            right={<span className="tag tag-demo">演示流水</span>}>
            <div className="space-y-1.5">
              {history.map((r, i) => (
                <div key={i} className="panel2 px-3 py-2 flex items-center text-[12.5px]">
                  <div>
                    <div>{r.service}</div>
                    <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{r.date}</div>
                  </div>
                  <div className="ml-auto mono">¥{r.amount}</div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 surface-2 p-3 text-[12.5px] flex items-center gap-2">
              <HeartHandshake size={13} style={{ color: "var(--pink, #FF5F7E)" }} />
              消费偏好:<b>{member.favoriteService}</b>
              {member.tags.map((t) => <span key={t} className="tag ml-1">{t}</span>)}
            </div>
          </Block>

          {/* 会员记忆 + 历史沟通 */}
          <Block icon={<Brain size={14} style={{ color: "var(--brand-2)" }} />} title="会员记忆"
            right={<span className="text-[11px]" style={{ color: "var(--ink-3)" }}>每条都带来源</span>}>
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
                  暂无专属记忆条目;真实产品中侦探喵会持续从流水与沟通中沉淀档案。
                </div>
              )}
            </div>
          </Block>

          {/* 历史营销效果 */}
          <Block icon={<BarChart3 size={14} style={{ color: "var(--yellow)" }} />} title="历史营销效果"
            right={<span className="tag tag-demo">演示</span>}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { l: "触达", v: mkt.reached, c: "var(--brand)" },
                { l: "回复", v: mkt.replied, c: "var(--cyan)" },
                { l: "预约", v: mkt.appointed, c: "var(--green)" },
              ].map((x) => (
                <div key={x.l} className="panel2 p-3 text-center">
                  <div className="text-[18px] font-extrabold" style={{ color: x.c }}>{x.v}</div>
                  <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{x.l}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-start gap-1.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              <MessagesSquare size={12} className="shrink-0 mt-0.5" />
              {mkt.note}
            </div>
          </Block>

          {/* AI 唤醒建议 */}
          <Block icon={<Lightbulb size={14} style={{ color: "var(--yellow)" }} />} title="AI 唤醒建议"
            right={<span className="tag tag-demo">AI 建议 · 演示</span>}>
            <div className="surface-2 p-4 text-[13px] leading-relaxed">{member.strategyHint}。</div>
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              <UserRound size={12} />
              落地执行请在「任务大厅」批准对应任务后,由销售喵统一触达。
            </div>
          </Block>
        </div>
      </motion.aside>
    </>
  );
}
