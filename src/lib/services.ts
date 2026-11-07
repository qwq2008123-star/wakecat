import { db, sqlite } from "./db/client";
import {
  tasks, taskLogs, strategies, outreachMessages, memberMemories,
  consumptionRecords, financeEntries, appointments, couponGrants,
  memberCats, agentConfigs, auditLog, messageEvents as messageEventsTable,
  orders as ordersTable, orderItems as orderItemsTable, storeServices,
} from "./db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { HttpError, SessionUser } from "./session";
import { getLlmConfig, LlmConfig } from "./llm";
import { sendMessage } from "./channels";
import { catStateOf } from "./queries";

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const memNameSafe = (memberId: string) =>
  (sqlite.prepare("SELECT name FROM members WHERE id = ?").get(memberId) as { name: string } | undefined)?.name ?? "会员";

/** Agent / API 层通用的最小用户上下文 */
export type SessionUserLike = { storeId: string; name: string; role: string };

export async function audit(actor: string, action: string, target: string, meta: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({
    id: rid("audit"), actor, action, target,
    metaJson: JSON.stringify(meta).slice(0, 2000), createdAt: now(),
  });
}

export async function appendLog(opts: {
  taskId: string; agent: string; step: string; message?: string;
  toolName?: string; toolInput?: unknown; toolOutput?: unknown; status?: string;
}) {
  await db.insert(taskLogs).values({
    id: rid("log"), taskId: opts.taskId, agent: opts.agent, step: opts.step,
    toolName: opts.toolName ?? null,
    toolInputJson: opts.toolInput ? JSON.stringify(opts.toolInput).slice(0, 4000) : null,
    toolOutputJson: opts.toolOutput ? JSON.stringify(opts.toolOutput).slice(0, 6000) : null,
    message: opts.message ?? null,
    status: opts.status ?? "ok", createdAt: now(),
  });
}

/* ---------- 任务 ---------- */
export async function createGoalTask(storeId: string, goal: string) {
  const id = rid("task");
  await db.insert(tasks).values({
    id, storeId, type: "awaken_campaign", title: goal.slice(0, 24),
    goal, status: "draft", engine: "rules",
    payloadJson: "{}", resultJson: "{}", costEstimate: 0,
    createdAt: now(), updatedAt: now(),
  });
  return id;
}

export async function updateTask(taskId: string, patch: Partial<typeof tasks.$inferInsert>) {
  await db.update(tasks).set({ ...patch, updatedAt: now() }).where(eq(tasks.id, taskId));
}

export async function getTask(taskId: string) {
  return (await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1))[0];
}

/** 商家审批:仅 owner,且必须是 pending_approval 状态;全程审计 */
export async function decideTask(user: SessionUser, taskId: string, approve: boolean) {
  const t = await getTask(taskId);
  if (!t || t.storeId !== user.storeId) throw new HttpError(404, "任务不存在");
  if (t.status !== "pending_approval") throw new HttpError(400, `当前状态为 ${t.status},不可审批`);
  await db.update(tasks).set({
    status: approve ? "approved" : "rejected",
    decidedBy: user.name, decidedAt: now(), updatedAt: now(),
  }).where(eq(tasks.id, taskId));
  await audit(user.name, approve ? "task.approve" : "task.reject", taskId, { title: t.title });
  await appendLog({
    taskId, agent: "喵老板",
    step: approve ? "商家批准任务,授权销售喵执行触达" : "商家驳回任务",
    message: approve ? `${user.name} 批准了该任务,触达与发券已获授权` : `${user.name} 驳回了该任务`,
  });
}

