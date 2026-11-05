import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/session";
import { getTask, updateTask } from "@/lib/services";
import { getLlmConfig } from "@/lib/llm";
import { runAccountant } from "@/lib/agents";

/** 重新生成财务复盘(到店入账后可刷新报告) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const t = await getTask(id);
    if (!t || t.storeId !== user.storeId) throw new HttpError(404, "任务不存在");
    const config = await getLlmConfig(user.storeId);
    const events: unknown[] = [];
    const r = await runAccountant({ storeId: user.storeId, taskId: id, emit: () => {}, config });
    await updateTask(id, { status: t.status === "approved" ? "approved" : t.status });
    return NextResponse.json({ ok: true, summary: r.summary });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
