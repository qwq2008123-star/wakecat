"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 演示功能:模拟会员到店(创建真实消费流水 + 收入入账 + 喂猫) */
export default function VisitButton({ memberId, taskId }: { memberId: string; taskId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function visit() {
    setLoading(true); setMsg(null);
    const r = await fetch(`/api/members/${memberId}/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    const j = await r.json();
    setLoading(false);
    if (r.ok) {
      setMsg(`✅ ${j.service} ¥${j.amount} 已入账,猫被喂到啦`);
      router.refresh();
    } else {
      setMsg(`❌ ${j.error}`);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button className="btn btn-green btn-sm" onClick={visit} disabled={loading}>
        {loading ? "到店中…" : "🐟 模拟到店(演示)"}
      </button>
      {msg && <span className="text-[12px]" style={{ color: "var(--green)" }}>{msg}</span>}
    </div>
  );
}
