import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { requireUser } from "@/lib/session";
import { ensureBootstrap } from "@/lib/bootstrap";

/** 会话接管:需要人工的会话 + 最近活跃会话 */
export async function GET() {
  await ensureBootstrap();
  const user = await requireUser();
  // 会员归属优先 conversation.member_id;H5 会话初建时为空,退而按 identity_id('h5:'+visitorId) 反查绑定关系
  const nameSql = `
    COALESCE(m.name, (
      SELECT mem.name FROM customer_identities ci JOIN members mem ON mem.id = ci.member_id
      WHERE ci.store_id = c.store_id AND ci.channel = 'h5' AND c.identity_id = 'h5:' || ci.external_user_id
      LIMIT 1
    ), c.identity_id)`;
  const needsHuman = sqlite.prepare(`
    SELECT c.id, c.member_id, c.channel, c.created_at, ${nameSql} AS member_name,
      (SELECT content FROM conversation_messages cm WHERE cm.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_msg
    FROM conversations c LEFT JOIN members m ON m.id = c.member_id
    WHERE c.store_id = ? AND c.status = 'needs_human' ORDER BY c.created_at DESC
  `).all(user.storeId);
  const recent = sqlite.prepare(`
    SELECT c.id, c.member_id, c.channel, c.status, c.created_at, ${nameSql} AS member_name,
      (SELECT content FROM conversation_messages cm WHERE cm.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_msg
    FROM conversations c LEFT JOIN members m ON m.id = c.member_id
    WHERE c.store_id = ? AND c.status != 'needs_human' ORDER BY c.created_at DESC LIMIT 10
  `).all(user.storeId);
  return NextResponse.json({ needsHuman, recent });
}
