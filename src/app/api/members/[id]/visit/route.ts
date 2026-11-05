import { NextResponse } from "next/server";
import { requireUser, HttpError } from "@/lib/session";
import { recordVisit } from "@/lib/services";
import { SERVICES } from "@/lib/constants";

/** 演示功能:模拟会员到店(生成真实消费流水、财务收入、猫咪喂食) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { taskId, service, amount } = await req.json().catch(() => ({} as Record<string, unknown>));
    const svc = typeof service === "string" && service ? service : SERVICES[Math.floor(Math.random() * (SERVICES.length - 1))].name;
    const amt = typeof amount === "number" && amount > 0 ? amount : 98 + Math.floor(Math.random() * 80);
    const r = await recordVisit(user, id, { service: svc, amount: amt, taskId });
    return NextResponse.json({ ok: true, ...r, service: svc, amount: amt });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
