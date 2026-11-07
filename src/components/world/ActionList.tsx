"use client";

/* 今日行动清单:第一屏不是报告,是「老板娘今天要做的 N 件事」——每条可执行 */
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  CircleCheck, CircleX, Check, ClipboardList, CalendarClock,
  MessageSquareText, Ban, Send, ChevronRight,
} from "lucide-react";
import { SectionTitle } from "./ui";

type ActionType = "approval" | "appointment_today" | "no_reply_followup"
  | "stuck_conversation" | "budget_blocked" | "manual_send";

interface ActionItem {
  dedupeKey: string; type: ActionType; title: string; reason: string;
  memberId?: string; memberName?: string;
  payload: Record<string, unknown>; suggestedAction: string;
}

const TYPE_META: Record<ActionType, { label: string; icon: React.ReactNode; accent: string }> = {
  approval: { label: "待审批", icon: <ClipboardList size={13} />, accent: "var(--yellow)" },
  appointment_today: { label: "到店准备", icon: <CalendarClock size={13} />, accent: "var(--green)" },
  stuck_conversation: { label: "人工接管", icon: <MessageSquareText size={13} />, accent: "var(--red)" },
  no_reply_followup: { label: "人工跟进", icon: <MessageSquareText size={13} />, accent: "var(--blue)" },
  budget_blocked: { label: "预算决策", icon: <Ban size={13} />, accent: "var(--red)" },
  manual_send: { label: "待真实发送", icon: <Send size={13} />, accent: "var(--orange)" },
};

const GROUP_ORDER: ActionType[] = ["approval", "manual_send", "stuck_conversation", "appointment_today", "no_reply_followup", "budget_blocked"];
const GROUP_LABEL: Record<ActionType, string> = {
  approval: "需要你审批", manual_send: "等你真实发送", stuck_conversation: "等你亲自回复",
  appointment_today: "今天到店准备", no_reply_followup: "建议人工跟进", budget_blocked: "需要你决策",
};

export default function ActionList({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/actions").then((x) => x.json()).catch(() => ({ items: [] }));
    setItems(r.items ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  async function decide(taskId: string, approve: boolean, dedupeKey: string, title: string) {
    await fetch(`/api/tasks/${taskId}/decide`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    setDone((d) => [...d, dedupeKey]);
    load();
  }
  async function markSent(messageId: string, dedupeKey: string) {
    await fetch(`/api/outreach/${messageId}/mark-sent`, { method: "POST" });
    setDone((d) => [...d, dedupeKey]);
    load();
  }
  async function skip(dedupeKey: string, type: string, title: string) {
    await fetch(`/api/actions/${encodeURIComponent(dedupeKey)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dedupeKey, type, title, action: "skip" }),
    });
    load();
  }

  const groups = GROUP_ORDER
    .map((t) => ({ type: t, list: items.filter((i) => i.type === t) }))
    .filter((g) => g.list.length > 0);

  return (
    <div>
      <SectionTitle right={
        <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
          {loading ? "统计中…" : items.length === 0 ? "今天没有等你做的事" : `${items.length} 件事`}
        </span>
      }>
        今日行动清单
      </SectionTitle>
      {loading && <p className="text-[13px] anim-breathe" style={{ color: "var(--ink-2)" }}>统计中…</p>}
      {!loading && items.length === 0 && (
        <div className="surface p-6 text-center">
          <p className="text-[13.5px] font-semibold" style={{ color: "var(--green)" }}>今天的行动全部完成 ✓</p>
          <p className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>AI 团队会继续盯着会员生态,有事会第一时间出现在这里。</p>
        </div>
      )}
      <div className="space-y-5">
        {groups.map((g) => {
          const meta = TYPE_META[g.type];
          return (
            <div key={g.type}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ color: meta.accent }}>{meta.icon}</span>
                <b className="text-[13px]">{GROUP_LABEL[g.type]}</b>
                <span className="tag">{g.list.length}</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {g.list.map((item) => (
                    <motion.div
                      key={item.dedupeKey} layout
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
                      className="surface-2 p-3.5"
                    >
                      {done.includes(item.dedupeKey) ? (
                        <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--green)" }}>
                          <Check size={13} /> 已处理
                        </div>
                      ) : (
                        <div>
                          <div className="text-[13.5px] font-semibold">{item.title}</div>
                          <div className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>{item.reason}</div>
                          {item.type === "manual_send" && item.payload.body ? (
                            <div className="panel2 mt-2 px-3.5 py-2.5 text-[13px] leading-relaxed rounded-xl"
                              style={{ borderLeft: "2px solid var(--orange)" }}>
                              「{item.memberName}」将收到的消息:<br />
                              <span style={{ color: "var(--ink)" }}>{item.payload.body as string}</span>
                            </div>
                          ) : null}
                          <div className="text-[11.5px] mt-1.5" style={{ color: "var(--brand-2)" }}>→ {item.suggestedAction}</div>
                          <ItemActions item={item} onDecide={decide} onMarkSent={markSent} onSkip={skip} onCopy={(t) => { setCopied(item.dedupeKey); navigator.clipboard?.writeText(t); }} copied={copied === item.dedupeKey} />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemActions({ item, onDecide, onMarkSent, onSkip, onCopy, copied }: {
  item: ActionItem;
  onDecide: (taskId: string, approve: boolean, dedupeKey: string, title: string) => void;
  onMarkSent: (messageId: string, dedupeKey: string) => void;
  onSkip: (dedupeKey: string, type: string, title: string) => void;
  onCopy: (text: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2.5">
      {item.type === "approval" && (
        <>
          <button className="btn btn-green btn-sm" onClick={() => onDecide(item.payload.taskId as string, true, item.dedupeKey, item.title)}>✓ 批准</button>
          <button className="btn btn-red btn-sm" onClick={() => onDecide(item.payload.taskId as string, false, item.dedupeKey, item.title)}>✕ 驳回</button>
          <Link className="btn btn-ghost btn-sm" href={`/tasks/${item.payload.taskId}`}>详情 <ChevronRight size={12} /></Link>
        </>
      )}
      {item.type === "manual_send" && (
        <>
          <button className="btn btn-sm" onClick={() => onCopy(item.payload.body as string)}>
            {copied ? "✓ 已复制,去企微粘贴" : "复制文案"}
          </button>
          <button className="btn btn-green btn-sm" onClick={() => onMarkSent(item.payload.messageId as string, item.dedupeKey)}>
            我已在企微发送
          </button>
          <button className="btn btn-red btn-sm" onClick={() => onSkip(item.dedupeKey, item.type, item.title)}>放弃</button>
        </>
      )}
      {item.type === "stuck_conversation" && (
        <Link className="btn btn-orange btn-sm" href="/inbox">去亲自回复</Link>
      )}
      {item.type === "budget_blocked" && (
        <>
          <button className="btn btn-sm" onClick={() => onSkip(item.dedupeKey, item.type, item.title)}>提额重发(进任务大厅)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onSkip(item.dedupeKey, item.type, item.title)}>放弃</button>
        </>
      )}
      {item.type !== "approval" && item.type !== "manual_send" && item.type !== "stuck_conversation" && item.type !== "budget_blocked" && (
        <>
          <button className="btn btn-green btn-sm" onClick={() => onSkip(item.dedupeKey, item.type, item.title)}>标记完成</button>
          <button className="btn btn-ghost btn-sm" onClick={() => onSkip(item.dedupeKey, item.type, item.title)}>跳过</button>
        </>
      )}
      {copied && <span className="text-[11px]" style={{ color: "var(--green)" }}>已复制 ✓</span>}
    </div>
  );
}
