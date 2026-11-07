import { db, sqlite } from "../db/client";
import { merchantActions } from "../db/schema";
import { eq } from "drizzle-orm";

/* ============================================================
   今日行动清单生成器:从真实业务数据派生「老板娘今天该做什么」
   行动项实时派生(带 stable dedupe_key),已处理记录存 merchant_actions;
   商家完成/跳过后当日不再出现。
   ============================================================ */

export type ActionType =
  | "approval"            // 待审批任务
  | "appointment_today"   // 今天到店准备
  | "no_reply_followup"   // 触达7天未回复,人工跟进
  | "stuck_conversation"  // 客户会话转人工
  | "budget_blocked"      // 预算拦截,需商家决策
  | "manual_send";        // 半自动企微:AI起草待商家真实发送

export interface ActionItem {
  dedupeKey: string;
  type: ActionType;
  title: string;
  reason: string;
  memberId?: string;
  memberName?: string;
  payload: Record<string, unknown>; // taskId / appointmentId / conversationId / draft 等
  suggestedAction: string;
}

type Row = Record<string, unknown>;
const nowIso = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);

export function generateDailyActions(storeId: string): ActionItem[] {
  const items: ActionItem[] = [];

  /* ① 待审批任务 */
  const pending = sqlite.prepare(`
    SELECT id, title, goal, cost_estimate FROM tasks
    WHERE store_id = ? AND status = 'pending_approval' ORDER BY created_at DESC
  `).all(storeId) as Row[];
  for (const t of pending) {
    items.push({
      dedupeKey: `approval:${t.id}`,
      type: "approval",
      title: `审批任务「${t.title}」`,
      reason: `批准后销售喵才能触达 ${t.cost_estimate ? `预估成本 ¥${t.cost_estimate}` : "零成本策略"}`,
      payload: { taskId: t.id, goal: t.goal },
      suggestedAction: "查看策略并批准",
    });
  }

  /* ② 今日到店准备 */
  const appts = sqlite.prepare(`
    SELECT a.id, a.member_id, a.service_name, a.staff_name, m.name AS member_name,
      (SELECT value FROM user_memories um WHERE um.user_id = a.member_id AND um.attribute='喜欢' AND um.status='active' ORDER BY um.updated_at DESC LIMIT 1) AS fav
    FROM appointments a LEFT JOIN members m ON m.id = a.member_id
    WHERE a.store_id = ? AND a.status = 'confirmed' AND a.scheduled_for LIKE '${todayStr()}%'
    ORDER BY a.created_at DESC
  `).all(storeId) as Row[];
  for (const a of appts) {
    items.push({
      dedupeKey: `appointment_today:${a.id}`,
      type: "appointment_today",
      title: `今天 ${a.member_name} 预约到店做「${a.service_name}」`,
      reason: a.fav
        ? `她喜欢:${a.fav}——提前备好对应色板,再备杯她常点的茶`
        : "首次到店,记得先聊偏好再推项目",
      memberId: a.member_id as string,
      memberName: a.member_name as string,
      payload: { appointmentId: a.id, service: a.service_name, staff: a.staff_name },
      suggestedAction: "备好色板与饮品,到店后自然聊起她的偏好",
    });
  }

  /* ③ 触达 7 天无回复 → 人工跟进 */
  const noReply = sqlite.prepare(`
    SELECT o.id, o.member_id, o.body, m.name AS member_name
    FROM outreach_messages o JOIN members m ON m.id = o.member_id JOIN tasks t ON t.id = o.task_id
    WHERE t.store_id = ? AND o.status = 'sent'
      AND o.created_at < datetime('now','-7 day')
      AND NOT EXISTS (SELECT 1 FROM outreach_messages o2 WHERE o2.member_id = o.member_id AND o2.created_at > o.created_at)
    ORDER BY o.sent_at DESC LIMIT 5
  `).all(storeId) as Row[];
  for (const o of noReply) {
    items.push({
      dedupeKey: `no_reply_followup:${o.id}`,
      type: "no_reply_followup",
      title: `${o.member_name} 收到消息 7 天未回复`,
      reason: "AI 模板消息聊不动了——建议你亲自发一条语音或打个电话,熟人的声音比任何文案都管用",
      memberId: o.member_id as string,
      memberName: o.member_name as string,
      payload: { messageId: o.id, lastMessage: o.body },
      suggestedAction: "亲自语音回访,聊近况不推项目",
    });
  }

  /* ④ 转人工会话 */
  const stuck = sqlite.prepare(`
    SELECT c.id, c.member_id, m.name AS member_name,
      (SELECT content FROM conversation_messages cm WHERE cm.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_msg
    FROM conversations c LEFT JOIN members m ON m.id = c.member_id
    WHERE c.store_id = ? AND c.status = 'needs_human'
    ORDER BY c.created_at DESC
  `).all(storeId) as Row[];
  for (const c of stuck) {
    items.push({
      dedupeKey: `stuck_conversation:${c.id}`,
      type: "stuck_conversation",
      title: `${c.member_name ?? "访客"} 的会话需要你回复`,
      reason: `AI 已暂停推销,等你亲自接手。最后一条:「${String(c.last_msg ?? "").slice(0, 40)}」`,
      memberId: c.member_id as string | undefined,
      memberName: c.member_name as string | undefined,
      payload: { conversationId: c.id },
      suggestedAction: "去会话接管页亲自回复",
    });
  }

  /* ④b 半自动企微:AI 已起草,等商家真实发送 */
  const manual = sqlite.prepare(`
    SELECT o.id, o.body, o.member_id, m.name AS member_name
    FROM outreach_messages o JOIN members m ON m.id = o.member_id
    JOIN tasks t ON t.id = o.task_id
    WHERE t.store_id = ? AND o.status = 'awaiting_send'
    ORDER BY o.created_at DESC LIMIT 8
  `).all(storeId) as Row[];
  for (const o of manual) {
    items.push({
      dedupeKey: `manual_send:${o.id}`,
      type: "manual_send",
      title: `把这条消息发给 ${o.member_name}`,
      reason: "AI 已按她的偏好起草,复制到企微粘贴发送即可",
      memberId: o.member_id as string,
      memberName: o.member_name as string,
      payload: { messageId: o.id, body: o.body },
      suggestedAction: "复制文案 → 企微粘贴发送",
    });
  }

  /* ⑤ 预算拦截 → 商家决策 */
  const budgetBlocked = sqlite.prepare(`
    SELECT o.id, o.member_id, o.failure_reason, m.name AS member_name, t.id AS task_id, t.title
    FROM outreach_messages o
    JOIN members m ON m.id = o.member_id
    JOIN tasks t ON t.id = o.task_id
    WHERE t.store_id = ? AND o.status = 'failed' AND o.failure_reason LIKE '%预算超限%'
    AND o.created_at > datetime('now','-3 day')
    ORDER BY o.created_at DESC LIMIT 3
  `).all(storeId) as Row[];
  for (const o of budgetBlocked) {
    items.push({
      dedupeKey: `budget_blocked:${o.id}`,
      type: "budget_blocked",
      title: `「${o.member_name}」的唤醒消息因预算被拦`,
      reason: `${o.failure_reason}——提额后重新发送,或放弃这位`,
      memberId: o.member_id as string,
      memberName: o.member_name as string,
      payload: { messageId: o.id, taskId: o.task_id },
      suggestedAction: "提额重发 / 放弃",
    });
  }

  return items;
}

