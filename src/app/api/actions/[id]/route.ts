import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { recordMerchantAction } from "@/lib/actions/generator";

/** 商家处理行动项:完成(done)或跳过(skipped) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const r = recordMerchantAction({
    storeId: user.storeId, actedBy: user.name,
    dedupeKey: body.dedupeKey as string, type: body.type as string,
    title: body.title as string, reason: body.reason as string,
    memberId: body.memberId as string | undefined,
    payload: (body.payload ?? {}) as Record<string, unknown>,
    status: body.action === "skip" ? "skipped" : "done",
  });
  return NextResponse.json(r);
}
