import { NextResponse } from "next/server";
import { requireOwner, HttpError, requireUser } from "@/lib/session";
import { updateAgentConfig } from "@/lib/services";
import { getLlmStatus } from "@/lib/queries";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await getLlmStatus(user.storeId));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireOwner();
    const { apiKey, model, engineMode, mockFailRate, baseUrl, autoRun } = await req.json().catch(() => ({}));
    await updateAgentConfig(user, {
      apiKey: apiKey === "" ? null : apiKey, // 空串表示清除 Key
      model, engineMode, mockFailRate, baseUrl, autoRun,
    });
    return NextResponse.json(await getLlmStatus(user.storeId));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : "服务器错误" }, { status });
  }
}
