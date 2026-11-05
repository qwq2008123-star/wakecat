"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = { engineMode: string; model: string; hasKey: boolean; keyMasked: string | null; mockFailRate: number; provider: string };

export default function SettingsForm({ initial, role }: { initial: Status; role: string }) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model);
  const [engineMode, setEngineMode] = useState(initial.engineMode);
  const [failRate, setFailRate] = useState(initial.mockFailRate);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true); setMsg(null); setErr(null);
    const body: Record<string, unknown> = { model, engineMode, mockFailRate: failRate };
    if (apiKey.trim() !== "") body.apiKey = apiKey.trim();
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) setErr(j.error ?? "保存失败");
    else { setMsg("✅ 已保存,下一次 Agent 运行即生效"); setApiKey(""); router.refresh(); }
  }

  const disabled = role !== "owner";

  return (
    <div className="panel p-5 space-y-4">
      <div>
        <div className="font-bold text-[15px] mb-1">✦ 大模型(智谱 GLM)</div>
        <p className="text-[12px]" style={{ color: "var(--ink2)" }}>
          OpenAI 兼容接口,默认 https://open.bigmodel.cn/api/paas/v4。Key 仅存服务端数据库,界面只显示掩码。
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[12.5px] font-semibold">API Key {initial.hasKey && <span className="tag tag-green ml-1">{initial.keyMasked}</span>}</span>
          <input className="input mt-1.5" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={initial.hasKey ? "留空表示不修改;输入新 Key 覆盖" : "粘贴智谱 API Key"} disabled={disabled} />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-semibold">模型</span>
          <input className="input mt-1.5" value={model} onChange={(e) => setModel(e.target.value)} placeholder="glm-4-flash" disabled={disabled} />
        </label>
        <label className="block">
          <span className="text-[12.5px] font-semibold">引擎模式</span>
          <select className="input mt-1.5" value={engineMode} onChange={(e) => setEngineMode(e.target.value)} disabled={disabled}>
            <option value="auto">自动:有 Key 用 LLM,失败/无 Key 自动切规则引擎(诚实降级)</option>
            <option value="llm">仅大模型:无 Key 时任务失败(不静默兜底)</option>
            <option value="rules">仅规则引擎:完全离线,演示最稳</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[12.5px] font-semibold">演示通道模拟失败率:{Math.round(failRate * 100)}%</span>
          <input type="range" min={0} max={30} value={failRate * 100} onChange={(e) => setFailRate(Number(e.target.value) / 100)} className="w-full mt-3 accent-[var(--brand)]" disabled={disabled} />
          <span className="text-[11.5px]" style={{ color: "var(--ink2)" }}>调高它,向评委演示「发送失败如实上报,绝不假装成功」。</span>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-orange" onClick={save} disabled={loading || disabled}>{loading ? "保存中…" : "保存设置"}</button>
        {msg && <span className="text-[12.5px]" style={{ color: "var(--green)" }}>{msg}</span>}
        {err && <span className="text-[12.5px]" style={{ color: "var(--red)" }}>{err}</span>}
        {disabled && <span className="text-[12px]" style={{ color: "var(--yellow)" }}>仅老板娘可修改设置</span>}
      </div>
    </div>
  );
}
