"use client";

/* WAKECAT 2.0 · 联系决策中心:核心指标不是发了多少,而是多少次选择了沉默 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/world/ui";
import CatCharacter from "@/components/world/CatCharacter";

type Data = {
  stats: { needsFound: number; silent: number; contact: number; review: number; sent: number; replied: number };
  silentReasons: { reason: string; c: number }[];
  reviewList: Array<Record<string, unknown>>;
  recent: Array<Record<string, unknown>>;
};

export default function ContactCenterPage() {
  const [d, setD] = useState<Data | null>(null);

  const load = () => fetch("/api/contact-decisions").then((r) => r.json()).then(setD).catch(() => setD(null));
  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    await fetch(`/api/contact-decisions/${id}/approve`, { method: "POST" });
    load();
  }

  if (!d) return <div className="p-10 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>载入中…</div>;
  const s = d.stats;

  return (
    <div className="space-y-5">
      <PageHeader
        title="联系决策中心"
        desc="AI 猫咪每次主动联系前都要过决策引擎:有真实需求、有真实价值、时机合适、客户授权,四者缺一即沉默。沉默不是失败,是对客户的尊重。"
      />

      {/* 今日决策总览 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
        {[
          { l: "识别到需求", v: s.needsFound, c: "var(--brand-2)", sub: "有真实信号支撑" },
          { l: "建议联系", v: s.contact, c: "var(--green)", sub: "价值分 ≥ 0.8" },
          { l: "待人工审核", v: s.review, c: "var(--yellow)", sub: "价值 0.6–0.8" },
          { l: "主动保持沉默", v: s.silent, c: "var(--ink-2)", sub: "沉默是有效决策" },
          { l: "实际发送", v: s.sent, c: "var(--orange)", sub: `客户回复 ${s.replied}` },
        ].map((x) => (
          <div key={x.l} className="surface p-4">
            <div className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>{x.l}</div>
            <div className="text-[24px] font-extrabold mt-1" style={{ color: x.c }}>{x.v}</div>
            <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>{x.sub}</div>
          </div>
        ))}
      </div>

      {/* 今日为什么保持沉默 —— 本页灵魂 */}
      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-1">
          <CatCharacter colorway="gray" state="sleep" accessory={null} size={30} />
          <b className="text-[15px]">今日为什么选择保持沉默?</b>
          <span className="text-[11px] ml-auto" style={{ color: "var(--ink-3)" }}>来自真实决策日志,不是演示数字</span>
        </div>
        {d.silentReasons.length === 0 ? (
          <p className="text-[12.5px] py-3" style={{ color: "var(--ink-3)" }}>
            今天还没有沉默决策——下一次任务执行或定时扫描后,这里会如实记录每一次「不发」的理由。
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {d.silentReasons.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="surface-2 px-4 py-2.5 flex items-center gap-3">
                <span className="text-[15px] font-extrabold" style={{ color: "var(--ink-2)" }}>{Number(r.c)}</span>
                <span className="text-[13px] flex-1">{String(r.reason)}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 待人工审核 */}
      {d.reviewList.length > 0 && (
        <div className="surface p-5">
          <b className="text-[15px]">待人工审核的联系建议(价值 0.6–0.8)</b>
          <p className="text-[11.5px] mt-1 mb-3" style={{ color: "var(--ink-2)" }}>
            引擎拿不准的,交给人拿主意。批准后才发送;不批准,什么都不发生。
          </p>
          <div className="space-y-2.5">
            {d.reviewList.map((x) => (
              <div key={String(x.id)} className="surface-2 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-[13.5px]">{String(x.member_name)}</b>
                  <span className="tag tag-yellow">价值 {Number(x.total_score).toFixed(2)}</span>
                  <span className="tag">{String(x.need_type)}</span>
                  {Boolean(x.service_name) && <span className="tag tag-brand">{String(x.service_name)}</span>}
                </div>
                <p className="text-[12.5px] mt-1.5" style={{ color: "var(--ink-2)" }}>{String(x.reason)}</p>
                {Boolean(x.strategy_content) && (
                  <p className="text-[12px] mt-1.5 panel2 p-2.5 rounded-lg">草稿:{String(x.strategy_content)}</p>
                )}
                <button className="btn btn-green btn-sm mt-2" onClick={() => approve(String(x.id))}>
                  ✓ 我看过了,批准发送
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近决策流水 */}
      <div className="surface p-5">
        <b className="text-[14px]">最近决策流水(每一条都可审计)</b>
        <div className="mt-3 space-y-1.5">
          {d.recent.map((x, i) => (
            <div key={i} className="panel2 px-3 py-2 flex items-center gap-2.5 text-[12px]">
              <span className="tag" style={{
                color: x.decision === "contact" ? "var(--green)" : x.decision === "needs_review" ? "var(--yellow)" : "var(--ink-3)",
              }}>
                {x.decision === "contact" ? "联系" : x.decision === "needs_review" ? "待审核" : "沉默"}
              </span>
              <b>{String(x.member_name)}</b>
              <span className="flex-1 truncate" style={{ color: "var(--ink-2)" }}>{String(x.reason)}</span>
              <span className="mono" style={{ color: "var(--ink-3)" }}>{String(x.created_at).slice(5, 16).replace("T", " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
