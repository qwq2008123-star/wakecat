import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { getOverview, getLlmStatus, listTasks } from "@/lib/queries";
import { StateBadge, TaskStatusBadge, EngineBadge, DemoBadge } from "@/components/ui";
import GoalConsole from "@/components/GoalConsole";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const [ov, llm, tasks] = await Promise.all([
    getOverview(user.storeId), getLlmStatus(user.storeId), listTasks(user.storeId),
  ]);
  const recentLogs = tasks.slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-extrabold">经营驾驶舱</h1>
          <p className="text-[12.5px]" style={{ color: "var(--ink2)" }}>
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })} · 今天 AI 员工已就位
          </p>
        </div>
        <div className="flex gap-2">
          <span className="tag tag-purple">AI 员工:喵老板 + 侦探喵 + 军师喵 + 销售喵 + 财务喵</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>会员总数 {ov.total > 0 && <DemoBadge />}</div>
          <div className="kpi-num">{ov.total}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>活跃 / 打瞌睡</div>
          <div className="kpi-num" style={{ color: "var(--green)" }}>{ov.active} <span style={{ color: "var(--ink2)", fontSize: 15 }}>/</span> <span style={{ color: "var(--yellow)" }}>{ov.drowsy}</span></div>
        </div>
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>冬眠 / 卡快过期</div>
          <div className="kpi-num" style={{ color: "var(--red)" }}>{ov.hibernate + ov.sick} <span style={{ fontSize: 14, color: "var(--ink2)" }}>({ov.sick} 张卡临期)</span></div>
        </div>
        <div className="panel p-4">
          <div className="text-[12px] mb-1" style={{ color: "var(--ink2)" }}>AI 已赚回 / 花掉</div>
          <div className="kpi-num"><span style={{ color: "var(--green)" }}>¥{Math.round(ov.monthRevenue)}</span> <span style={{ color: "var(--ink2)", fontSize: 14 }}>/ ¥{Math.round(ov.monthCost)}</span></div>
        </div>
      </div>

      {/* 喵老板对话 */}
      <GoalConsole hasKey={llm.hasKey} engineMode={llm.engineMode} />

      <div className="grid lg:grid-cols-2 gap-4">
        {/* 任务大厅入口 */}
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-bold text-[15px]">📋 经营任务大厅</div>
            <Link className="text-[12px]" style={{ color: "var(--brand2)" }} href="/tasks">全部任务 →</Link>
          </div>
          {ov.pendingApproval > 0 && (
            <div className="panel2 p-3 mb-3 text-[13px] flex items-center justify-between">
              <span>🔔 有 <b style={{ color: "var(--yellow)" }}>{ov.pendingApproval}</b> 个任务等待你的审批(批准后才会触达会员)</span>
            </div>
          )}
          {tasks.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--ink2)" }}>还没有任务。在上方给喵老板下达第一个经营目标吧。</p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 4).map((t) => (
                <Link key={t.id as string} href={`/tasks/${t.id}`} className="panel2 p-3 flex items-center gap-3 hover:opacity-90 block">
                  <div className="min-w-0">
                    <div className="font-semibold text-[13.5px] truncate">{t.title as string}</div>
                    <div className="text-[11.5px]" style={{ color: "var(--ink2)" }}>
                      {(t.created_at as string).slice(5, 16).replace("T", " ")} · 触达 {t.sent_count as number} 人 · 回复 {t.replied_count as number}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    <EngineBadge engine={t.engine as string} />
                    <TaskStatusBadge status={t.status as string} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* AI 员工工作情况 */}
        <div className="panel p-5">
          <div className="font-bold text-[15px] mb-3">🤖 AI 员工最近在忙什么</div>
          {recentLogs.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--ink2)" }}>AI 员工待命中。下达目标后,这里会显示每个 Agent 的工具调用记录。</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((t) => (
                <div key={t.id as string} className="panel2 p-3">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    {t.title as string} <TaskStatusBadge status={t.status as string} />
                  </div>
                  <div className="text-[11.5px] mono mt-1" style={{ color: "var(--ink2)" }}>
                    触达 {t.sent_count as number} · 回复 {t.replied_count as number} · 失败 {t.failed_count as number}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="panel2 p-3 mt-3 text-[12px]" style={{ color: "var(--ink2)" }}>
            💡 沉睡会员的历史贡献估算 ¥{ov.sleepingContributionEstimate.toLocaleString()} —— 这就是让猫醒来的理由。
          </div>
        </div>
      </div>
    </div>
  );
}
