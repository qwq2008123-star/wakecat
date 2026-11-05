"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Ev =
  | { type: "stage"; stage: string; label: string; status: string; engine?: string }
  | { type: "log"; agent: string; step: string; message?: string; tool?: string; detail?: string }
  | { type: "done"; taskId: string; title: string; status: string; summary: string };

const AGENT_STYLE: Record<string, { color: string; icon: string }> = {
  "喵老板": { color: "#FF8A4C", icon: "🐱" },
  "侦探喵": { color: "#4EA8DE", icon: "🔍" },
  "军师喵": { color: "#A095FF", icon: "🧠" },
  "销售喵": { color: "#3ECF8E", icon: "💌" },
  "财务喵": { color: "#FFC94D", icon: "🧮" },
};

export default function GoalConsole({ hasKey, engineMode }: { hasKey: boolean; engineMode: string }) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<Ev[]>([]);
  const [done, setDone] = useState<Ev & { type: "done" } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const EXAMPLES = [
    "把三个月没来的老会员唤醒一批,重点照顾卡快过期的",
    "最近店庆,给高价值但快流失的会员推新色板",
    "唤醒 5 个最值钱的沉睡会员,预算控制在 100 元内",
  ];

  async function run() {
    if (!goal.trim() || running) return;
    setRunning(true); setEvents([]); setDone(null);
    try {
      const res = await fetch("/api/goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: "请求失败" }));
        setEvents([{ type: "log", agent: "喵老板", step: "出错", message: (j as { error?: string }).error ?? "请求失败" }]);
        setRunning(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.trim();
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5).trim()) as Ev;
          setEvents((prev) => [...prev, ev]);
          if (ev.type === "done") setDone(ev);
        }
        boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
      }
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="font-bold text-[15px]">🐱 喵老板 · 告诉它一个经营目标</div>
        <span className="tag" title={hasKey ? "GLM 已接入,各环节用大模型+真实工具" : "未配置 Key,内置规则引擎接管"}>
          {hasKey ? "✦ GLM 已接入" : "⚙ 规则引擎模式"}
        </span>
      </div>
      <p className="text-[12px] mb-3" style={{ color: "var(--ink2)" }}>
        目标会被拆解为:侦探喵体检 → 军师喵定策略 → <b>你批准</b> → 销售喵触达 → 财务喵复盘。未批准前不会触达任何会员。
      </p>
      <div className="flex gap-2">
        <input
          className="input" value={goal} onChange={(e) => setGoal(e.target.value)}
          placeholder="例如:把三个月没来的老会员唤醒一批"
          onKeyDown={(e) => e.key === "Enter" && run()}
          disabled={running}
        />
        <button className="btn btn-orange shrink-0" onClick={run} disabled={running || !goal.trim()}>
          {running ? "AI 团队工作中…" : "下达目标"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {EXAMPLES.map((e) => (
          <button key={e} className="tag hover:opacity-80" onClick={() => setGoal(e)} disabled={running}>{e}</button>
        ))}
      </div>

      {(events.length > 0 || running) && (
        <div ref={boxRef} className="panel2 mt-4 p-3 max-h-[340px] overflow-y-auto mono space-y-1.5">
          {events.map((e, i) => {
            if (e.type === "stage") {
              return (
                <div key={i} className="flex items-center gap-2 pt-1" style={{ color: e.status === "ok" ? "var(--green)" : "var(--ink)" }}>
                  <span>{e.status === "start" ? "▶" : "✔"}</span>
                  <b>{e.label}</b>
                  {e.engine && <span className="tag tag-purple">{e.engine === "llm" ? `LLM·真实工具调用` : "规则引擎"}</span>}
                </div>
              );
            }
            if (e.type === "done") {
              return (
                <div key={i} className="pt-2" style={{ color: "var(--green)" }}>
                  ✔ {e.summary}
                </div>
              );
            }
            const st = AGENT_STYLE[e.agent] ?? { color: "var(--ink2)", icon: "•" };
            return (
              <div key={i} className="flex gap-2 items-baseline">
                <span style={{ color: st.color }}>{st.icon} {e.agent}</span>
                <span style={{ color: "var(--ink2)" }}>{e.step}{e.tool ? ` · ${e.tool}()` : ""}</span>
                {e.message && <span style={{ color: "var(--ink)" }}>{e.message.slice(0, 90)}</span>}
              </div>
            );
          })}
          {running && <div className="blink" style={{ color: "var(--ink2)" }}>▌ AI 团队工作中…</div>}
        </div>
      )}

      {done && done.taskId && (
        <div className="mt-3 flex items-center gap-3 panel2 p-3">
          <span className="text-[13px]">任务已就绪,等待你的审批:</span>
          <a className="btn btn-sm btn-orange" href={`/tasks/${done.taskId}`}>去任务大厅审批 →</a>
        </div>
      )}
    </div>
  );
}
