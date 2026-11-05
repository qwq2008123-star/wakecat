"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CatIcon from "@/components/CatIcon";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function login(as: "owner" | "staff") {
    setLoading(as);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as }),
    });
    if (r.ok) router.push("/dashboard");
    else setLoading(null);
  }

  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "radial-gradient(1000px 500px at 70% -10%, rgba(124,108,255,.14), transparent), var(--bg)" }}>
      <div className="panel w-full max-w-md p-10 rise">
        <div className="flex items-center gap-3 mb-2">
          <CatIcon state="awake" colorway="orange" size={46} />
          <div>
            <div className="text-xl font-extrabold tracking-wide">醒醒喵 WAKECAT</div>
            <div className="text-xs" style={{ color: "var(--ink2)" }}>AI 会员唤醒官 · 喵屋美甲演示店</div>
          </div>
        </div>
        <p className="text-[13px] mt-4 mb-7" style={{ color: "var(--ink2)" }}>
          老板负责经营店铺,醒醒喵负责把老顾客找回来。<br />
          内置 60 名演示会员与 6 个月消费流水,全部带「演示数据」标注。
        </p>
        <div className="grid gap-3">
          <button className="btn btn-orange" disabled={!!loading} onClick={() => login("owner")}>
            {loading === "owner" ? "登录中…" : "🐱 以老板娘「芳姐」登录(拥有审批权)"}
          </button>
          <button className="btn btn-ghost" disabled={!!loading} onClick={() => login("staff")}>
            {loading === "staff" ? "登录中…" : "💅 以店员「小林」登录(无审批权,用于权限演示)"}
          </button>
        </div>
        <p className="text-[11px] mt-6" style={{ color: "var(--ink2)" }}>
          福州高校 AI 黑客松 · 赛道一 AI+商业 · 演示环境
        </p>
      </div>
    </div>
  );
}
