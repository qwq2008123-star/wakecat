import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/session";
import { simulateReply } from "@/lib/services";

/** 演示功能:模拟会员回复(意图由规则解析,界面明确标注"演示") */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { intent = "accept", text } = await req.json().catch(() => ({}));
    if (!["accept", "price", "decline"].includes(intent)) {
      return NextResponse.json({ error: "intent 必须是 accept/price/decline" }, { status: 400 });
    }
    const r = await simulateReply(user, id, intent, text);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
