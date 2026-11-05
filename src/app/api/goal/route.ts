import { requireUser, HttpError } from "@/lib/session";
import { runOrchestrator, AgentEvent } from "@/lib/agents";

export const maxDuration = 120;

/** 商家输入自然语言目标 → 喵老板编排(SSE 事件流) */
export async function POST(req: Request) {
  const user = await requireUser().catch((e) => e as HttpError);
  if (user instanceof HttpError) {
    return Response.json({ error: user.message }, { status: user.status });
  }
  const { goal } = await req.json().catch(() => ({ goal: "" }));
  if (!goal || typeof goal !== "string" || goal.trim().length < 4) {
    return Response.json({ error: "请描述经营目标(至少 4 个字)" }, { status: 400 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        await runOrchestrator(user, goal.trim(), send);
      } catch (e) {
        send({ type: "log", agent: "喵老板", step: "出错", message: String(e instanceof Error ? e.message : e) });
        send({ type: "done", taskId: "", title: "", status: "failed", summary: String(e instanceof Error ? e.message : e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
