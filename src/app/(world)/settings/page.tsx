"use client";

/* 系统设置:GLM 模型/引擎模式/全自动模式。所有项改动即真实生效(写 agent_configs)。 */
import { useEffect, useState } from "react";
import { Loader2, Save, Bot, Zap, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/world/ui";

type Settings = {
  engineMode: "auto" | "llm" | "rules";
  model: string;
  hasKey: boolean;
  keyMasked: string | null;
  mockFailRate: number;
  autoRun: boolean;
};

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setS).catch(() => setS(null));
  }, []);

  async function save(patch: Record<string, unknown>, note: string) {
    setSaving(true); setSaved(null);
    try {
      const body = { ...patch };
      if (apiKey.trim()) body.apiKey = apiKey.trim();
      const r = await fetch("/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) { setS(j); setApiKey(""); setSaved(note); setTimeout(() => setSaved(null), 2500); }
    } finally { setSaving(false); }
  }

  if (!s) {
    return <div className="p-10 text-center text-[13px]" style={{ color: "var(--ink-3)" }}>载入中…</div>;
  }

  return (
    <div className="space-y-5 max-w-[760px]">
      <PageHeader
        title="系统设置"
        desc="改动即时写库生效。演示环境的所有「诚实标注」由这里的状态决定。"
      />

      {/* 全自动模式 */}
      <div className="surface p-5">
        <div className="flex items-start gap-3">
          <span className="shrink-0 mt-0.5" style={{ color: s.autoRun ? "var(--green)" : "var(--ink-3)" }}><Zap size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[14px]">全自动模式</b>
              <span className="tag" style={s.autoRun
                ? { color: "var(--green)", borderColor: "var(--green)" }
                : { color: "var(--yellow)", borderColor: "var(--yellow)" }}>
                {s.autoRun ? "已开启" : "已关闭"}
              </span>
            </div>
            <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>
              开启后:你在任务大厅下目标(或对喵老板说目标),AI 团队编排完成后<b>自动批准并执行</b>——侦探体检、军师策略、销售触达一气呵成,不再停在待审批。
            </p>
            <p className="text-[11.5px] mt-1.5 flex items-start gap-1.5" style={{ color: "var(--ink-3)" }}>
              <ShieldCheck size={12} className="shrink-0 mt-0.5" />
              授权/频次/预算三道闸门照常拦截(退订会员永不打扰、14天2次冷却、预算超支即停),每一步写进执行日志。
            </p>
            <button
              className={`btn btn-sm mt-3 ${s.autoRun ? "btn-ghost" : "btn-orange"}`}
              disabled={saving}
              onClick={() => save({ autoRun: !s.autoRun }, s.autoRun ? "全自动模式已关闭" : "全自动模式已开启")}
            >
              {saving ? <Loader2 size={13} className="anim-spin" /> : <Zap size={13} />}
              {s.autoRun ? "关闭全自动" : "开启全自动"}
            </button>
          </div>
        </div>
      </div>

      {/* 模型设置 */}
      <div className="surface p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Bot size={16} style={{ color: "var(--brand-2)" }} />
          <b className="text-[14px]">GLM 大模型</b>
          <span className="tag ml-auto" style={s.hasKey
            ? { color: "var(--green)", borderColor: "var(--green)" }
            : { color: "var(--red)", borderColor: "var(--red)" }}>
            {s.hasKey ? `Key 已配置(${s.keyMasked})` : "未配置 Key"}
          </span>
        </div>
        <div>
          <div className="text-[12px] font-bold mb-1.5">模型</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "glm-4-flash", d: "免费 · 快,多步工具调用偶尔不稳" },
              { v: "glm-4-plus", d: "付费 · 更稳,工具循环成功率高" },
              { v: "glm-4-air", d: "轻量 · 速度与成本均衡" },
            ].map((m) => (
              <button key={m.v} disabled={saving}
                className="tag transition-all text-left"
                title={m.d}
                style={s.model === m.v
                  ? { color: "var(--brand-2)", borderColor: "var(--brand)", background: "rgba(124,108,255,.1)" }
                  : {}}
                onClick={() => save({ model: m.v }, `模型已切到 ${m.v}`)}>
                {m.v}{s.model === m.v ? " ✓" : ""}
              </button>
            ))}
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: "var(--ink-3)" }}>
            军师喵/销售喵的多步工具循环在 glm-4-flash 上偶发超时降级——见任务日志「诚实降级」;要更稳就切 glm-4-plus。
          </p>
        </div>
        <div>
          <div className="text-[12px] font-bold mb-1.5">引擎模式</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: "auto", d: "有 Key 走大模型,失败诚实降级规则引擎" },
              { v: "llm", d: "强制大模型,失败即报错不降级" },
              { v: "rules", d: "纯规则引擎(不用 Key)" },
            ].map((m) => (
              <button key={m.v} disabled={saving} title={m.d}
                className="tag transition-all"
                style={s.engineMode === m.v
                  ? { color: "var(--brand-2)", borderColor: "var(--brand)", background: "rgba(124,108,255,.1)" }
                  : {}}
                onClick={() => save({ engineMode: m.v }, `引擎模式已切到 ${m.v}`)}>
                {m.v}{s.engineMode === m.v ? " ✓" : ""}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[12px] font-bold mb-1.5">API Key {s.keyMasked && <span className="font-normal" style={{ color: "var(--ink-3)" }}>当前 {s.keyMasked},留空则不修改</span>}</div>
          <div className="flex gap-2">
            <input className="input" value={apiKey} placeholder="粘贴完整 Key(id.secret)"
              onChange={(e) => setApiKey(e.target.value)} />
            <button className="btn shrink-0" disabled={saving || !apiKey.trim()}
              onClick={() => save({ apiKey }, "Key 已更新")}>
              {saving ? <Loader2 size={14} className="anim-spin" /> : <Save size={14} />} 保存
            </button>
          </div>
        </div>
      </div>

      {saved && (
        <div className="surface p-3.5 text-[13px] flex items-center gap-2" style={{ color: "var(--green)", borderColor: "var(--green)" }}>
          ✓ {saved}
        </div>
      )}
    </div>
  );
}
