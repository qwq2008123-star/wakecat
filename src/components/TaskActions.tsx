"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Ev =
  | { type: "stage"; stage: string; label: string; status: string; engine?: string }
  | { type: "log"; agent: string; step: string; message?: string; tool?: string; detail?: string }
  | { type: "done"; taskId: string; title: string; status: string; summary: string };

export default function TaskActions({ taskId, status, role }: { taskId: string; status: string; role: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<Ev[]>([]);
  const [error, setError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  async function decide(approve: boolean) {
    setError(null);
    const r = await fetch(`/api/tasks/${taskId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    const j = await r.json();
    if (!r.ok) setError(j.error ?? "操作失败");
    else router.refresh();
  }

  async function execute() {
    setRunning(true); setError(null); setLines([]);
    try {
      const res = await fetch(`/api/tasks/${taskId}/execute`, { method: "POST" });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "执行失败");
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
          try {
            const ev = JSON.parse(line.slice(5).trim()) as Ev;
            setLines((prev) => [...prev, ev]);
            boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
          } catch { /* 忽略残包 */ }
        }
      }
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <div className="panel p-5">
      <div className="font-bold text-[15px] mb-2">⚡ 审批与执行</div>
      {role !== "owner" && (
        <p className="text-[12px] mb-3" style={{ color: "var(--yellow)" }}>
          你当前以店员身份登录:审批需要老板娘权限(可以退出后用「芳姐」登录体验权限控制)。
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "pending_approval" && (
          <>
            <button className="btn btn-green" onClick={() => decide(true)}>✅ 批准任务(授权触达)</button>
            <button className="btn btn-red" onClick={() => decide(false)}>✕ 驳回</button>
          </>
        )}
        {status === "approved" && (
          <button className="btn btn-orange" onClick={execute} disabled={running}>
            {running ? "销售喵执行中…" : "💌 执行触达(销售喵 → 财务喵)"}
          </button>
        )}
        {status === "completed" && <span className="tag tag-green">任务已完成,复盘报告见下方</span>}
        {status === "rejected" && <span className="tag tag-red">任务已被驳回</span>}
        {status === "running" && <span className="tag tag-purple blink">执行中…</span>}
      </div>
      {error && <p className="text-[12.5px] mt-2" style={{ color: "var(--red)" }}>⚠ {error}</p>}

      {(lines.length > 0 || running) && (
        <div ref={boxRef} className="panel2 mt-3 p-3 max-h-[300px] overflow-y-auto mono space-y-1.5 text-[12px]">
          {lines.map((e, i) => {
            if (e.type === "stage") {
              return (
                <div key={i} className="pt-1" style={{ color: e.status === "ok" ? "var(--green)" : "inherit" }}>
                  {e.status === "start" ? "▶" : "✔"} <b>{e.label}</b>
                  {e.engine && <span className="tag tag-purple ml-1">{e.engine === "llm" ? "LLM" : "规则引擎"}</span>}
                </div>
              );
            }
            if (e.type === "done") return <div key={i} style={{ color: "var(--green)" }}>✔ {e.summary}</div>;
            return (
              <div key={i} className="flex gap-2 items-baseline flex-wrap">
                <span style={{ color: "var(--brand2)" }}>{e.agent}</span>
                <span style={{ color: "var(--ink2)" }}>{e.step}{e.tool ? ` · ${e.tool}()` : ""}</span>
                {e.message && <span>{e.message.slice(0, 120)}</span>}
              </div>
            );
          })}
          {running && <div className="blink" style={{ color: "var(--ink2)" }}>▌ 执行中…</div>}
        </div>
      )}
    </div>
  );
}
