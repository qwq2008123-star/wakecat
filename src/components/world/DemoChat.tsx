"use client";

/* 演示对话窗口:回复来自员工剧本池,界面明确标注未连接真实 Agent */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { SendHorizonal, Info } from "lucide-react";
import CatCharacter from "./CatCharacter";
import { Employee } from "@/mock-data/types";

type Msg = { from: "user" | "emp"; text: string };

export default function DemoChat({ emp }: { emp: Employee }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "emp", text: emp.greeting },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const replyIdx = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, typing]);

  function send() {
    const text = input.trim();
    if (!text || typing) return;
    setMsgs((m) => [...m, { from: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = emp.sampleReplies[replyIdx.current % emp.sampleReplies.length];
      replyIdx.current += 1;
      setTyping(false);
      setMsgs((m) => [...m, { from: "emp", text: reply }]);
    }, 900 + Math.random() * 700);
  }

  return (
    <div className="surface overflow-hidden flex flex-col" style={{ height: 460 }}>
      {/* 窗头 */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <CatCharacter colorway={emp.colorway} state="awake" accessory={emp.accessory} size={36} />
        <div>
          <div className="text-[13.5px] font-bold">{emp.name}</div>
          <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>{emp.title}</div>
        </div>
        <span className="tag tag-yellow ml-auto">演示对话 · 未连接真实 Agent</span>
      </div>
      {/* 消息区 */}
      <div ref={boxRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-[11px] justify-center" style={{ color: "var(--ink-3)" }}>
          <Info size={11} />
          以下回复来自角色剧本(演示交互),第二阶段接入大模型后由真实 Agent 应答
        </div>
        {msgs.map((m, i) => (
          <motion.div
            key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2 ${m.from === "user" ? "flex-row-reverse" : ""}`}
          >
            {m.from === "emp" && <CatCharacter colorway={emp.colorway} state="awake" accessory={null} size={30} />}
            <div
              className="max-w-[80%] px-3.5 py-2.5 text-[13px] rounded-2xl"
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
