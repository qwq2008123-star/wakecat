import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getTaskDetail } from "@/lib/queries";
import { TaskStatusBadge, EngineBadge } from "@/components/ui";
import TaskActions from "@/components/TaskActions";
import ReplyButtons from "@/components/ReplyButtons";
import VisitButton from "@/components/VisitButton";
import RerunReportButton from "@/components/RerunReportButton";

const KIND_META: Record<string, { label: string; cls: string }> = {
  coupon: { label: "🎟 优惠券", cls: "tag-red" },
  new_item: { label: "✨ 新品推荐", cls: "tag-purple" },
  rights: { label: "🛡 权益提醒", cls: "tag-blue" },
  callback: { label: "☕ 轻回访", cls: "" },
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;
  const d = await getTaskDetail(user.storeId, id);
  if (!d) notFound();
  const payload = d.payload as {
    analysis?: { segments?: { name: string; count: number; desc: string }[]; opportunities?: { memberId: string; name: string; reason: string; risk: string }[]; summary?: string };
    goalSummary?: string;
  };
  const result = d.result as {
    cost?: number; revenue?: number; net?: number;
    funnel?: { sent: number; replied: number; accepted: number };
    strategyCompare?: { kind: string; sent: number; replied: number; revenue: number; cost: number; roi?: string }[];
    report?: string;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "var(--ink2)" }}>
        <Link href="/tasks" className="hover:underline">任务大厅</Link> / 任务详情
      </div>

      <div className="panel p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-extrabold">{d.task.title}</h1>
          <TaskStatusBadge status={d.task.status} />
          <EngineBadge engine={d.task.engine} />
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--ink2)" }}>商家目标:「{d.task.goal}」</p>
        {payload.goalSummary && <p className="text-[12.5px] mt-1" style={{ color: "var(--ink2)" }}>喵老板计划:{payload.goalSummary}</p>}
      </div>

      <TaskActions taskId={d.task.id} status={d.task.status} role={user.role} />

      {/* 侦探分析 */}
      {payload.analysis && (
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-3">🔍 侦探喵的会员体检</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {(payload.analysis.segments ?? []).map((s) => (
              <div key={s.name} className="panel2 p-3">
                <div className="kpi-num" style={{ fontSize: 22 }}>{s.count}</div>
                <div className="text-[12px] font-semibold">{s.name}</div>
                <div className="text-[11px]" style={{ color: "var(--ink2)" }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {(payload.analysis.opportunities ?? []).map((o) => (
              <div key={o.memberId} className="panel2 px-3 py-2 flex items-center gap-3 text-[13px]">
                <Link href={`/members/${o.memberId}`} className="font-semibold hover:underline">{o.name}</Link>
                <span style={{ color: "var(--ink2)" }}>{o.reason}</span>
                <span className={`ml-auto tag ${o.risk === "高" ? "tag-red" : "tag-yellow"}`}>流失风险 {o.risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 策略与消息 */}
      {d.strategies.length > 0 && (
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-1">🧠 军师喵的策略({d.strategies.length} 人)</div>
          <p className="text-[11.5px] mb-3" style={{ color: "var(--ink2)" }}>预估总成本 ¥{Math.round(d.task.costEstimate)} —— 批准后销售喵才会照此执行。</p>
          <div className="space-y-2">
            {d.strategies.map((s) => {
              const km = KIND_META[s.kind as string] ?? { label: s.kind as string, cls: "" };
              const msg = d.messages.find((m) => m.strategy_id === s.id);
              return (
                <div key={s.id as string} className="panel2 p-3">
                  <div className="flex items-center gap-2 flex-wrap text-[13px]">
                    <span className={`tag ${km.cls}`}>{km.label}</span>
                    <Link href={`/members/${s.member_id}`} className="font-semibold hover:underline">{s.member_name as string}</Link>
                    <span style={{ color: "var(--ink2)" }}>{s.reason as string}</span>
                    <span className="ml-auto mono text-[11.5px]" style={{ color: "var(--ink2)" }}>
                      成本 ¥{Number(s.predicted_cost).toFixed(0)} → 预估回流 ¥{Number(s.predicted_uplift).toFixed(0)}
                    </span>
                  </div>
                  {msg && (
                    <div className="mt-2 border-l-2 pl-3 py-1" style={{ borderColor: "var(--brand)" }}>
                      <div className="text-[13.5px]">{msg.body as string}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <TaskStatusBadge status={msg.status === "sent" ? "running" : msg.status === "replied" ? "completed" : msg.status === "failed" ? "failed" : "draft"} />
                        {msg.status === "failed" && <span className="text-[12px]" style={{ color: "var(--red)" }}>⚠ {msg.failure_reason as string}</span>}
                        {msg.status === "sent" && <ReplyButtons messageId={msg.id as string} />}
                        {!!msg.reply_text && <span className="text-[12px]" style={{ color: "var(--ink2)" }}>会员回复:{msg.reply_text as string}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 财务复盘 */}
      {result.report && (
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-3 flex items-center gap-3 flex-wrap">
            🧮 财务喵的复盘报告
            <RerunReportButton taskId={d.task.id} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="panel2 p-3"><div className="text-[11.5px]" style={{ color: "var(--ink2)" }}>触达 / 回复 / 预约</div><div className="text-lg font-bold">{result.funnel?.sent ?? 0} / {result.funnel?.replied ?? 0} / {result.funnel?.accepted ?? 0}</div></div>
            <div className="panel2 p-3"><div className="text-[11.5px]" style={{ color: "var(--ink2)" }}>总成本</div><div className="text-lg font-bold" style={{ color: "var(--red)" }}>¥{Math.round(result.cost ?? 0)}</div></div>
            <div className="panel2 p-3"><div className="text-[11.5px]" style={{ color: "var(--ink2)" }}>回流消费</div><div className="text-lg font-bold" style={{ color: "var(--green)" }}>¥{Math.round(result.revenue ?? 0)}</div></div>
            <div className="panel2 p-3"><div className="text-[11.5px]" style={{ color: "var(--ink2)" }}>净收益</div><div className="text-lg font-bold" style={{ color: (result.net ?? 0) >= 0 ? "var(--green)" : "var(--red)" }}>¥{Math.round(result.net ?? 0)}</div></div>
          </div>
          <p className="text-[13.5px] panel2 p-3">{result.report}</p>
          {(result.funnel?.accepted ?? 0) > 0 && (
            <p className="text-[12px] mt-2" style={{ color: "var(--ink2)" }}>
              💡 有预约意向的会员还没到店?去会员档案点「模拟到店」完成闭环,收入与猫咪成长会真实入账。
            </p>
          )}
        </div>
      )}

      {/* 执行日志 */}
      <div className="panel p-5">
        <div className="font-bold text-[15px] mb-3">📜 Agent 执行日志(全程留痕)</div>
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto mono text-[12px]">
          {d.logs.map((l) => (
            <div key={l.id as string} className="panel2 px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ color: "var(--brand2)" }}>{l.agent as string}</span>
                <span style={{ color: "var(--ink2)" }}>{l.step as string}</span>
                {!!l.tool_name && <span className="tag">{l.tool_name as string}()</span>}
                {l.status === "error" && <span className="tag tag-red">error</span>}
                <span className="ml-auto" style={{ color: "var(--ink2)" }}>{String(l.created_at).slice(11, 19)}</span>
              </div>
              {!!l.message && <div className="mt-0.5">{l.message as string}</div>}
              {!!l.tool_input_json && (
                <details className="mt-1">
                  <summary className="cursor-pointer" style={{ color: "var(--ink2)" }}>工具入参/出参</summary>
                  <div className="mt-1 whitespace-pre-wrap break-all" style={{ color: "var(--ink2)" }}>
                    in: {String(l.tool_input_json).slice(0, 300)}{"\n"}out: {String(l.tool_output_json).slice(0, 400)}
                  </div>
                </details>
              )}
            </div>
          ))}
          {d.logs.length === 0 && <p style={{ color: "var(--ink2)" }}>暂无日志</p>}
        </div>
      </div>
    </div>
  );
}
