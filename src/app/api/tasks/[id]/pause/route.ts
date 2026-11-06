import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/session";
import { getTask, updateTask, audit, appendLog } from "@/lib/services";

/** 暂停 / 恢复任务(演示状态机;不触达任何会员) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { pause } = await req.json().catch(() => ({ pause: true }));
    const t = await getTask(id);
    if (!t || t.storeId !== user.storeId) throw new HttpError(404, "任务不存在");
    if (pause && t.status !== "running") throw new HttpError(400, `任务状态为 ${t.status},不可暂停`);
    if (!pause && t.status !== "paused") throw new HttpError(400, `任务状态为 ${t.status},不可恢复`);
    const next = pause ? "paused" : "running";
    await updateTask(id, { status: next });
    await audit(user.name, pause ? "task.pause" : "task.resume", id, {});
    await appendLog({ taskId: id, agent: "喵老板", step: pause ? "任务暂停" : "任务恢复", message: `${user.name} ${pause ? "暂停" : "恢复"}了该任务` });
    return NextResponse.json({ ok: true, status: next });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
