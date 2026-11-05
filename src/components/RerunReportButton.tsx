"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RerunReportButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-ghost btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await fetch(`/api/tasks/${taskId}/report`, { method: "POST" });
        setBusy(false);
        if (r.ok) router.refresh();
      }}
    >{busy ? "财务喵复盘中…" : "🧮 让财务喵重新复盘"}</button>
  );
}
