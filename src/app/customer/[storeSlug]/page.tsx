"use client";

/* 客户侧 H5 接待页:扫码进入,销售喵真实接客
   —— 推荐来自真实服务目录,时段来自真实排班,预约真实落库 */
import { use, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SendHorizonal, QrCode, UserRoundCheck } from "lucide-react";

type Card =
  | { type: "services"; title: string; items: { id: string; name: string; price: number; durationMin: number; isNew: boolean }[] }
  | { type: "slots"; items: { date: string; weekday: string; staff: string; time: string }[] }
  | { type: "appointment"; appointmentId: string; service: string; when: string; staff: string }
  | { type: "unsubscribed" }
  | { type: "transferred" };

interface Msg { from: "user" | "emp"; text: string; cards?: Card[]; quick?: string[] }

export default function CustomerPage({ params }: { params: Promise<{ storeSlug: string }> }) {
  const { storeSlug } = use(params);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [visitorId, setVisitorId] = useState("");
  const [bound, setBound] = useState<{ name: string; level: string } | null>(null);
  const [showBind, setShowBind] = useState(false);
  const [code, setCode] = useState("");
  const [bindErr, setBindErr] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vid = localStorage.getItem("wxcat_visitor");
    if (!vid) {
      vid = crypto.randomUUID();
      localStorage.setItem("wxcat_visitor", vid);
    }
    setVisitorId(vid);
    fetch(`/api/customer/${storeSlug}/bind?visitorId=${vid}`)
      .then((r) => r.json())
      .then((j) => setBound(j.member));
  }, [storeSlug]);

  useEffect(() => { boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch(`/api/customer/${storeSlug}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, message: t }),
      });
      const j = await r.json();
      setMsgs((m) => [...m, { from: "emp", text: j.text ?? j.error ?? "…", cards: j.cards, quick: j.quickReplies }]);
      if (j.cards?.some((c: Card) => c.type === "appointment")) {
        // 预约成功,刷新绑定态不需要,但商家端任务墙/预约列表会看到
      }
    } catch {
      setMsgs((m) => [...m, { from: "emp", text: "网络开小差了,请再试一次。" }]);
    } finally {
      setBusy(false);
    }
  }

  async function bind() {
    setBindErr(null);
    const r = await fetch(`/api/customer/${storeSlug}/bind`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, memberCode: code }),
    });
    const j = await r.json();
    if (!r.ok) { setBindErr(j.error); return; }
    setBound(j.member);
    setShowBind(false);
    send("我绑定了会员,查一下我的权益");
  }

  return (
    <div
      className="min-h-screen flex flex-col max-w-[520px] mx-auto"
      style={{ background: "radial-gradient(600px 300px at 80% -10%, rgba(124,108,255,.15), transparent), var(--bg-0)" }}
    >
      {/* 店铺头 */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="w-10 h-10 rounded-xl grid place-items-center text-[20px]" style={{ background: "linear-gradient(135deg, var(--brand), var(--orange))" }}>🐱</div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[15px]">醒醒喵 · 小林美甲店</div>
          <div className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-3)" }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
            在线接待 · 价格与排班来自店铺真实数据
          </div>
        </div>
        <button
          onClick={() => setShowBind(true)}
          className="tag transition-all"
          style={bound ? { color: "var(--green)", borderColor: "var(--green)" } : { color: "var(--yellow)", borderColor: "var(--yellow)" }}
        >
          <UserRoundCheck size={11} />
          {bound ? `${bound.name}·${bound.level}` : "绑定会员"}
        </button>
      </div>

      {/* 对话区 */}
      <div ref={boxRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <MsgBubble
          from="emp"
          text={`主人你好呀!我是这家店的醒醒喵 🐱\n今天想做什么呢?我可以帮你挑款式、查价格、预约时间,也可以帮你查会员权益。`}
          quick={["有什么新品?", "秋天做个美甲,预算 200 元以内", "我想预约"]}
          onQuick={(q) => send(q)}
        />
        {msgs.map((m, i) => (
          <MsgBubble key={i} from={m.from} text={m.text} cards={m.cards} quick={m.quick} onQuick={(q) => send(q)} />
        ))}
        {busy && (
          <div className="flex gap-1.5 px-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full anim-breathe" style={{ background: "var(--ink-3)", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="sticky bottom-0 px-4 py-3 flex gap-2" style={{ background: "rgba(10,15,30,.92)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--line)" }}>
        <input
          className="input" value={input} placeholder="说说你的需求,比如「预算 200 以内的秋天款」"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button className="btn shrink-0" onClick={() => send(input)} disabled={!input.trim() || busy} aria-label="发送">
          <SendHorizonal size={15} />
        </button>
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
                <QrCode size={16} style={{ color: "var(--brand-2)" }} />
                <b>绑定会员身份</b>
              </div>
              <p className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
                演示环境:输入会员 ID(如 <code className="mono">m_001</code>)或手机尾号 4 位。
                绑定后醒醒喵才能读取你的偏好与权益;未绑定也可以正常浏览和预约。
              </p>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="会员码 / 手机尾号" />
              {bindErr && <p className="text-[12px] mt-2" style={{ color: "var(--red)" }}>{bindErr}</p>}
              <div className="flex gap-2 mt-4">
                <button className="btn flex-1" onClick={bind}>确认绑定</button>
                <button className="btn btn-ghost" onClick={() => setShowBind(false)}>先逛逛</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MsgBubble({ from, text, cards, quick, onQuick }: {
  from: "user" | "emp"; text: string; cards?: Card[]; quick?: string[]; onQuick: (q: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col ${from === "user" ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[86%] px-3.5 py-2.5 text-[13.5px] whitespace-pre-wrap rounded-2xl ${from === "emp" ? "rounded-tl-md" : "rounded-tr-md"}`}
        style={from === "user"
          ? { background: "linear-gradient(135deg, var(--brand), #6a58e8)" }
          : { background: "var(--panel-2)", border: "1px solid var(--line-soft)" }}
      >
        {text}
      </div>
      {cards?.map((c, i) => <CardView key={i} card={c} onQuick={onQuick} />)}
      {quick && quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {quick.map((q) => (
            <button key={q} className="tag hover:opacity-80" onClick={() => onQuick(q)}>{q}</button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function CardView({ card, onQuick }: { card: Card; onQuick: (q: string) => void }) {
  if (card.type === "services") {
    return (
      <div className="w-full max-w-[340px] panel2 p-3 space-y-2">
        <div className="text-[11px] font-bold" style={{ color: "var(--brand-2)" }}>💅 {card.title} · 来自店铺真实目录</div>
        {card.items.map((s) => (
          <button key={s.id} className="w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors hover:bg-white/5"
            style={{ border: "1px solid var(--line-soft)" }} onClick={() => onQuick(`做「${s.name}」`)}>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold flex items-center gap-1.5">
                {s.name}
                {s.isNew && <span className="tag tag-cyan !text-[9px]">新品</span>}
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
      <div className="w-full max-w-[340px] panel2 p-3 space-y-2">
        <div className="text-[11px] font-bold" style={{ color: "var(--brand-2)" }}>📅 可约时段 · 来自真实排班</div>
        {card.items.map((s, i) => (
          <button key={i} className="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors hover:bg-white/5"
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
      <div className="w-full max-w-[340px] p-4 rounded-2xl" style={{ background: "rgba(62,207,142,.1)", border: "1px solid rgba(62,207,142,.45)" }}>
        <div className="text-[13px] font-extrabold" style={{ color: "var(--green)" }}>✓ 预约已确认(真实订单待到店核销)</div>
        <div className="text-[13px] mt-1.5">{card.service}</div>
        <div className="text-[12px] mt-0.5" style={{ color: "var(--ink-2)" }}>{card.when} · {card.staff}</div>
      </div>
    );
  }
  if (card.type === "unsubscribed") {
    return <div className="tag tag-yellow">已关闭营销消息,立即生效</div>;
  }
  return <div className="tag tag-blue">已转接人工店员</div>;
}
