import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { refundOrder } from "@/lib/services";

/** 订单退款:状态流转 completed→refunded + 能量回滚 + 财务冲减(幂等) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  try {
    const user = await requireUser();
    const { id } = await params;
    const { reason } = await req.json().catch(() => ({ reason: "" }));
    const r = await refundOrder(user, id, String(reason ?? "客户退款"));
    return NextResponse.json(r);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
