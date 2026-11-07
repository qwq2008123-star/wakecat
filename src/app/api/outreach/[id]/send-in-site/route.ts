import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";
import { sendInSiteNow } from "@/lib/services";

/** 商家选择站内直发:消息直接写进会员在本站的收件箱(C 端可见可回复) */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  const user = await requireUser();
  const { id } = await params;
  try {
    const r = await sendInSiteNow(user, id);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "发送失败" },
      { status: 400 },
    );
  }
}
