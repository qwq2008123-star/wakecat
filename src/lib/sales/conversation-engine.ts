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

/* ---------- 工具:日期 / 星期 / 序号解析 ---------- */
const pad2 = (n: number) => String(n).padStart(2, "0");
/** 店铺本地日期(排班表存的是本地日期,不能用 UTC 的 date('now')) */
function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 「今天/明天/后天」或「11-07」「11月7日」→ YYYY-MM-DD */
function parseDate(text: string): string | undefined {
  if (/今天/.test(text)) return localDate(0);
  if (/明天/.test(text)) return localDate(1);
  if (/后天/.test(text)) return localDate(2);
  const m = /(\d{1,2})\s*[-/月]\s*(\d{1,2})/.exec(text);
  if (!m) return undefined;
  const mon = Number(m[1]), day = Number(m[2]);
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return undefined;
  const today = localDate(0);
  let year = Number(today.slice(0, 4));
  if (`${year}-${pad2(mon)}-${pad2(day)}` < today) year += 1; // 已过的日期视为明年
  return `${year}-${pad2(mon)}-${pad2(day)}`;
}

/** 必须带「周/星期/礼拜」前缀,避免「等一下」被当成周一 */
function parseWeekday(text: string): string | undefined {
  const m = /(?:周|星期|礼拜)([一二三四五六日天])/.exec(text);
  return m ? `周${m[1] === "天" ? "日" : m[1]}` : undefined;
}

/** 只认「1」「第2个」「选3」这类明确的序号,不从日期等文字里抓数字 */
function parseIndex(text: string): number | undefined {
  const m = /^\s*(?:第|选)?\s*(\d)\s*(?:个|号|项)?\s*$/.exec(text);
  return m ? Number(m[1]) : undefined;
}

/** 预算:「150 元」「预算 150」「150 以内/以下/左右」 */
function parseBudget(text: string): number | undefined {
  const m = /(\d{2,4})\s*(?:元|块|以内|以下|之内|左右)/.exec(text) ?? /预算[^\d]{0,4}(\d{2,4})/.exec(text);
  return m ? Number(m[1]) : undefined;
}

/** 简短的确认语;含否定/换的不算 */
function isConfirm(text: string): boolean {
  if (text.length > 12 || /(不|别|换|其他|其它|吗|\?|？|什么|多少|几)/.test(text)) return false;
  return /(好的|好呀|好啊|可以|行|就这个|就它|确认|没问题|嗯|对|ok|OK|再约)/.test(text);
}

