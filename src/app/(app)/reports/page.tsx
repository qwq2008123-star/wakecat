import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getReports } from "@/lib/queries";
import { TaskStatusBadge } from "@/components/ui";

const KIND_LABEL: Record<string, string> = {
  coupon: "🎟 优惠券", new_item: "✨ 新品推荐", rights: "🛡 权益提醒", callback: "☕ 轻回访",
};

export default async function ReportsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const r = await getReports(user.storeId);
  const net = r.revenue - r.cost;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">📈 收益中心</h1>
        <p className="text-[12.5px]" style={{ color: "var(--ink2)" }}>
          所有数字来自 finance_entries / outreach_messages / appointments 真实记录,不含任何拍脑袋的转化率。
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>营销成本(券+触达)</div>
          <div className="kpi-num" style={{ color: "var(--red)" }}>¥{Math.round(r.cost)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>唤回流消费</div>
          <div className="kpi-num" style={{ color: "var(--green)" }}>¥{Math.round(r.revenue)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>净收益</div>
          <div className="kpi-num" style={{ color: net >= 0 ? "var(--green)" : "var(--red)" }}>¥{Math.round(net)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>到店人数</div>
          <div className="kpi-num">{r.visited}</div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="font-bold text-[15px] mb-3">🎯 触达漏斗</div>
        {r.funnel.sent > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "触达", v: r.funnel.sent, sub: "" },
              { label: "回复", v: r.funnel.replied ?? 0, sub: pct(r.funnel.replied ?? 0, r.funnel.sent) },
              { label: "预约意向", v: r.funnel.accepted ?? 0, sub: pct(r.funnel.accepted ?? 0, r.funnel.sent) },
              { label: "已到店", v: r.visited, sub: pct(r.visited, r.funnel.sent) },
            ].map((x) => (
              <div key={x.label} className="panel2 p-3">
                <div className="kpi-num" style={{ fontSize: 24 }}>{x.v}</div>
                <div className="text-[12px] font-semibold">{x.label}</div>
                <div className="text-[11px]" style={{ color: "var(--ink2)" }}>{x.sub}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--ink2)" }}>还没有触达记录。完成一个任务的执行后,漏斗会在这里出现。</p>
        )}
      </div>

      {r.byKind.length > 0 && (
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-3">⚔ 策略效果对比(财务喵口径)</div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--ink2)", background: "var(--panel2)" }}>
                <th className="px-3 py-2 font-semibold">策略</th>
                <th className="px-3 py-2 font-semibold text-right">策略数</th>
                <th className="px-3 py-2 font-semibold text-right">触达</th>
                <th className="px-3 py-2 font-semibold text-right">回复</th>
                <th className="px-3 py-2 font-semibold text-right">成本</th>
                <th className="px-4 py-2 font-semibold text-right">回流收入</th>
              </tr>
            </thead>
            <tbody>
              {r.byKind.map((k) => (
                <tr key={k.kind as string} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-2 font-semibold">{KIND_LABEL[k.kind as string] ?? (k.kind as string)}</td>
                  <td className="px-3 py-2 text-right mono">{k.strategies as number}</td>
                  <td className="px-3 py-2 text-right mono">{k.sent as number}</td>
                  <td className="px-3 py-2 text-right mono">{k.replied as number}</td>
                  <td className="px-3 py-2 text-right mono" style={{ color: "var(--red)" }}>¥{Math.round(k.cost as number)}</td>
                  <td className="px-4 py-2 text-right mono" style={{ color: "var(--green)" }}>¥{Math.round(k.revenue as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {r.taskList.length > 0 && (
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-3">📋 分任务账本</div>
          <div className="space-y-1.5">
            {r.taskList.map((t) => (
              <div key={t.id as string} className="panel2 px-3 py-2 flex items-center gap-3 text-[13px]">
                <Link href={`/tasks/${t.id}`} className="font-semibold hover:underline">{t.title as string}</Link>
                <TaskStatusBadge status={t.status as string} />
                <span className="mono text-[11.5px]" style={{ color: "var(--ink2)" }}>
                  触达 {t.sent as number} · 回复 {t.replied as number}
                </span>
                <span className="ml-auto mono text-[12.5px]">
                  <span style={{ color: "var(--red)" }}>¥{Math.round(t.cost as number)}</span>
                  {" → "}
                  <span style={{ color: "var(--green)" }}>¥{Math.round(t.revenue as number)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
