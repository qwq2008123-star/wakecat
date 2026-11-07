"use client";

/* 会话接管:AI 卡住/转人工的会话在这里由老板娘亲自回复 */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/world/ui";

function StatusDotInline({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2 h-2">
      {pulse && <span className="absolute inset-0 rounded-full" style={{ background: color, animation: "pulse-ring 1.8s ease-out infinite" }} />}
      <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
interface ConvRow {
  id: string; member_id: string | null; channel: string; status: string;
  created_at: string; member_name: string | null; last_msg: string | null;
}
interface MsgRow { direction: string; content: string; meta_json: string; created_at: string }

export default function InboxPage() {
  const [needsHuman, setNeedsHuman] = useState<ConvRow[]>([]);
  const [recent, setRecent] = useState<ConvRow[]>([]);
  const [active, setActive] = useState<ConvRow | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [input, setInput] = useState("");
  const [memberName, setMemberName] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/inbox").then((x) => x.json()).catch(() => null);
    if (!r) return;
    setNeedsHuman(r.needsHuman ?? []);
    setRecent(r.recent ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openConv = useCallback(async (conv: ConvRow) => {
    setActive(conv);
    const r = await fetch(`/api/inbox/${conv.id}/messages`).then((x) => x.json()).catch(() => null);
    if (r) { setMessages(r.messages ?? []); setMemberName(r.memberName ?? ""); }
  }, []);
  useEffect(() => {
    if (active) {
      fetch(`/api/inbox/${active.id}/messages`).then((r) => r.json()).then((j) => setMessages(j.messages ?? []));
    }
  }, [active]);
  useEffect(() => { bottomRef.current?.scrollTo({ top: bottomRef.current.scrollHeight }); }, [messages]);

  async function reply() {
    if (!active || !input.trim()) return;
    await fetch(`/api/inbox/${active.id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    setInput("");
    openConv(active);
    load();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="会话接管" desc="AI 卡住或客户主动找你时,在这里亲自回复。你发的消息以老板娘名义送达客户。" />

      {needsHuman.length > 0 && (
        <div className="surface p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-2 h-2 rounded-full anim-breathe" style={{ background: "var(--red)" }} />
            <b className="text-[13px]" style={{ color: "var(--red)" }}>{needsHuman.length} 个会话等待你回复</b>
          </div>
          <div className="space-y-1.5">
            {needsHuman.map((c) => (
              <button key={c.id} onClick={() => openConv(c)}
                className={`w-full text-left panel2 p-3 flex items-center gap-3 hover:bg-white/5 transition-colors ${active?.id === c.id ? "ring-1 ring-[var(--brand)]" : ""}`}>
                <span className="text-[13px] font-semibold">{c.member_name ?? "访客"}</span>
                <span className="text-[12px] truncate flex-1" style={{ color: "var(--ink-2)" }}>{c.last_msg}</span>
                <span className="text-[10.5px]" style={{ color: "var(--red)" }}>待回复</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <div className="surface overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--line)" }}>
            <StatusDotInline color="var(--green)" />
            <b className="text-[13.5px]">{memberName || "会话"}</b>
            <span className="tag tag-green ml-auto">以老板娘名义回复</span>
          </div>
          <div ref={bottomRef} className="p-4 space-y-2.5 max-h-[360px] overflow-y-auto">
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                <div className="max-w-[75%] px-3.5 py-2.5 text-[13px] rounded-2xl"
                  style={m.direction === "in"
                    ? { background: "var(--panel-2)", border: "1px solid var(--line-soft)" }
                    : { background: "linear-gradient(135deg, var(--brand), #6a58e8)" }}>
                  {m.content}
                  {(JSON.parse(m.meta_json || "{}") as { human?: boolean }).human && (
                    <span className="block text-[10px] mt-1 text-right" style={{ color: "var(--yellow)" }}>老板娘亲自回复</span>
                  )}
                </div>
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <input className="input" value={input} placeholder="以老板娘身份回复…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") reply(); }} />
            <button className="btn shrink-0" onClick={reply} disabled={!input.trim()}>
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div>
          <div className="text-[12px] font-bold mb-2" style={{ color: "var(--ink-3)" }}>最近会话</div>
          <div className="space-y-1">
            {recent.filter((c) => c.id !== active?.id).slice(0, 6).map((c) => (
              <button key={c.id} onClick={() => openConv(c)}
                className="w-full text-left panel2 px-3 py-2 flex items-center gap-3 hover:bg-white/5">
                <span className="text-[12.5px] font-semibold">{c.member_name ?? "访客"}</span>
                <span className="text-[11.5px] truncate flex-1" style={{ color: "var(--ink-2)" }}>{c.last_msg}</span>
                <span className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>{c.created_at?.slice(5, 16).replace("T", " ")}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