/** 过滤掉商家已处理过的(当日或永久) */
export function filterProcessed(items: ActionItem[], storeId: string): ActionItem[] {
  const acted = sqlite.prepare(
    "SELECT dedupe_key FROM merchant_actions WHERE store_id = ? AND status IN ('done','skipped')"
  ).all(storeId) as Array<{ dedupe_key: string }>;
  const actedSet = new Set(acted.map((a) => a.dedupe_key));
  return items.filter((i) => !actedSet.has(i.dedupeKey));
}

/** 商家处理行动项(完成/跳过,留痕) */
export function recordMerchantAction(opts: {
  storeId: string; actedBy: string; dedupeKey: string; type: string;
  title: string; reason?: string; memberId?: string; payload?: Record<string, unknown>;
  status: "done" | "skipped";
}) {
  const existing = sqlite.prepare(
    "SELECT id FROM merchant_actions WHERE dedupe_key = ?"
  ).get(opts.dedupeKey) as { id: string } | undefined;
  if (existing) return { ok: true, already: true };
  db.insert(merchantActions).values({
    id: `ma_${Math.random().toString(36).slice(2, 12)}`,
    storeId: opts.storeId, dedupeKey: opts.dedupeKey,
    type: opts.type, title: opts.title, reason: opts.reason ?? null,
    memberId: opts.memberId ?? null,
    payloadJson: JSON.stringify(opts.payload ?? {}),
    status: opts.status, actedBy: opts.actedBy,
    createdAt: nowIso(), actedAt: nowIso(),
  }).run();
  return { ok: true, already: false };
}
