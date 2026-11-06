import { db, sqlite } from "../db/client";
import {
  conversations, conversationMessages, appointments, customerConsents,
} from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { MemberCatView } from "@/mock-data/types";
import { getCatalog, recommendServices, quoteService, CatalogService } from "./recommendation-engine";

/* ============================================================
   对话引擎:销售喵的客户侧状态机(7 阶段)
   接触 → 兴趣 → 询价 → 意向 → 确认 → 到店 → 售后
   阶段由上一条出站消息的 meta 持久化;所有价格/排班来自真实表。
   本版为可解释规则引擎(演示),接入 GLM 后同接口换大模型解析。
   ============================================================ */

export type ChatCard =
  | { type: "services"; title: string; items: CatalogService[] }
  | { type: "slots"; items: { date: string; weekday: string; staff: string; time: string }[] }
  | { type: "appointment"; appointmentId: string; service: string; when: string; staff: string }
  | { type: "unsubscribed" }
  | { type: "transferred" };

export interface ChatReply {
  text: string;
  cards: ChatCard[];
  quickReplies: string[];
  stage: string;
}

type Row = Record<string, unknown>;
const rid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

interface PendingContext {
  action?: "choose_service" | "choose_slot";
  services?: CatalogService[];
  chosen?: CatalogService;
  slots?: { date: string; weekday: string; staff: string; time: string }[];
}

/* ---------- 工具:真实排班查询 ---------- */
function getSlots(storeId: string, weekdayFilter?: string): { date: string; weekday: string; staff: string; time: string }[] {
  const rows = sqlite.prepare(`
    SELECT work_date, staff_name, start_at, end_at FROM store_staff_schedules
    WHERE store_id = ? AND work_date >= date('now') ORDER BY work_date ASC, staff_name ASC LIMIT 40
  `).all(storeId) as Row[];
  const seen = new Map<string, { date: string; weekday: string; staff: string; time: string }>();
  for (const r of rows) {
    const date = r.work_date as string;
    const wd = WEEKDAYS[new Date(date + "T12:00:00").getDay()];
    if (weekdayFilter && !wd.includes(weekdayFilter)) continue;
    const key = `${date}`;
    if (!seen.has(key)) {
      seen.set(key, { date, weekday: wd, staff: r.staff_name as string, time: `${r.start_at}-${r.end_at}` });
    }
  }
  return [...seen.values()].slice(0, 6);
}

/* ---------- 会话与上下文 ---------- */
function getOrCreateConversation(storeId: string, identityId: string, channel: string): string {
  const existing = sqlite.prepare(
    "SELECT id FROM conversations WHERE identity_id = ? AND status='open' ORDER BY created_at DESC LIMIT 1"
  ).get(identityId) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = rid("conv");
  db.insert(conversations).values({
    id, storeId, identityId, channel, memberId: null, status: "open", createdAt: nowIso(),
  }).run();
  return id;
}

function loadPending(conversationId: string): PendingContext {
  const row = sqlite.prepare(`
    SELECT meta_json FROM conversation_messages
    WHERE conversation_id = ? AND direction='out' ORDER BY created_at DESC LIMIT 1
  `).get(conversationId) as { meta_json: string } | undefined;
  try {
    const meta = JSON.parse(row?.meta_json || "{}");
    return meta.pending ?? {};
  } catch { return {}; }
}

function saveOut(conversationId: string, reply: ChatReply, pending: PendingContext) {
  db.insert(conversationMessages).values({
    id: rid("cm"), conversationId, direction: "out", content: reply.text,
    metaJson: JSON.stringify({ stage: reply.stage, pending, cards: reply.cards.map((c) => c.type) }),
    createdAt: nowIso(),
  }).run();
}

/* ---------- 真实预约创建(L2:规则校验后自动,入任务墙) ---------- */
function createAppointment(opts: {
  storeId: string; memberId: string | null; service: string; staff: string; when: string; source: string;
}): string {
  const id = rid("ap");
  db.insert(appointments).values({
    id, storeId: opts.storeId, memberId: opts.memberId,
    serviceName: opts.service, staffName: opts.staff,
    scheduledFor: opts.when, source: opts.source,
    proposedAt: nowIso(), status: "confirmed", createdAt: nowIso(),
  }).run();
  return id;
}

