"use client";

/* ============================================================
   C 端猫咪世界:小屋 / 闺蜜聊天 / 灵感收藏(阶段4) / 成长
   猫咪状态由真实能量/亲密度驱动;记忆用户可查看/修改/删除。
   ============================================================ */
import { use, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  SendHorizonal, Home, MessageCircleHeart, Sparkles, Heart,
  Brain, Pencil, Trash2, Check, Moon, Zap, QrCode,
} from "lucide-react";
import CatCharacter from "@/components/world/CatCharacter";
import type { CatColorway } from "@/mock-data/types";

type CatView = {
  id: string; name: string; personality: string; colorway: string;
  energy: number; bond: number; level: number; stage: string;
  decorations: string[]; energyToday: number;
};
type Card =
  | { type: "services"; title: string; items: { id: string; name: string; price: number; durationMin: number; isNew: boolean }[] }
  | { type: "slots"; items: { date: string; weekday: string; staff: string; time: string }[] }
  | { type: "appointment"; appointmentId: string; service: string; when: string; staff: string }
  | { type: "unsubscribed" } | { type: "transferred" };
interface Msg { from: "user" | "emp"; text: string; cards?: Card[]; quick?: string[]; engine?: string; newMemories?: string[] }
interface MemoryRow {
  id: string; memory_type: string; category: string;
  attribute: string; value: string; user_confirmed: number; updated_at: string;
}
const TYPE_LABEL: Record<string, string> = {
  long_term_preference: "长期偏好", short_term_interest: "短期兴趣",
  behavior: "行为记忆", transaction: "交易记忆", interaction: "互动记忆",
};
const STAGE_LABEL: Record<string, string> = {
  active: "活力满满", resting: "在休息", sleeping: "睡着了", dormant: "休眠中 · 可免费唤醒",
};