/* ---------- 触达(L3:三道业务闸门 + 幂等) ---------- */
export async function queueAndSend(user: SessionUserLike, taskId: string, strategyId: string) {
  // 闸门 0:任务必须已被 owner 批准
  const t = await getTask(taskId);
  if (!t || t.storeId !== user.storeId) throw new HttpError(404, "任务不存在");
  if (t.status !== "approved" && t.status !== "running") {
    throw new HttpError(403, `任务状态为 ${t.status}:未经商家批准,禁止触达会员`);
  }
  await db.update(tasks).set({ status: "running", updatedAt: now() }).where(eq(tasks.id, taskId));
  const st = (await db.select().from(strategies).where(eq(strategies.id, strategyId)).limit(1))[0];
  if (!st || st.taskId !== taskId) throw new HttpError(404, "策略不存在");

  // 幂等:同一任务+策略只允许一条消息
  const dup = sqlite.prepare(
    "SELECT id FROM outreach_messages WHERE task_id = ? AND strategy_id = ?"
  ).get(taskId, strategyId) as { id: string } | undefined;
  if (dup) {
    await appendLog({
      taskId, agent: "销售喵", step: "幂等拦截", status: "error",
      message: `该策略已触达过(消息 ${dup.id}),跳过重复发送`,
    });
    return { msgId: dup.id, ok: false, failureReason: "重复触达被幂等拦截" };
  }

  const gateReject = async (gate: string, reason: string) => {
    // 业务规则拦截:创建失败记录(诚实展示),审计留痕,调用方跳过继续
    const msgId = rid("om");
    await db.insert(outreachMessages).values({
      id: msgId, taskId, strategyId, memberId: st.memberId,
      channel: st.channel, body: st.content, status: "failed",
      failureReason: reason, engine: t.engine, createdAt: now(),
    });
    await db.insert(messageEventsTable).values({
      id: rid("me"), messageId: msgId, eventType: "blocked",
      metaJson: JSON.stringify({ gate, reason }), occurredAt: now(),
    });
    await audit(user.name, `outreach.blocked_${gate}`, st.memberId, { taskId, reason });
    await appendLog({
      taskId, agent: "销售喵", step: `触达被业务规则拦截(${gate})`, status: "error",
      toolName: "policy_gate", toolOutput: { gate, reason },
      message: reason,
    });
    return { msgId, ok: false as const, failureReason: reason };
  };

  // 闸门 1(L3):客户授权账本——退订立即生效,不做任何"应该不介意"判断
  const consent = sqlite.prepare(`
    SELECT status, source FROM customer_consents
    WHERE member_id = ? AND purpose='marketing' ORDER BY updated_at DESC LIMIT 1
  `).get(st.memberId) as { status: string; source: string } | undefined;
  if (consent?.status === "unsubscribed") {
    return await gateReject("consent", `已退订营销消息(来源:${consent.source}),授权账本硬拦截`);
  }

  // 闸门 2(L3):触达频次——14 天内已发 ≥2 条则冷却
  const recent = sqlite.prepare(`
    SELECT COUNT(*) as c FROM outreach_messages
    WHERE member_id = ? AND status IN ('sent','replied')
      AND created_at > datetime('now','-14 day')
  `).get(st.memberId) as { c: number };
  if (recent.c >= 2) {
    return await gateReject("frequency", `触达频次超限:14 天内已触达 ${recent.c} 次,进入冷却`);
  }

  // 闸门 3(L3):任务预算(若商家目标里声明了 budget)
  const payload = JSON.parse(t.payloadJson || "{}") as { budget?: number };
  if (typeof payload.budget === "number") {
    const spent = sqlite.prepare(
      "SELECT COALESCE(SUM(amount),0) as s FROM finance_entries WHERE task_id = ? AND type='cost'"
    ).get(taskId) as { s: number };
    if (spent.s + st.predictedCost > payload.budget) {
      return await gateReject("budget", `预算超限:已花 ¥${Math.round(spent.s)},本条需 ¥${st.predictedCost},超出预算 ¥${payload.budget}`);
    }
  }

  const msgId = rid("om");
  await db.insert(outreachMessages).values({
    id: msgId, taskId, strategyId, memberId: st.memberId,
    channel: st.channel, body: st.content, status: "queued",
    engine: t.engine, createdAt: now(),
  });
  await appendLog({
    taskId, agent: "销售喵", step: "执行触达", toolName: "queue_message",
    toolInput: { strategyId, memberId: st.memberId }, toolOutput: { msgId },
    message: "闸门通过(授权/频次/预算),消息进入发送队列",
  });

  // 半自动企微通道:AI 起草 → 商家在行动清单里复制到企微真实发送 → 回来点「已发送」
  if (st.channel === 'wecom-manual') {
    await db.update(outreachMessages).set({ status: 'awaiting_send' }).where(eq(outreachMessages.id, msgId));
    await appendLog({
      taskId, agent: "销售喵", step: "草稿就绪", toolName: "draft_for_manual_send",
      message: `消息已起草,等待商家复制到企微真实发送给 ${memNameSafe(st.memberId)}`,
    });
    return { msgId, ok: false as const, failureReason: "awaiting_manual_send", manual: true, body: st.content, memberName: memNameSafe(st.memberId) };
  }

  // 渠道真实调用(演示通道;失败如实记录)
  const mem = sqlite.prepare("SELECT name, phone_masked FROM members WHERE id = ?").get(st.memberId) as { name: string; phone_masked: string };
  const cfg = await getLlmConfig(user.storeId);
  const send = await sendMessage({
    channel: st.channel, memberName: mem.name, memberPhoneMasked: mem.phone_masked,
    body: st.content, mockFailRate: cfg.mockFailRate,
  });
  if (send.ok) {
    await db.update(outreachMessages).set({
      status: "sent", externalId: send.externalId, sentAt: now(),
    }).where(eq(outreachMessages.id, msgId));
    await db.insert(messageEventsTable).values({
      id: rid("me"), messageId: msgId, eventType: "sent",
      metaJson: JSON.stringify({ channel: st.channel, externalId: send.externalId }), occurredAt: now(),
    });
    await db.insert(financeEntries).values({
      id: rid("fe"), storeId: user.storeId, taskId, strategyId,
      type: "cost",
      amount: st.predictedCost, note: `触达成本(${st.kind})`, occurredAt: now(),
    });
    await appendLog({
      taskId, agent: "销售喵", step: "触达成功", toolName: "send_message",
      toolOutput: send, message: `已通过 ${st.channel} 送达 ${mem.name}`,
    });
  } else {
    await db.update(outreachMessages).set({
      status: "failed", failureReason: send.failureReason,
    }).where(eq(outreachMessages.id, msgId));
    await db.insert(messageEventsTable).values({
      id: rid("me"), messageId: msgId, eventType: "failed",
      metaJson: JSON.stringify({ reason: send.failureReason }), occurredAt: now(),
    });
    await appendLog({
      taskId, agent: "销售喵", step: "触达失败", toolName: "send_message",
      status: "error", toolOutput: send,
      message: `发送失败:${send.failureReason}`,
    });
  }
  return { msgId, ...send };
}

