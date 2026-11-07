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

/* ============================================================
   猫的主动跟进(陪伴性质,非营销):
   ① 收藏跟进:主人 3~21 天前收藏了某个款式,猫来聊聊它
   ② 意图跟进:主人说过「下个月想做/预约」,过半后猫轻轻提醒
   规则:每条跟进 30 天内最多一次;主人近 2 天收到过猫的主动消息则全跳过;
        绝不提优惠券/活动——那是店铺的事,不是猫的事。
   ============================================================ */
export async function runCatFollowUps(storeId: string): Promise<{ sent: number }> {
  let sent = 0;
  const rows = sqlite.prepare(`
    SELECT c.id AS cat_id, c.name AS cat_name, c.stage AS cat_stage, c.member_id,
      m.id AS uid, m.name AS owner_name
    FROM cats c JOIN members m ON m.id = c.member_id
    WHERE c.store_id = ? AND m.store_id = ? AND c.stage != 'dormant'
  `).all(storeId, storeId) as Array<Record<string, unknown>>;

  for (const r of rows) {
    const ident = sqlite.prepare(`
      SELECT external_user_id FROM customer_identities
      WHERE store_id = ? AND member_id = ? AND channel = 'h5'
      ORDER BY created_at DESC LIMIT 1
    `).get(storeId, r.member_id) as { external_user_id: string } | undefined;
    if (!ident) continue;
    const identityId = `h5:${ident.external_user_id}`;
    const conv = sqlite.prepare(
      "SELECT id FROM conversations WHERE identity_id = ? AND store_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(identityId, storeId) as { id: string } | undefined;

    // 全局节流:近 2 天猫已经主动说过话(想念/跟进)就不再打扰
    if (conv) {
      const recent = sqlite.prepare(`
        SELECT COUNT(*) AS c FROM conversation_messages
        WHERE conversation_id = ? AND created_at > datetime('now', '-2 day')
          AND (meta_json LIKE '%"cat-miss"%' OR meta_json LIKE '%"cat-care"%')
      `).get(conv.id) as { c: number };
      if (recent.c > 0) continue;
    }

    const memories = topMemoriesForPrompt(r.uid as string, 5);
    const candidates: { kind: "favorite" | "intent"; dedupe: string; topic: string; days: number }[] = [];

    // ① 收藏跟进:3~21 天前收藏
    const favs = sqlite.prepare(`
      SELECT id, title, created_at FROM inspiration_items
      WHERE user_id = ? AND deleted_at IS NULL
        AND created_at > datetime('now', '-21 day')
        AND created_at < datetime('now', '-3 day')
      ORDER BY created_at DESC LIMIT 2
    `).all(r.uid as string) as Array<{ id: string; title: string; created_at: string }>;
    for (const f of favs) {
      const age = Math.floor((Date.now() - new Date(f.created_at).getTime()) / 86400_000);
      candidates.push({
        kind: "favorite", days: age,
        topic: `你收藏的那款「${f.title}」`,
        dedupe: `cat-follow:fav:${f.id}`,
      });
    }

    // ② 意图跟进:表达过预约/想做意图(10~60 天前)
    const intents = sqlite.prepare(`
      SELECT value, updated_at FROM user_memories
      WHERE user_id = ? AND status = 'active'
        AND (value LIKE '%预约%' OR value LIKE '%想做%' OR value LIKE '%下次%' OR value LIKE '%下个月%')
        AND updated_at > datetime('now', '-60 day')
        AND updated_at < datetime('now', '-10 day')
      ORDER BY updated_at DESC LIMIT 2
    `).all(r.uid as string) as Array<{ value: string; updated_at: string }>;
    for (const it of intents) {
      const age = Math.floor((Date.now() - new Date(it.updated_at).getTime()) / 86400_000);
      candidates.push({
        kind: "intent", days: age,
        topic: `你之前说过的「${it.value.slice(0, 18)}」`,
        dedupe: `cat-follow:intent:${it.updated_at.slice(0, 10)}`,
      });
    }

    // 30 天内已跟进过的候选跳过(dedupe)
    const sendable = candidates.filter((c2) => {
      if (!conv) return false;
      const dup = sqlite.prepare(`
        SELECT COUNT(*) AS c FROM conversation_messages
        WHERE conversation_id = ? AND created_at > datetime('now', '-30 day')
          AND meta_json LIKE ?
      `).get(conv.id, `%"${c2.dedupe}"%`) as { c: number };
      return dup.c === 0;
    });
    if (!sendable.length) continue;

    // 一次最多送一条(最老的话题优先),其余留给下次
    const pick = sendable[0];
    const content = await composeFollowUp(storeId, {
      catName: r.cat_name as string, ownerName: r.owner_name as string,
      kind: pick.kind, topic: pick.topic, days: pick.days, memories,
    });
    if (!content) continue;
    const { deliverInSite } = await import("../services");
    const d = deliverInSite(storeId, r.member_id as string, content, {
      channel: "cat-care", catName: r.cat_name, followDedupe: pick.dedupe,
    });
    if (d.ok) sent++; // 去重标记随消息 meta 落库(direct deliverInSite meta 含 followDedupe)
  }
  return { sent };
}

async function composeFollowUp(storeId: string, ctx: {
  catName: string; ownerName: string; kind: "favorite" | "intent";
  topic: string; days: number; memories: string[];
}): Promise<string | null> {
  const theme = ctx.kind === "favorite"
    ? `主人 ${ctx.days} 天前收藏了${ctx.topic}`
    : `主人 ${ctx.days} 天前说过${ctx.topic}`;
  const fallback = ctx.kind === "favorite"
    ? `${ctx.ownerName},你 ${ctx.days} 天前收藏的${ctx.topic.replace("你收藏的那款", "")}我一直帮你记着呢~想做了跟我说,我帮你留意。`
    : `${ctx.ownerName},你之前提过${ctx.topic.replace("你之前说过的", "")}——最近有想法了吗?随时叫我安排呀🐾`;
  const config = await getLlmConfig(storeId);
  if (!config.apiKey || config.engineMode === "rules") return fallback;
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{
          role: "system",
          content: `你是猫咪「${ctx.catName}」,美甲店会员 ${ctx.ownerName} 的 AI 闺蜜猫。${theme}。
你们的回忆:${ctx.memories.join(";") || "(还不太了解)"}
写一条跟进消息:35 字以内,猫的口吻,自然提起这件事,像朋友的关心。
绝对不推销、不提优惠券、不制造紧迫感。`,
        }],
        temperature: 0.85,
        max_tokens: 100,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    const reply: string | undefined = data.choices?.[0]?.message?.content;
    return reply ? reply.replace(/[ --]/g, "").trim().slice(0, 90) : fallback;
  } catch {
    return fallback;
  }
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
