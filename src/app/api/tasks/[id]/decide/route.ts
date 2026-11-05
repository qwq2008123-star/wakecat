import { NextResponse } from "next/server";
import { requireOwner, HttpError } from "@/lib/session";
import { decideTask } from "@/lib/services";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireOwner();
    const { id } = await params;
    const { approve } = await req.json();
    await decideTask(user, id, !!approve);
    return NextResponse.json({ ok: true, status: approve ? "approved" : "rejected" });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
