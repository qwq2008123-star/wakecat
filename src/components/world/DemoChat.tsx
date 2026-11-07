"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SendHorizonal } from "lucide-react";
import CatCharacter from "./CatCharacter";
import { Employee } from "@/mock-data/types";

/* 员工工作台对话(真实):GLM 带该员工的实时经营数据应答;失败诚实降级数据模板 */
type Msg = { from: "user" | "emp"; text: string; engine?: "llm" | "rules" };

export default function DemoChat({ emp }: { emp: Employee }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "emp", text: emp.greeting },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  async function send() {
    const text = input.trim();
    if (!text || typing) return;
    setMsgs((m) => [...m, { from: "user", text }]);
    setInput("");
    setTyping(true);
    try {
      const r = await fetch(`/api/agents/${emp.id}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: msgs.slice(-8).map((m) => ({ role: m.from === "user" ? "user" : "assistant", content: m.text })),
        }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, {
        from: "emp",
        text: j.text ?? (j.error ? `我这边出了点状况(${j.error}),稍后再问我一次。` : "…"),
        engine: j.engine,
      }]);
    } catch {
      setMsgs((m) => [...m, { from: "emp", text: "网络出了点状况,稍后再问我一次。", engine: "rules" }]);
    } finally {
      setTyping(false);
    }
  }

  const lastEngine = [...msgs].reverse().find((m) => m.engine)?.engine;

  return (
    <div className="surface overflow-hidden flex flex-col" style={{ height: 460 }}>
      {/* 窗头 */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <CatCharacter colorway={emp.colorway} state="awake" accessory={emp.accessory} size={36} />
        <div>
          <div className="text-[13.5px] font-bold">{emp.name}</div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{emp.title}</div>
        </div>
        <span className="tag ml-auto" style={lastEngine === "rules"
          ? { color: "var(--yellow)", borderColor: "var(--yellow)" }
          : { color: "var(--green)", borderColor: "var(--green)" }}>
          {lastEngine === "rules" ? "⚙ 规则引擎(数据模板)" : "✦ 真实 Agent · 带实时经营数据"}
        </span>
      </div>
      {/* 消息区 */}
      <div ref={boxRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-[11px] text-center" style={{ color: "var(--ink-3)" }}>
          它引用的都是此刻数据库里的真实数字;要派活去「任务大厅」下目标。
        </div>
        {msgs.map((m, i) => (
          <motion.div
            key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}
          >
            {m.from === "emp" && <CatCharacter colorway={emp.colorway} state="awake" accessory={null} size={30} />}
            <div
              className="max-w-[80%] px-3.5 py-2.5 text-[13px] rounded-2xl whitespace-pre-wrap"
              style={m.from === "user"
                ? { background: "linear-gradient(135deg, var(--brand), #6a58e8)", borderTopRightRadius: 6 }
                : { background: "var(--panel-2)", border: "1px solid var(--line-soft)", borderTopLeftRadius: 6 }}
            >
              {m.text}
            </div>
          </motion.div>
        ))}
        {typing && (
          <div className="flex gap-2 items-center">
            <CatCharacter colorway={emp.colorway} state="awake" accessory={null} size={30} />
            <div className="px-3 py-2.5 rounded-2xl flex gap-1" style={{ background: "var(--panel-2)", border: "1px solid var(--line-soft)" }}>
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 rounded-full anim-breathe" style={{ background: "var(--ink-3)", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        )}
      </div>
      {/* 输入区 */}
      <div className="p-3 flex gap-2" style={{ borderTop: "1px solid var(--line)" }}>
        <input
          className="input" value={input} placeholder={`跟${emp.name}说点什么…`}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button className="btn shrink-0" onClick={send} disabled={!input.trim() || typing} aria-label="发送">
          <SendHorizonal size={15} />
        </button>
      </div>
    </div>
  );
}