/* ---------- 工具:真实排班查询 ---------- */
function getSlots(storeId: string, filter: { weekday?: string; date?: string } = {}): { date: string; weekday: string; staff: string; time: string }[] {
  const rows = sqlite.prepare(`
    SELECT work_date, staff_name, start_at, end_at FROM store_staff_schedules
    WHERE store_id = ? AND work_date >= ? ORDER BY work_date ASC, staff_name ASC LIMIT 40
  `).all(storeId, localDate(0)) as Row[];
  const seen = new Map<string, { date: string; weekday: string; staff: string; time: string }>();
  for (const r of rows) {
    const date = r.work_date as string;
    const wd = WEEKDAYS[new Date(date + "T12:00:00").getDay()];
    if (filter.weekday && wd !== filter.weekday) continue;
    if (filter.date && date !== filter.date) continue;
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
    WHERE conversation_id = ? AND direction='out' ORDER BY created_at DESC, rowid DESC LIMIT 1
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

  // ② 不满意/投诉 → 转人工,暂停营销,会话标记等待老板娘
  if (/(不满意|投诉|差评|态度)/.test(text)) {
    sqlite.prepare("UPDATE conversations SET status='needs_human' WHERE id = ?").run(convId);
    const reply: ChatReply = {
      text: "真的非常抱歉,给你带来了不好的体验。我已经把情况记下来,并通知店员尽快联系你处理。你的这次对话我已暂停一切推销。",
      cards: [{ type: "transferred" }], quickReplies: [], stage: "aftercare",
    };
    saveOut(convId, reply, {});
    return reply;
  }

  // ③ 上下文:正在选服务(序号 / 服务名 / 「好的就这个」确认第一个推荐)
  if (pending.action === "choose_service" && pending.services?.length) {
    const idx = parseIndex(text);
    const chosen = (idx ? pending.services[idx - 1] : undefined)
      ?? pending.services.find((s) => text.includes(s.name.slice(0, 2)))
      ?? (isConfirm(text) ? pending.services[0] : undefined);
    if (chosen) {
      // 之前已按日期/星期筛过时段的,沿用筛选结果
      const slots = pending.slots?.length ? pending.slots : getSlots(storeId);
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

  // ④ 上下文:正在选时段 → 真实预约落库(日期 > 星期 > 序号;快捷回复「周六(11-07)」按日期匹配)
  if (pending.action === "choose_slot" && pending.chosen && pending.slots) {
    const date = parseDate(text);
    const wd = parseWeekday(text);
    const idx = parseIndex(text);
    const slot = (date ? pending.slots.find((s) => s.date === date) : undefined)
      ?? (wd ? pending.slots.find((s) => s.weekday === wd) : undefined)
      ?? (idx ? pending.slots[idx - 1] : undefined);
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

  // ⑤a 意图:查消费历史(真实流水,不编造;须绑定会员)
  if (/(上次|上回|之前做|以前做|消费记录|做过什么)/.test(text)) {
    if (!member) {
      const reply: ChatReply = {
        text: "要查你的消费记录,需要先绑定会员身份(右上角「绑定会员」,输入会员号或手机尾号)。绑定前我看不到任何个人档案~",
        cards: [], quickReplies: baseQuick, stage: "history",
      };
      saveOut(convId, reply, {});
      return reply;
    }
    const last = sqlite.prepare(
      "SELECT service, amount, occurred_at FROM consumption_records WHERE member_id = ? ORDER BY occurred_at DESC LIMIT 1"
    ).get(member.id) as { service: string; amount: number; occurred_at: string } | undefined;
    if (!last) {
      const reply: ChatReply = { text: "我还没查到你在店里的消费记录。想试试什么项目?我帮你推荐~", cards: [], quickReplies: baseQuick, stage: "history" };
      saveOut(convId, reply, {});
      return reply;
    }
    const svc = getCatalog(storeId).find((s) => s.name === last.service);
    const reply: ChatReply = {
      text: `你上次是 ${last.occurred_at.slice(0, 10)} 来做的「${last.service}」,消费 ¥${Math.round(last.amount)}。${svc ? "要不要再约一次?" : ""}`,
      cards: [], quickReplies: svc ? ["再约一次", "看看新品", "多少钱?"] : baseQuick, stage: "history",
    };
    saveOut(convId, reply, svc ? { action: "choose_service", services: [svc] } : {});
    return reply;
  }

  // ⑤ 意图:预约(按「明天」「周六」「11-07」筛真实排班;一条出站消息同时保存时段和候选服务)
  if (/(预约|有空|时间|几点|排班|明天|后天)/.test(text)) {
    const date = parseDate(text);
    const weekday = parseWeekday(text);
    let slots = getSlots(storeId, { date, weekday });
    let note = "";
    if ((date || weekday) && slots.length === 0) {
      note = `${date ?? weekday}暂时没有排班,给你看看最近的时段:`;
      slots = getSlots(storeId);
    }
    const intro = note || (member
      ? `${greetName},最近的可预约时段如下(都来自店里真实排班)。选定后我直接帮你约上~`
      : "最近的可预约时段如下。绑定会员后我还能记住你的偏好哦~");
    const slotQuick = slots.slice(0, 3).map((s) => `${s.weekday}(${s.date.slice(5)})`);
    // 选时段前需要先定服务:给默认热门服务候选
    const rec = recommendServices({ storeId, favoriteService: member?.favoriteService ?? null, limit: 1 });
    if (rec[0]) {
      const services = [rec[0].service, ...recommendServices({ storeId, limit: 3 }).map((r) => r.service)
        .filter((s) => s.id !== rec[0].service.id)];
      const reply: ChatReply = {
        text: `${intro}\n\n先定个项目:要做「${rec[0].service.name}」(¥${rec[0].service.price} · ${rec[0].service.durationMin} 分钟)吗?回「1」或「好的」确认,也可以告诉我想做的项目~`,
        cards: [{ type: "slots", items: slots }],
        quickReplies: ["确认做" + rec[0].service.name, "看看其他款式"],
        stage: "booking_service",
      };
      saveOut(convId, reply, { action: "choose_service", services, slots });
      return reply;
    }
    const reply: ChatReply = {
      text: intro, cards: [{ type: "slots", items: slots }], quickReplies: slotQuick, stage: "booking_intent",
    };
    saveOut(convId, reply, {});
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
    const budget = parseBudget(text);
    const recs = recommendServices({
      storeId,
      favoriteService: member?.favoriteService ?? null,
      budget,
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

  // ⑨ 兜底:欢迎 + 能力说明(保留未完成的选择上下文,用户随后回序号仍然有效)
  const reply: ChatReply = {
    text: pending.action
      ? `${greetName},这句我没太听懂~可以回上面列表的序号继续,或者直接告诉我你想做什么。`
      : `${greetName}好呀~我是这家店的醒醒喵 🐱\n可以帮你:挑款式、查真实价格、看预约时段、绑定会员查权益。直接说需求就行!`,
    cards: [],
    quickReplies: baseQuick,
    stage: pending.action ? "clarify" : "greeting",
  };
  saveOut(convId, reply, pending);
  return reply;
}