/** 模拟会员回复(演示用;规则解析意图,不假装是真实意图识别) */
export async function simulateReply(user: SessionUser, messageId: string, intent: "accept" | "price" | "decline", replyText?: string) {
  const o = (await db.select().from(outreachMessages).where(eq(outreachMessages.id, messageId)).limit(1))[0];
  if (!o) throw new HttpError(404, "消息不存在");
  const t = await getTask(o.taskId);
  if (!t || t.storeId !== user.storeId) throw new HttpError(404, "消息不存在");
  if (o.status !== "sent") throw new HttpError(400, `消息状态为 ${o.status},无法收到回复`);
  const text = replyText ?? ({ accept: "好呀,这周六下午有空,来做猫眼款~", price: "多少钱呀?有活动吗?", decline: "最近有点忙,过阵子再说啦" } as const)[intent];
  await db.update(outreachMessages).set({
    status: "replied", replyIntent: intent, replyText: text, repliedAt: now(),
  }).where(eq(outreachMessages.id, messageId));
  if (intent === "accept") {
    await db.insert(appointments).values({
      id: rid("ap"), storeId: user.storeId, taskId: o.taskId, memberId: o.memberId,
      proposedAt: now(), status: "confirmed", createdAt: now(),
    });
  }
  await appendLog({
    taskId: o.taskId, agent: "销售喵", step: "会员回复", toolName: "parse_reply_intent",
    toolInput: { text }, toolOutput: { intent, rule: "关键词规则解析(演示)" },
    message: `${intent === "accept" ? "有预约意向,已建预约单" : intent === "price" ? "询问价格,建议跟进优惠" : "暂无意向"}`,
  });
  return { intent, text };
}

/** 会员到店:真实消费流水 + 收入入账 + 猫咪喂食升级 + 新记忆。
 *  未显式传 taskId 时,自动挂到该会员最近一条来自任务的确认预约上(演示闭环)。 */
