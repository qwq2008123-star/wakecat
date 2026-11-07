import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { ensureBootstrap } from "@/lib/bootstrap";
import { resolveStore } from "@/lib/store";

/** C 端轮询:拉取本访客会话的最近消息(含老板娘人工回复) */
export async function GET(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });
  const visitorId = new URL(req.url).searchParams.get("visitorId");
  if (!visitorId) return NextResponse.json({ messages: [] });
  // 会话由 chat 路由以 identity_id = 'h5:'+visitorId 创建;兼容旧的 identity 行主键写法
  // 跨店隔离:只读本店、本访客(且身份绑定归属本店)的会话
  const rows = sqlite.prepare(`
    SELECT direction, content, meta_json, created_at FROM conversation_messages
    WHERE conversation_id = (
      SELECT id FROM conversations
      WHERE store_id = ? AND (
        identity_id = ? OR identity_id = (
          SELECT id FROM customer_identities WHERE store_id = ? AND channel='h5' AND external_user_id = ?
        )
      )
      ORDER BY created_at DESC LIMIT 1
    )
    ORDER BY created_at ASC, rowid ASC
  `).all(store.id, `h5:${visitorId}`, store.id, visitorId) as Array<Record<string, unknown>>;
  return NextResponse.json({
    messages: rows.map((r) => {
      const meta = JSON.parse((r.meta_json as string) || "{}") as {
        human?: boolean; channel?: string; imagePath?: string; inspirationId?: string; catName?: string;
      };
      return {
        direction: r.direction as string,
        content: r.content as string,
        human: Boolean(meta.human),
        channel: meta.channel ?? (meta.human ? "human" : "ai"),
        imagePath: meta.imagePath ?? null,
        inspirationId: meta.inspirationId ?? null,
        catName: meta.catName ?? null,
        createdAt: r.created_at as string,
      };
    }),
  });
}