export default function CustomerPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = use(params);
  const [visitorId, setVisitorId] = useState("");
  const [bound, setBound] = useState<{ name: string; level: string } | null>(null);
  const [cat, setCat] = useState<CatView | null>(null);
  const [tab, setTab] = useState<"home" | "chat" | "inspire" | "growth">("home");
  const [showBind, setShowBind] = useState(false);
  const [code, setCode] = useState("");
  const [bindErr, setBindErr] = useState<string | null>(null);

  const refresh = useCallback(async (vid: string) => {
    const r = await fetch(`/api/cats/mine?visitorId=${vid}&storeSlug=${storeSlug}`).then((x) => x.json()).catch(() => null);
    setBound(r?.member ?? null);
    setCat(r?.cat ?? null);
  }, []);

  useEffect(() => {
    let vid = localStorage.getItem("wxcat_visitor");
    if (!vid) { vid = crypto.randomUUID(); localStorage.setItem("wxcat_visitor", vid); }
    setVisitorId(vid);
    refresh(vid);
  }, [refresh]);

  async function bind() {
    setBindErr(null);
    const r = await fetch(`/api/customer/${storeSlug}/adopt`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, memberCode: code, storeSlug }),
    });
    const j = await r.json();
    if (!r.ok) { setBindErr(j.error); return; }
    setCat(j.cat); setBound(j.member); setShowBind(false); setTab("home");
  }

  async function wake() {
    const r = await fetch(`/api/cats/wake`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, storeSlug }),
    });
    const j = await r.json();
    if (j.cat) setCat(j.cat);
  }

  const catState = !cat ? "sleep" : cat.stage === "active" ? "happy" : cat.stage === "resting" ? "drowsy" : "sleep";

  return (
    <div className="min-h-screen flex flex-col max-w-[520px] mx-auto" style={{ background: "radial-gradient(600px 300px at 80% -10%, rgba(124,108,255,.15), transparent), var(--bg-0)" }}>
      {/* 店铺头 */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="w-9 h-9 rounded-xl grid place-items-center text-[18px]" style={{ background: "linear-gradient(135deg, var(--brand), var(--orange))" }}>🐱</div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[14px]">醒醒喵 · 小林美甲店</div>
          <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>你的 AI 闺蜜猫咪 · 真实数据驱动</div>
        </div>
        <button
          onClick={() => setShowBind(true)}
          className="tag transition-all"
          style={bound ? { color: "var(--green)", borderColor: "var(--green)" } : { color: "var(--yellow)", borderColor: "var(--yellow)" }}
        >
          {bound ? `${bound.name}·${bound.level}` : "绑定会员"}
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "home" && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 space-y-4">
              <div className="surface relative overflow-hidden p-6 text-center">
                <div className="aurora" style={{ width: 280, height: 180, top: -60, left: "20%", background: "rgba(124,108,255,.2)" }} />
                <div className="relative flex flex-col items-center">
                  <div className="anim-floaty">
                    <CatCharacter colorway={(cat?.colorway ?? "orange") as CatColorway} state={catState as never} accessory="crown" size={140} />
                  </div>
                  <div className="text-[17px] font-extrabold mt-2">{cat?.name ?? "尚未领养"} <span className="text-[12px] font-semibold" style={{ color: "var(--ink-3)" }}>Lv.{cat?.level ?? 1}</span></div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: cat && cat.stage === "dormant" ? "var(--red)" : "var(--ink-2)" }}>
                    {cat ? STAGE_LABEL[cat.stage] ?? cat.stage : "绑定会员,领养你的专属闺蜜猫"}
                  </div>
                  {cat && <div className="text-[11px] mt-1 italic" style={{ color: "var(--ink-3)" }}>{cat.personality}</div>}
                  {cat && cat.stage === "dormant" && (
                    <button className="btn btn-orange btn-sm mt-3" onClick={wake}>🌙 免费唤醒(不花钱)</button>
                  )}
                </div>
              </div>

              {cat && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="surface p-4">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--orange)" }}>
                      <Zap size={12} /> 能量 <span className="ml-auto text-[13px]">{cat.energy}/100</span>
                    </div>
                    <div className="h-2 mt-2 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
                      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${cat.energy}%` }}
                        style={{ background: "linear-gradient(90deg, var(--orange), var(--yellow))" }} />
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: "var(--ink-3)" }}>今日已获得 {cat.energyToday}</div>
                  </div>
                  <div className="surface p-4">
                    <div className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "#FF5F7E" }}>
                      <Heart size={12} /> 亲密度 <span className="ml-auto text-[13px]">{cat.bond}/100</span>
                    </div>
                    <div className="h-2 mt-2 rounded-full overflow-hidden" style={{ background: "var(--line-soft)" }}>
                      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${cat.bond}%` }}
                        style={{ background: "linear-gradient(90deg, #FF9DB5, #FF5F7E)" }} />
                    </div>
                    <div className="text-[10.5px] mt-1.5" style={{ color: "var(--ink-3)" }}>来自聊天与分享,与消费无关</div>
                  </div>
                </div>
              )}

              {!cat && (
                <div className="surface p-5 text-center">
                  <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                    绑定会员后即可领养你的 AI 闺蜜猫——它记得你的喜好,陪你聊天,还会主动帮你发现喜欢的款式。
                  </p>
                  <button className="btn btn-orange mt-3" onClick={() => setShowBind(true)}>绑定并领养 🐾</button>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { icon: <MessageCircleHeart size={16} />, label: "闺蜜聊天", desc: "聊喜好 · 发图", t: "chat" as const },
                  { icon: <Sparkles size={16} />, label: "灵感收藏", desc: "阶段④上线", t: "inspire" as const },
                  { icon: <Heart size={16} />, label: "成长中心", desc: "能量·记忆", t: "growth" as const },
                ].map((x) => (
                  <button key={x.label} onClick={() => setTab(x.t)}
                    className="surface p-3.5 text-center hover:-translate-y-0.5 transition-transform">
                    <span className="inline-block mb-1" style={{ color: "var(--brand-2)" }}>{x.icon}</span>
                    <div className="text-[12.5px] font-bold">{x.label}</div>
                    <div className="text-[10px]" style={{ color: "var(--ink-3)" }}>{x.desc}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {tab === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-[calc(100vh-190px)]">
              <BestieChatPanel storeSlug={storeSlug} visitorId={visitorId} bound={!!bound} catName={cat?.name} onEnergy={() => refresh(visitorId)} />
            </motion.div>
          )}

          {tab === "inspire" && (
            <motion.div key="inspire" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
              <div className="surface p-8 text-center">
                <Sparkles size={28} className="mx-auto mb-3" style={{ color: "var(--brand-2)" }} />
                <div className="font-bold mb-1">灵感收藏室</div>
                <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  发图给闺蜜猫 → AI 分析风格标签 → 自动归类到你的灵感主题。<br />阶段④上线,敬请期待。
                </p>
              </div>
            </motion.div>
          )}

          {tab === "growth" && (
            <motion.div key="growth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GrowthPanel storeSlug={storeSlug} visitorId={visitorId} cat={cat} onRefresh={() => refresh(visitorId)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部 Tab 栏 */}
      <div className="sticky bottom-0 grid grid-cols-4" style={{ background: "rgba(10,15,30,.94)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)" }}>
        {[
          { key: "home" as const, label: "小屋", icon: <Home size={17} /> },
          { key: "chat" as const, label: "闺蜜聊天", icon: <MessageCircleHeart size={17} /> },
          { key: "inspire" as const, label: "灵感", icon: <Sparkles size={17} /> },
          { key: "growth" as const, label: "成长", icon: <Heart size={17} /> },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className="py-3 flex flex-col items-center gap-0.5 transition-colors"
            style={{ color: tab === t.key ? "var(--brand-2)" : "var(--ink-3)" }}>
            {t.icon}<span className="text-[10px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 绑定弹层 */}
      <AnimatePresence>
        {showBind && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: "rgba(5,7,15,.7)" }} onClick={() => setShowBind(false)}>
            <motion.div className="surface p-6 w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }}>
              <div className="flex items-center gap-2 mb-3">
                <QrCode size={16} style={{ color: "var(--brand-2)" }} /><b>绑定会员 · 领养闺蜜猫</b>
              </div>
              <p className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
                演示环境:输入会员 ID(如 <code className="mono">m_017</code> 米娅·钻石)或手机尾号 4 位。
              </p>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="会员码 / 手机尾号" />
              {bindErr && <p className="text-[12px] mt-2" style={{ color: "var(--red)" }}>{bindErr}</p>}
              <div className="flex gap-2 mt-4">
                <button className="btn flex-1" onClick={bind}>确认绑定并领养</button>
                <button className="btn btn-ghost" onClick={() => setShowBind(false)}>先逛逛</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================= 闺蜜聊天 ================= */
function BestieChatPanel({ storeSlug, visitorId, bound, catName, onEnergy }: {
  storeSlug: string; visitorId: string; bound: boolean; catName?: string; onEnergy: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([{
      from: "emp",
      text: bound
        ? `我在呢~${catName ?? "我"}一直记得你说过的话。想聊点什么,或者让我帮你挑款式都行 🐾`
        : "你好呀~绑定会员后我就正式成为你的闺蜜猫,记得住你的喜好哦。现在也可以先挑款式、查价格!",
    }]);
  }, [bound, catName]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  // 轮询老板娘人工回复(15s 一次)
  useEffect(() => {
    if (!visitorId) return;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/customer/${storeSlug}/messages?visitorId=${visitorId}`);
        const j = await r.json();
        const lastHuman = (j.messages ?? []).filter((m: { direction: string }) => m.direction === "out").pop();
        if (lastHuman) {
          setMsgs((prev) => {
            const lastText = prev.filter((m) => m.from === "emp").pop()?.text;
            if (lastText === lastHuman.content) return prev;
            return [...prev, { from: "emp", text: `💬 芳姐(老板娘): ${lastHuman.content}` }];
          });
        }
      } catch { /* 静默轮询 */ }
    }, 15000);
    return () => clearInterval(timer);
  }, [visitorId, storeSlug]);

  async function send(t: string) {
    const text = t.trim();
    if (!text || busy) return;
    setMsgs((m) => [...m, { from: "user", text }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch(`/api/customer/${storeSlug}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, message: text }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, {
        from: "emp", text: j.text ?? "…", cards: j.cards, quick: j.quickReplies,
        engine: j.engine, newMemories: j.newMemories,
      }]);
      if (j.cat) onEnergy();
    } finally { setBusy(false); }
  }

  return (
    <div className="h-full flex flex-col">
      <div ref={boxRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {msgs.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${m.from === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[86%] px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap rounded-2xl ${m.from === "emp" ? "rounded-tl-md" : "rounded-tr-md"}`}
              style={m.from === "user"
                ? { background: "linear-gradient(135deg, var(--brand), #6a58e8)" }
                : { background: "var(--panel-2)", border: "1px solid var(--line-soft)" }}
            >
              {m.text}
            </div>
            {m.engine && m.from === "emp" && (
              <span className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>
                {String(m.engine).startsWith("llm") ? "✦ GLM 真模型" : "⚙ 规则引擎(演示)"}
              </span>
            )}
            {m.newMemories?.map((n) => (
              <span key={n} className="tag tag-green text-[10px]">🧠 记住了:{n}</span>
            ))}
            {m.cards?.map((c, ci) => <CardView key={ci} card={c} onQuick={(q) => send(q)} />)}
            {m.quick && m.quick.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {m.quick.map((q) => (
                  <button key={q} className="tag hover:opacity-80" onClick={() => send(q)}>{q}</button>
                ))}
              </div>
            )}
          </motion.div>
        ))}
        {busy && (
          <div className="flex gap-1.5 px-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full anim-breathe" style={{ background: "var(--ink-3)", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>
      <div className="sticky bottom-0 px-4 py-3 flex gap-2" style={{ background: "rgba(10,15,30,.92)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)" }}>
        <input
          className="input" value={input} placeholder="和闺蜜猫聊聊天,或说说喜欢什么款式…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
        />
        <button className="btn shrink-0" onClick={() => send(input)} disabled={!input.trim() || busy} aria-label="发送">
          <SendHorizonal size={15} />
        </button>
      </div>
    </div>
  );
}

function CardView({ card, onQuick }: { card: Card; onQuick: (q: string) => void }) {
  if (card.type === "services") {
    return (
      <div className="w-full max-w-[320px] panel2 p-3 space-y-2">
        <div className="text-[11px] font-bold" style={{ color: "var(--brand-2)" }}>💅 {card.title} · 店铺真实目录</div>
        {card.items.map((s) => (
          <button key={s.id} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left hover:bg-white/5"
            style={{ border: "1px solid var(--line-soft)" }} onClick={() => onQuick(`做「${s.name}」`)}>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold flex items-center gap-1.5">
                {s.name}{s.isNew && <span className="tag tag-cyan !text-[9px]">新品</span>}
              </div>
              <div className="text-[11px]" style={{ color: "var(--ink-3)" }}>约 {s.durationMin} 分钟</div>
            </div>
            <div className="text-[15px] font-extrabold" style={{ color: "var(--orange)" }}>¥{s.price}</div>
          </button>
        ))}
      </div>
    );
  }
  if (card.type === "slots") {
    return (
      <div className="w-full max-w-[320px] panel2 p-3 space-y-2">
        <div className="text-[11px] font-bold" style={{ color: "var(--brand-2)" }}>📅 可约时段 · 真实排班</div>
        {card.items.map((s, i) => (
          <button key={i} className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-white/5"
            style={{ border: "1px solid var(--line-soft)" }} onClick={() => onQuick(s.weekday)}>
            <div className="text-[13px] font-bold">{s.date.slice(5)} <span style={{ color: "var(--ink-3)" }}>{s.weekday}</span></div>
            <div className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>{s.staff} · {s.time}</div>
          </button>
        ))}
      </div>
    );
  }
  if (card.type === "appointment") {
    return (
      <div className="w-full max-w-[320px] p-4 rounded-2xl" style={{ background: "rgba(62,207,142,.1)", border: "1px solid rgba(62,207,142,.45)" }}>
        <div className="text-[13px] font-extrabold" style={{ color: "var(--green)" }}>✓ 预约已确认</div>
        <div className="text-[13px] mt-1.5">{card.service}</div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--ink-2)" }}>{card.when} · {card.staff}</div>
      </div>
    );
  }
  return <div className="tag">{card.type === "unsubscribed" ? "已关闭营销消息" : "已转接人工店员"}</div>;
}

/* ================= 成长中心(含记忆管理) ================= */
function GrowthPanel({ storeSlug, visitorId, cat, onRefresh }: {
  storeSlug: string; visitorId: string; cat: CatView | null; onRefresh: () => void;
}) {
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [transactions, setTransactions] = useState<{ action: string; delta: number; reversed: number; created_at: string }[]>([]);

  const load = useCallback(async () => {
    if (!visitorId) return;
    const [m, t] = await Promise.all([
      fetch(`/api/memories?visitorId=${visitorId}&storeSlug=${storeSlug}`).then((x) => x.json()).catch(() => ({ memories: [] })),
      cat ? fetch(`/api/cats/mine?visitorId=${visitorId}`).then((x) => x.json()).catch(() => ({ transactions: [] })) : Promise.resolve({ transactions: [] }),
    ]);
    setMemories(m.memories ?? []);
    setTransactions(t.transactions ?? []);
  }, [visitorId, cat]);

  useEffect(() => { load(); }, [load]);

  async function save(id: string) {
    await fetch(`/api/memories/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, value: editValue }),
    });
    setEditing(null); load(); onRefresh();
  }
  async function remove(id: string) {
    await fetch(`/api/memories/${id}?visitorId=${visitorId}`, { method: "DELETE" });
    load(); onRefresh();
  }

  return (
    <div className="p-5 space-y-5">
      <div className="surface p-5 text-center relative overflow-hidden">
        <div className="aurora" style={{ width: 240, height: 140, top: -50, left: "30%", background: "rgba(124,108,255,.18)" }} />
        <div className="relative">
          <div className="text-[26px] font-extrabold">Lv.{cat?.level ?? 1} <span style={{ fontSize: 14 }}>{cat?.name ?? ""}</span></div>
          <div className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
            亲密度 {cat?.bond ?? 0} / 100 · 能量 {cat?.energy ?? 0}/100
          </div>
          <div className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>
            亲密度来自陪伴与分享;消费只带来能量,不影响它对你的感情。
          </div>
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex items-center gap-2 text-[14px] font-bold mb-1">
          <Brain size={15} style={{ color: "var(--brand-2)" }} /> 闺蜜猫的记忆
          <span className="tag tag-demo ml-auto">你可以修改 / 删除</span>
        </div>
        <p className="text-[11.5px] mb-3" style={{ color: "var(--ink-2)" }}>
          AI 推测的记忆未经你确认(点 ✓ 确认后权重提升);你纠正后它永远不会再记错。
        </p>
        {memories.length === 0 && (
          <p className="text-[12.5px] py-4 text-center" style={{ color: "var(--ink-3)" }}>
            还没有记忆。去「闺蜜聊天」里聊聊你喜欢什么吧。
          </p>
        )}
        <div className="space-y-2">
          {memories.map((m) => (
            <div key={m.id} className="panel2 p-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="tag tag-brand">{TYPE_LABEL[m.memory_type] ?? m.memory_type}</span>
                <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{m.category} · {m.attribute}</span>
                {!m.user_confirmed && <span className="tag tag-yellow">AI 推测</span>}
                {m.user_confirmed === 1 && <span className="tag tag-green">你已确认</span>}
              </div>
              {editing === m.id ? (
                <div className="flex gap-2 mt-1">
                  <input className="input !py-1.5 text-[12.5px]" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <button className="btn btn-green btn-sm" onClick={() => save(m.id)}><Check size={12} /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-[13.5px] flex-1">{m.value}</div>
                  <button className="p-1.5 rounded-lg hover:bg-white/5" aria-label="修改记忆"
                    onClick={() => { setEditing(m.id); setEditValue(m.value); }}>
                    <Pencil size={13} style={{ color: "var(--ink-3)" }} />
                  </button>
                  <button className="p-1.5 rounded-lg hover:bg-white/5" aria-label="删除记忆"
                    onClick={() => remove(m.id)}>
                    <Trash2 size={13} style={{ color: "var(--red)" }} />
                  </button>
                </div>
              )}
              <div className="text-[10px] mt-1" style={{ color: "var(--ink-3)" }}>{m.updated_at?.slice(0, 10)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
          <Zap size={14} style={{ color: "var(--orange)" }} /> 能量流水(全部可审计)
        </div>
        <div className="space-y-1.5">
          {transactions.map((t, i) => (
            <div key={i} className="panel2 px-3 py-2 flex items-center text-[12px]">
              <span style={{ color: "var(--ink-2)" }}>{t.action}</span>
              <span className="ml-auto mono" style={{ color: t.delta > 0 ? "var(--green)" : "var(--red)", textDecoration: t.reversed ? "line-through" : "none" }}>
                {t.delta > 0 ? "+" : ""}{t.delta}
              </span>
              <span className="mono ml-3" style={{ color: "var(--ink-3)" }}>{t.created_at?.slice(5, 16).replace("T", " ")}</span>
            </div>
          ))}
          {transactions.length === 0 && <p className="text-[12px] py-2 text-center" style={{ color: "var(--ink-3)" }}>暂无能量流水</p>}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-3)" }}>
          <Moon size={11} /> 能量每日自然衰减;归零后猫咪休眠,可随时免费唤醒。
        </div>
      </div>
    </div>
  );
}