export async function recordVisit(user: SessionUser, memberId: string, opts: { service: string; amount: number; taskId?: string }) {
  // 会员必须真实存在且属于本店
  const mem = sqlite.prepare("SELECT id FROM members WHERE id = ? AND store_id = ?").get(memberId, user.storeId);
  if (!mem) throw new HttpError(404, "会员不存在");
  let taskId = opts.taskId;
  let strategyId: string | null = null;
  if (!taskId) {
    const ap = sqlite.prepare(`
      SELECT task_id FROM appointments
      WHERE member_id = ? AND status = 'confirmed' AND task_id IS NOT NULL
      ORDER BY created_at DESC LIMIT 1
    `).get(memberId) as { task_id: string } | undefined;
    if (ap) taskId = ap.task_id;
  }
  if (taskId) {
    const s = sqlite.prepare(`
      SELECT id FROM strategies WHERE task_id = ? AND member_id = ? LIMIT 1
    `).get(taskId, memberId) as { id: string } | undefined;
    strategyId = s?.id ?? null;
  }
  const recId = rid("cr");
  await db.insert(consumptionRecords).values({
    id: recId, storeId: user.storeId, memberId,
    service: opts.service, amount: opts.amount,
    artist: "小林", note: taskId ? `由任务唤回` : null, occurredAt: now(),
  });
  if (taskId) {
    const t = await getTask(taskId);
    if (t && t.storeId === user.storeId) {
      await db.insert(financeEntries).values({
        id: rid("fe"), storeId: user.storeId, taskId, strategyId,
        type: "revenue", amount: opts.amount, note: `唤回到店消费:${opts.service}`, occurredAt: now(),
      });
      await db.update(appointments).set({ status: "visited" })
        .where(and(eq(appointments.taskId, taskId), eq(appointments.memberId, memberId)));
    }
  }
  // 真实订单(收据层):订单 + 明细,成本来自服务目录
  const orderId = rid("ord");
  const svc = sqlite.prepare(
    "SELECT id, cost FROM store_services WHERE store_id = ? AND name LIKE ? LIMIT 1"
  ).get(user.storeId, `%${opts.service.slice(0, 2)}%`) as { id: string; cost: number } | undefined;
  await db.insert(ordersTable).values({
    id: orderId, storeId: user.storeId, memberId,
    appointmentId: null, taskId: taskId ?? null,
    attribution: taskId ? "ai_recall" : "natural",
    totalAmount: opts.amount, totalCost: svc?.cost ?? 0,
    status: "completed", occurredAt: now(),
  }).run();
  await db.insert(orderItemsTable).values({
    id: rid("oi"), orderId, serviceId: svc?.id ?? null,
    serviceName: opts.service, price: opts.amount, quantity: 1,
  }).run();
  // 猫咪喂食
  const cat = (await db.select().from(memberCats).where(eq(memberCats.memberId, memberId)).limit(1))[0];
  if (cat) {
    const xp = cat.xp + 100;
    const lv = Math.min(9, Math.max(1, Math.floor(xp / 100)));
    const decorations = JSON.parse(cat.decorationsJson || "[]");
    if (lv >= 6 && !decorations.includes("美甲小皇冠")) decorations.push("美甲小皇冠");
    if (lv >= 8 && !decorations.includes("钻石铃铛")) decorations.push("钻石铃铛");
    await db.update(memberCats).set({ xp, lv, decorationsJson: JSON.stringify(decorations), updatedAt: now() })
      .where(eq(memberCats.memberId, memberId));
  }
  // 生成一条有来源的新记忆
  await db.insert(memberMemories).values({
    id: rid("mm"), memberId, kind: "event",
    content: `到店做了「${opts.service}」,消费 ¥${opts.amount}`,
    sourceType: "order", sourceRef: `consumption_record:${recId}`,
    confidence: 1, createdAt: now(), createdByAgent: null,
  });
  await audit(user.name, "member.visit", memberId, opts);
  return { recId };
}

/** 发放优惠券(仅已批准任务内) */
export async function grantCoupon(user: SessionUser, taskId: string, memberId: string, name: string, value: number) {
  const t = await getTask(taskId);
  if (!t || t.storeId !== user.storeId) throw new HttpError(404, "任务不存在");
  if (t.status !== "approved" && t.status !== "running") {
    throw new HttpError(403, `任务状态为 ${t.status}:未经商家批准,禁止发放优惠券`);
  }
  const id = rid("cg");
  await db.insert(couponGrants).values({
    id, storeId: user.storeId, taskId, memberId, name, value, status: "granted", grantedAt: now(),
  });
  await db.insert(financeEntries).values({
    id: rid("fe"), storeId: user.storeId, taskId, type: "cost",
    amount: value, note: `优惠券成本:${name}`, occurredAt: now(),
  });
  await audit(user.name, "coupon.grant", `${taskId}/${memberId}`, { name, value });
  return id;
}

/* ---------- 设置 ---------- */
export async function updateAgentConfig(user: SessionUser, patch: {
  apiKey?: string | null; model?: string; engineMode?: string; mockFailRate?: number; baseUrl?: string;
}) {
  if (user.role !== "owner") throw new HttpError(403, "仅老板可修改设置");
  const rows = await db.select().from(agentConfigs).where(eq(agentConfigs.storeId, user.storeId)).limit(1);
  const cur = rows[0];
  if (!cur) throw new HttpError(404, "配置不存在");
  await db.update(agentConfigs).set({
    apiKey: patch.apiKey !== undefined ? patch.apiKey : cur.apiKey,
    model: patch.model ?? cur.model,
    baseUrl: patch.baseUrl ?? cur.baseUrl,
    engineMode: patch.engineMode ?? cur.engineMode,
    mockFailRate: patch.mockFailRate ?? cur.mockFailRate,
    updatedAt: now(),
  }).where(eq(agentConfigs.id, cur.id));
  await audit(user.name, "settings.update", cur.id, {
    model: patch.model, engineMode: patch.engineMode,
    apiKeyChanged: patch.apiKey !== undefined && patch.apiKey !== null,
  });
}

export async function getLlmConfigCached(storeId: string): Promise<LlmConfig> {
  return getLlmConfig(storeId);
}

/** 会员猫状态(单查) */
export function stateOfMember(m: { lastVisit: string | null; tags: string[] }) {
  const days = m.lastVisit ? Math.floor((Date.now() - new Date(m.lastVisit).getTime()) / 86400_000) : null;
  return catStateOf(days, m.tags);
}
