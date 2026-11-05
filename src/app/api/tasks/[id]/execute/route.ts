import { requireUser, HttpError } from "@/lib/session";
import { executeApprovedTask, AgentEvent } from "@/lib/agents";

export const maxDuration = 120;

/** 批准后执行:销售喵触达 → 财务喵复盘(SSE 事件流) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch((e) => e as HttpError);
  if (user instanceof HttpError) {
    return Response.json({ error: user.message }, { status: user.status });
  }
  const { id } = await params;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        await executeApprovedTask(user, id, send);
      } catch (e) {
        send({ type: "log", agent: "喵老板", step: "执行出错", message: String(e instanceof Error ? e.message : e) });
        send({ type: "done", taskId: id, title: "", status: "failed", summary: String(e instanceof Error ? e.message : e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
