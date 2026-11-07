"use client";

/* 老板娘登录(生产环境 B端入口);本地演示模式由 WAKECAT_AUTO_OWNER 跳过 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (r.ok) { router.push("/dashboard"); router.refresh(); }
      else setErr(j.error ?? "登录失败");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center" style={{ background: "var(--bg-0)" }}>
      <div className="surface p-8 w-full max-w-[360px]">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} style={{ color: "var(--brand-2)" }} />
          <b className="text-[16px]">醒醒喵 · 老板娘登录</b>
        </div>
        <input
          className="input mb-3" type="password" value={password} autoFocus
          placeholder="登录密码" onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        {err && <p className="text-[12px] mb-2" style={{ color: "var(--red)" }}>{err}</p>}
        <button className="btn w-full" disabled={busy || !password.trim()} onClick={login}>
          {busy ? "登录中…" : "登录"}
        </button>
        <p className="text-[11px] mt-3" style={{ color: "var(--ink-3)" }}>
          C 端客户页无需登录;<a href="/customer/miaowu" style={{ color: "var(--brand-2)" }}>去客户页 →</a>
        </p>
      </div>
    </div>
  );
}
