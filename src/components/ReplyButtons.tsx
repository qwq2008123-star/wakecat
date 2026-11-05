"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 演示功能:模拟会员回复。意图由关键词规则解析,界面明确标注演示属性。 */
export default function ReplyButtons({ messageId }: { messageId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function reply(intent: "accept" | "price" | "decline") {
    setBusy(intent); setErr(null);
    const r = await fetch(`/api/outreach/${messageId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent }),
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) setErr(j.error ?? "失败");
    else router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="text-[11px]" style={{ color: "var(--ink2)" }}>演示:模拟会员回复 →</span>
      <button className="tag tag-green hover:opacity-80" onClick={() => reply("accept")} disabled={!!busy}>{busy === "accept" ? "…" : "接受邀请"}</button>
      <button className="tag tag-yellow hover:opacity-80" onClick={() => reply("price")} disabled={!!busy}>{busy === "price" ? "…" : "问价格"}</button>
      <button className="tag hover:opacity-80" onClick={() => reply("decline")} disabled={!!busy}>{busy === "decline" ? "…" : "婉拒"}</button>
      {err && <span className="text-[11px]" style={{ color: "var(--red)" }}>{err}</span>}
    </div>
  );
}
