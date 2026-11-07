import { sqlite } from "../db/client";
import { getLlmConfig } from "../llm";
import { topMemoriesForPrompt } from "../memory/extractor";

/* ============================================================
   猫咪想念检查:主人 30 天没来,猫主动发一条「想你」消息。
   ——不是营销触达:不提项目、不给券,是猫在想她的主人。
   7 天内最多一条(防打扰);GLM 生成,失败诚实降级为模板。
   ============================================================ */

const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

declare global {
  // eslint-disable-next-line no-var
  var __wxCatMissRunning: boolean | undefined;
}

export async function runCatMissCheck(storeId: string): Promise<{ checked: number; sent: number }> {
  // 进程锁:启动扫描与手动扫描可能重叠,防止同一只猫被发两条
  if (globalThis.__wxCatMissRunning) return { checked: 0, sent: 0 };
  globalThis.__wxCatMissRunning = true;
  try {
    return await runCatMissCheckInner(storeId);
  } finally {
    globalThis.__wxCatMissRunning = false;
  }
}

async function runCatMissCheckInner(storeId: string): Promise<{ checked: number; sent: number }> {
  // 有猫且主人 30 天未到店的,逐只检查
  const rows = sqlite.prepare(`
    SELECT c.id AS cat_id, c.name AS cat_name, c.member_id,
      m.id AS uid, m.name AS owner_name,
      CAST(julianday('now') - julianday(COALESCE((
        SELECT MAX(occurred_at) FROM consumption_records r WHERE r.member_id = m.id
      ), '2000-01-01')) AS INT) AS days
    FROM cats c JOIN members m ON m.id = c.member_id
    WHERE c.store_id = ? AND m.store_id = ? AND c.stage != 'dormant'
  `).all(storeId, storeId) as Array<Record<string, unknown>>;

  let sent = 0;
  for (const r of rows) {
    const days = Number(r.days) || 0;
    if (days < 30) continue;
    // 休眠的猫停止自主活动(DORMANT 阶段语义);主人上线唤醒后自然恢复
    const catStage = (sqlite.prepare("SELECT stage FROM cats WHERE id = ?").get(r.cat_id) as { stage?: string } | undefined)?.stage;
    if (catStage === "dormant") continue;

    // 会话:主人绑定的 H5 身份(没上线过就没有收件箱,跳过——上线机制会接管排队)
    const ident = sqlite.prepare(`
      SELECT external_user_id FROM customer_identities
      WHERE store_id = ? AND member_id = ? AND channel = 'h5'
      ORDER BY created_at DESC LIMIT 1
    `).get(storeId, r.member_id) as { external_user_id: string } | undefined;
    if (!ident) continue;

    // 7 天内已发过想念消息则跳过(防打扰)
    const identityId = `h5:${ident.external_user_id}`;
    const conv = sqlite.prepare(
      "SELECT id FROM conversations WHERE identity_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(identityId) as { id: string } | undefined;
    if (conv) {
      const recent = sqlite.prepare(`
        SELECT COUNT(*) AS c FROM conversation_messages
        WHERE conversation_id = ? AND created_at > datetime('now','-7 day')
          AND meta_json LIKE '%"cat-miss"%'
      `).get(conv.id) as { c: number };
      if (recent.c > 0) continue;
    }

    const memories = topMemoriesForPrompt(r.uid as string, 5);
    const content = await composeMissMessage(storeId, {
      catName: r.cat_name as string, ownerName: r.owner_name as string, days,
      memories,
    });
    if (!content) continue;

    // 送达(meta.channel = cat-miss,C 端按猫的口吻展示)
    const { deliverInSite } = await import("../services");
    const d = deliverInSite(storeId, r.member_id as string, content, {
      channel: "cat-miss", catName: r.cat_name,
    });
    if (d.ok) sent++;
  }
  return { checked: rows.length, sent };
}

async function composeMissMessage(storeId: string, ctx: {
  catName: string; ownerName: string; days: number; memories: string[];
}): Promise<string | null> {
  const fallback = `${ctx.ownerName},我都 ${ctx.days} 天没见你啦,趴在窗边等你好久 🐾${ctx.memories[0] ? `还记得你说过的${ctx.memories[0].split(": ")[1] ?? ctx.memories[0]}吗` : ""},有空回来呀,我不推销,就是想你。`;
  const config = await getLlmConfig(storeId);
  if (!config.apiKey || config.engineMode === "rules") return fallback;
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: `你是猫咪「${ctx.catName}」,美甲店会员 ${ctx.ownerName} 的 AI 闺蜜猫。主人已经 ${ctx.days} 天没来店里,你很想她。
你们共同的回忆(挑一件自然提起):${ctx.memories.length ? ctx.memories.join(";") : "(还不太了解)"}
写一条想念消息:30 字以内,像猫的口吻,提一件回忆,绝对不推销任何项目、不提优惠券。`,
          },
        ],
        temperature: 0.85,
        max_tokens: 90,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const reply: string | undefined = data.choices?.[0]?.message?.content;
    return reply ? reply.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, 80) : fallback;
  } catch {
    return fallback; // 诚实降级
  }
}
