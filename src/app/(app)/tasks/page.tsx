import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { listTasks } from "@/lib/queries";
import { TaskStatusBadge, EngineBadge } from "@/components/ui";

export default async function TasksPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const tasks = await listTasks(user.storeId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">经营任务大厅</h1>
        <p className="text-[12.5px]" style={{ color: "var(--ink2)" }}>
          AI 主动发现经营机会并创建任务;所有对外触达必须经你批准后才执行,全过程留痕。
        </p>
      </div>
      {tasks.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-[14px] mb-2">还没有经营任务</p>
          <Link className="btn btn-orange" href="/dashboard">去驾驶舱给喵老板下达目标 →</Link>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left" style={{ color: "var(--ink2)", background: "var(--panel2)" }}>
                <th className="px-4 py-2.5 font-semibold">任务</th>
                <th className="px-3 py-2.5 font-semibold">状态</th>
                <th className="px-3 py-2.5 font-semibold">引擎</th>
                <th className="px-3 py-2.5 font-semibold text-right">策略/触达/回复</th>
                <th className="px-4 py-2.5 font-semibold text-right">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id as string} className="border-t hover:bg-white/[.02]" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5">
                    <Link href={`/tasks/${t.id}`} className="font-semibold hover:underline">{t.title as string}</Link>
                    <div className="text-[11.5px] truncate max-w-[380px]" style={{ color: "var(--ink2)" }}>{t.goal as string}</div>
                  </td>
                  <td className="px-3 py-2.5"><TaskStatusBadge status={t.status as string} /></td>
                  <td className="px-3 py-2.5"><EngineBadge engine={t.engine as string} /></td>
                  <td className="px-3 py-2.5 text-right mono">
                    {t.strategy_count as number} / {t.sent_count as number} / {t.replied_count as number}
                    {(t.failed_count as number) > 0 && <span style={{ color: "var(--red)" }}>(失败{t.failed_count as number})</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: "var(--ink2)" }}>{String(t.created_at).slice(5, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