/* ---------- 意图解析 + 状态机 ---------- */
export function handleCustomerMessage(opts: {
  storeId: string;
  identityId: string;
  memberId: string | null;
  member: MemberCatView | null;
  message: string;
}): ChatReply {
  const { storeId, identityId, member, message } = opts;
  const text = message.trim();
  const convId = getOrCreateConversation(storeId, identityId, "h5");
  db.insert(conversationMessages).values({
    id: rid("cm"), conversationId: convId, direction: "in", content: text, metaJson: "{}", createdAt: nowIso(),
  }).run();

  const pending = loadPending(convId);
  const bound = !!member;
  const greetName = member ? `主人 ${member.name}` : "主人";
  const baseQuick = ["有什么新品?", "多少钱?", "我想预约", "查我的会员权益"];

  // ① 退订:硬拦截,立即生效
  if (/(不要联系|退订|别再发|骚扰)/.test(text)) {
    if (member) {
      const existing = sqlite.prepare(
        "SELECT id FROM customer_consents WHERE member_id = ? AND purpose='marketing'"
      ).get(member.id) as { id: string } | undefined;
      if (existing) {
        db.update(customerConsents).set({ status: "unsubscribed", source: "客户在 H5 主动退订", updatedAt: nowIso() })
          .where(eq(customerConsents.id, existing.id)).run();
      } else {
        db.insert(customerConsents).values({
          id: rid("cons"), storeId, memberId: member.id, channel: "any", purpose: "marketing",
          status: "unsubscribed", source: "客户在 H5 主动退订", updatedAt: nowIso(),
        }).run();
      }
    }
    const reply: ChatReply = {
      text: "好的,已为你关闭营销消息,立即生效。以后店铺的重大服务通知(如预约变更)仍会正常送达。想再收到优惠,随时跟我说一声就好。",
      cards: [{ type: "unsubscribed" }], quickReplies: ["咨询款式", "我想预约"], stage: "aftercare",
    };
    saveOut(convId, reply, {});
    return reply;
  }

  // ② 不满意/投诉 → 转人工,暂停营销
  if (/(不满意|投诉|差评|态度)/.test(text)) {
    const reply: ChatReply = {
      text: "真的非常抱歉,给你带来了不好的体验。我已经把情况记下来,并通知店员尽快联系你处理。你的这次对话我已暂停一切推销。",
      cards: [{ type: "transferred" }], quickReplies: [], stage: "aftercare",
    };
    saveOut(convId, reply, {});
    return reply;
  }

  // ③ 上下文:正在选服务
  if (pending.action === "choose_service" && pending.services) {
    const idx = text.match(/(\d)/)?.[1];
    const chosen = pending.services[Number(idx) - 1]
      ?? pending.services.find((s) => text.includes(s.name.slice(0, 2)));
    if (chosen) {
      const slots = getSlots(storeId);
      const reply: ChatReply = {
        text: `好眼光!「${chosen.name}」¥${chosen.price} · 约 ${chosen.durationMin} 分钟。最近的预约时段如下,选一个方便的~`,
        cards: [{ type: "slots", items: slots }],
        quickReplies: slots.slice(0, 3).map((s) => `${s.weekday}(${s.date.slice(5)})`),
        stage: "booking_intent",
      };
      saveOut(convId, reply, { action: "choose_slot", chosen, slots });
      return reply;
    }
  }

  // ④ 上下文:正在选时段 → 真实预约落库
  if (pending.action === "choose_slot" && pending.chosen && pending.slots) {
    const idx = text.match(/(\d)/)?.[1];
    const wdMatch = WEEKDAYS.find((w) => text.includes(w.slice(1)));
    const slot = (Number(idx) ? pending.slots[Number(idx) - 1] : undefined)
      ?? pending.slots.find((s) => (wdMatch ? s.weekday === wdMatch : false));
    if (slot) {
      const apptId = createAppointment({
        storeId, memberId: member?.id ?? null,
        service: pending.chosen.name, staff: slot.staff,
        when: `${slot.date}(${slot.weekday}) ${slot.time}`, source: "h5",
      });
      const reply: ChatReply = {
        text: `预约成功!🐱\n\n${pending.chosen.name} · ${slot.date}(${slot.weekday}) ${slot.time}\n美甲师:${slot.staff}\n\n到店报手机尾号就行,我会提前一天提醒你。期待呀~`,
        cards: [{ type: "appointment", appointmentId: apptId, service: pending.chosen.name, when: `${slot.date}(${slot.weekday}) ${slot.time}`, staff: slot.staff }],
        quickReplies: ["查我的会员权益", "改时间", "就这样"],
        stage: "booked",
      };
      saveOut(convId, reply, {});
      return reply;
    }
  }

  // ⑤ 意图:预约(直接给排班)
  if (/(预约|有空|时间|几点|排班)/.test(text)) {
    const slots = getSlots(storeId, /(周[一二三四五六日])/.exec(text)?.[1]?.replace("周", "周"));
    const reply: ChatReply = {
      text: member
        ? `${greetName},最近的可预约时段如下(都来自店里真实排班)。选定后我直接帮你约上~`
        : "最近的可预约时段如下。绑定会员后我还能记住你的偏好哦~",
      cards: [{ type: "slots", items: slots }],
      quickReplies: slots.slice(0, 3).map((s) => `${s.weekday}(${s.date.slice(5)})`),
      stage: "booking_intent",
    };
    saveOut(convId, reply, { action: "choose_slot", chosen: undefined, slots });
    // 选时段前需要先定服务:给默认热门服务候选
    if (!pending.chosen) {
      const rec = recommendServices({ storeId, favoriteService: member?.favoriteService ?? null, limit: 1 });
      if (rec[0]) {
        const follow: ChatReply = {
          text: `对了,要做「${rec[0].service.name}」(¥${rec[0].service.price} · ${rec[0].service.durationMin} 分钟)吗?回「1」确认,或告诉我你想做的项目~`,
          cards: [], quickReplies: ["1", "看看其他款式"], stage: "booking_service",
        };
        saveOut(convId, follow, { action: "choose_service", services: [rec[0].service, ...recommendServices({ storeId, limit: 3 }).map((r) => r.service)] });
        return { ...follow, text: reply.text, cards: reply.cards, quickReplies: [...reply.quickReplies, "确认做" + rec[0].service.name] };
      }
    }
    return reply;
  }

  // ⑥ 意图:优惠/权益(查真实授权,不编造)
  if (/(优惠|折扣|便宜|权益|会员卡)/.test(text)) {
    let body = "店里目前没有进行中的公开折扣活动,我不会为了成交乱承诺。";
    if (member) {
      const unused = sqlite.prepare(
        "SELECT name, value FROM coupon_grants WHERE member_id = ? AND status='granted' LIMIT 2"
      ).all(member.id) as Row[];
      body = unused.length
        ? `你有 ${unused.length} 张未使用的权益:${unused.map((c) => `${c.name}(¥${c.value})`).join("、")},预约时告诉我就自动抵扣~`
        : `你的会员等级是 ${member.level}。当前没有可用的券,但你的偏好我都记着,有合适的新品我会第一时间告诉你。`;
    } else {
      body += "绑定会员身份后,我可以帮你查询专属权益(右上角「绑定会员」)。";
    }
    const reply: ChatReply = { text: body, cards: [], quickReplies: baseQuick, stage: "quote" };
    saveOut(convId, reply, {});
    return reply;
  }

  // ⑦ 意图:询价(真实价格 + 组合)
  if (/(多少钱|价格|费用|贵)/.test(text)) {
    const kw = /(猫眼|法式|渐变|极光|碎钻|手绘|护理|卸甲|跳色|高级)/.exec(text)?.[1] ?? member?.favoriteService?.slice(0, 2) ?? "";
    const q = kw ? quoteService(storeId, kw) : { found: false, items: getCatalog(storeId).slice(0, 4), combos: undefined };
    const reply: ChatReply = {
      text: q.found
        ? "这是店里的真实价格,童叟无欺:"
        : "这些是我们当前在售的项目和价格,你看看有没有喜欢的:",
      cards: [{ type: "services", title: "真实价目", items: q.items }],
      quickReplies: ["我想预约", "有什么新品?", "预算 200 以内有什么?"],
      stage: "quote",
    };
    saveOut(convId, reply, {});
    return reply;
  }

  // ⑧ 意图:新品/推荐/预算
  if (/(新品|推荐|款式|预算|秋天|做什么|适合)/.test(text)) {
    const budget = Number(/(\d{2,4})\s*元/.exec(text)?.[1] ?? NaN);
    const recs = recommendServices({
      storeId,
      favoriteService: member?.favoriteService ?? null,
      budget: Number.isFinite(budget) ? budget : undefined,
      wantNew: /新品/.test(text) || /秋天/.test(text),
      limit: 3,
    });
    const reply: ChatReply = {
      text: budget
        ? `收到!预算 ${budget} 元以内,我从店里真实在售的项目中挑了这些:`
        : "先从店里真实在售的项目中帮你挑了几个:",
      cards: [{ type: "services", title: budget ? `预算 ¥${budget} 以内` : "为你挑选", items: recs.map((r) => r.service) }],
      quickReplies: recs.map((r) => `做「${r.service.name}」`).concat(["我想预约"]),
      stage: "interest",
    };
    saveOut(convId, reply, { action: "choose_service", services: recs.map((r) => r.service) });
    return reply;
  }

  // ⑨ 兜底:欢迎 + 能力说明
  const reply: ChatReply = {
    text: `${greetName}好呀~我是这家店的醒醒喵 🐱\n可以帮你:挑款式、查真实价格、看预约时段、绑定会员查权益。直接说需求就行!`,
    cards: [],
    quickReplies: baseQuick,
    stage: "greeting",
  };
  saveOut(convId, reply, {});
  return reply;
}
