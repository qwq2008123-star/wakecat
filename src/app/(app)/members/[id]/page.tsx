import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMemberDetail } from "@/lib/queries";
import { StateBadge, DemoBadge, TaskStatusBadge, IntentBadge } from "@/components/ui";
import CatIcon from "@/components/CatIcon";
import VisitButton from "@/components/VisitButton";

const SOURCE_META: Record<string, { label: string; cls: string }> = {
  order: { label: "📦 消费流水", cls: "tag-green" },
  chat: { label: "💬 聊天记录", cls: "tag-blue" },
  manual: { label: "✍ 老板娘口述", cls: "tag-yellow" },
  agent_inferred: { label: "🤖 AI 推断", cls: "tag-red" },
};

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;
  const d = await getMemberDetail(user.storeId, id);
  if (!d) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ink2)" }}>
        <Link href="/members" className="hover:underline">会员中心</Link> / 会员档案
      </div>

      {/* 头部 */}
      <div className="panel p-5 flex flex-wrap items-center gap-5">
        <CatIcon state={d.state === "active" ? "happy" : d.state === "drowsy" ? "drowsy" : "sleep"} colorway={d.cat?.colorway ?? "orange"} size={84} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold">{d.member.name}</h1>
            <span className="tag">{d.member.level}</span>
            <StateBadge state={d.state} />
            {!!d.member.isDemo && <DemoBadge />}
          </div>
          <div className="text-[12.5px] mt-1" style={{ color: "var(--ink2)" }}>
            {d.member.phoneMasked} · {d.member.gender} · 生日 {d.member.birthdayText ?? "未知"} · 入会 {(new Date(d.member.joinedAt)).toLocaleDateString("zh-CN")}
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {JSON.parse(d.member.tagsJson || "[]").map((t: string) => <span key={t} className="tag">{t}</span>)}
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="kpi-num">¥{Math.round(d.totalSpend)}</div>
            <div className="text-[11.5px]" style={{ color: "var(--ink2)" }}>累计消费 · {d.records.length} 次到店</div>
          </div>
          <VisitButton memberId={d.member.id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 记忆博物馆 */}
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-1">🧠 会员记忆博物馆</div>
          <p className="text-[11.5px] mb-3" style={{ color: "var(--ink2)" }}>
            每条记忆都有数据来源,禁止 AI 编造事实。销售喵只能引用这里的句子。
          </p>
          <div className="space-y-2">
            {d.memories.map((m) => {
              const sm = SOURCE_META[m.source_type as string] ?? { label: m.source_type as string, cls: "" };
              return (
                <div key={m.id as string} className="panel2 p-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`tag ${sm.cls}`}>{sm.label}</span>
                    <span className="tag">{m.kind === "preference" ? "偏好" : m.kind === "fact" ? "事实" : m.kind === "event" ? "事件" : "反馈"}</span>
                    <span className="mono ml-auto" style={{ color: "var(--ink2)" }}>{String(m.source_ref).slice(0, 42)}</span>
                  </div>
                  <div className="text-[13.5px]">{m.content as string}</div>
                  <div className="text-[11px] mt-1" style={{ color: "var(--ink2)" }}>{String(m.created_at).slice(0, 10)}</div>
                </div>
              );
            })}
            {d.memories.length === 0 && <p className="text-[13px]" style={{ color: "var(--ink2)" }}>暂无记忆</p>}
          </div>
        </div>

        <div className="space-y-4">
          {/* 消费历史 */}
          <div className="panel p-5">
            <div className="font-bold text-[15px] mb-3">💅 消费历史</div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
              {d.records.map((r) => (
                <div key={r.id as string} className="panel2 px-3 py-2 flex items-center text-[13px]">
                  <div>
                    <div>{r.service as string}</div>
                    <div className="text-[11px]" style={{ color: "var(--ink2)" }}>{String(r.occurred_at).slice(0, 10)} · {r.artist as string}</div>
                  </div>
                  <div className="ml-auto mono">¥{(r.amount as number).toFixed(0)}</div>
                </div>
              ))}
              {d.records.length === 0 && <p className="text-[13px]" style={{ color: "var(--ink2)" }}>暂无消费记录</p>}
            </div>
          </div>

          {/* 触达历史 */}
          <div className="panel p-5">
            <div className="font-bold text-[15px] mb-3">💌 触达历史</div>
            <div className="space-y-2 max-h-[260px] overflow-y-auto">
              {d.outreach.map((o) => (
                <div key={o.id as string} className="panel2 p-3">
                  <div className="flex items-center gap-2 flex-wrap text-[11.5px] mb-1">
                    <Link href={`/tasks/${o.task_id}`} className="hover:underline" style={{ color: "var(--brand2)" }}>{(o.task_title as string) ?? "任务"}</Link>
                    <TaskStatusBadge status={o.status === "replied" ? "completed" : o.status === "failed" ? "failed" : "running"} />
                    <IntentBadge intent={o.reply_intent as string | null} />
                    <span className="ml-auto" style={{ color: "var(--ink2)" }}>{String(o.created_at).slice(5, 16).replace("T", " ")}</span>
                  </div>
                  <div className="text-[13px]">{o.body as string}</div>
                  {!!o.failure_reason && (
                    <div className="text-[12px] mt-1" style={{ color: "var(--red)" }}>⚠ 发送失败:{o.failure_reason as string}</div>
                  )}
                  {!!o.reply_text && (
                    <div className="text-[12.5px] mt-1 panel2 p-2" style={{ color: "var(--ink2)" }}>会员回复:{o.reply_text as string}</div>
                  )}
                </div>
              ))}
              {d.outreach.length === 0 && <p className="text-[13px]" style={{ color: "var(--ink2)" }}>还没有触达记录</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
