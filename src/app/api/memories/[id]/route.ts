import { NextResponse } from "next/server";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMemberGlobal } from "@/lib/customer-identity";
import { correctMemory } from "@/lib/memory/extractor";

/** 用户修改 / 删除自己的记忆(全部记入 memory_feedback) */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  await params;
  await ensureBootstrap();
  const { id } = await params;
  const { visitorId, value } = await req.json().catch(() => ({ visitorId: "", value: "" }));
  const bound = visitorId ? getBoundMemberGlobal(visitorId) : null;
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  try {
    const r = correctMemory({ userId: bound.member_id as string, memoryId: id, value });
    return NextResponse.json({ ...r, ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "操作失败" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureBootstrap();
  await params;
  await ensureBootstrap();
  const { id } = await params;
  const visitorId = new URL(req.url).searchParams.get("visitorId");
  const bound = visitorId ? getBoundMemberGlobal(visitorId) : null;
  if (!bound) return NextResponse.json({ error: "未绑定会员" }, { status: 403 });
  try {
    const r = correctMemory({ userId: bound.member_id as string, memoryId: id, remove: true });
    return NextResponse.json({ ...r, ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "操作失败" }, { status: 400 });
  }
}
