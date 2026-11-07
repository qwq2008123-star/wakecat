import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db/client";
import { resolveStore } from "@/lib/store";
import { ensureBootstrap } from "@/lib/bootstrap";
import { getBoundMember } from "@/lib/customer-identity";
import { adoptCat, touchCat, awardEnergy, awardBond, catView } from "@/lib/cats/engine";
import { handleCustomerMessage } from "@/lib/sales/conversation-engine";
import { getOrCreateConversation, loadPending } from "@/lib/sales/conversation-engine";
import { bestieReply } from "@/lib/cats/persona";
import { extractAndSave } from "@/lib/memory/extractor";
import { getLlmConfig } from "@/lib/llm";
import { MemberCatView } from "@/mock-data/types";

/** 闺蜜喵对话:绑定会员 → 人格聊天 + 记忆提取 + 能量;未绑定 → 店铺导购(规则) */
export async function POST(req: Request, { params }: { params: Promise<{ storeSlug: string }> }) {
  await ensureBootstrap();
  const { storeSlug } = await params;
  const store = resolveStore(storeSlug);
  if (!store) return NextResponse.json({ error: "店铺不存在" }, { status: 404 });

  const { visitorId, message } = await req.json().catch(() => ({ visitorId: "", message: "" }));
  if (!visitorId || !message?.trim()) {
    return NextResponse.json({ error: "缺少 visitorId 或 message" }, { status: 400 });
  }
  const text = String(message);

  // 身份识别:未绑定访客 → 店铺导购状态机(原有技能保留)
  const bound = getBoundMember(store.id, visitorId);
  if (!bound) {
    const reply = handleCustomerMessage({
      storeId: store.id, identityId: `h5:${visitorId}`, memberId: null, member: null, message: text,
    });
    return NextResponse.json({ ...reply, mode: "guide", cat: null, memories: [] });
  }

  // 已绑定:自动领养闺蜜猫(每店每用户一只)
  const cat = adoptCat(store.id, bound.member_id as string);
  touchCat(cat.id);

  const config = await getLlmConfig(store.id);
  const memberView: MemberCatView = {
    id: bound.member_id as string,
    name: bound.name as string,
    phoneMasked: "", level: bound.level as MemberCatView["level"],
    zone: "active", state: "awake", colorway: cat.colorway as MemberCatView["colorway"],
    spend: 0, visits: 0, lastVisitDays: 0,
    favoriteService: "", tags: [], risk: "low",
    strategyHint: "", joinedAt: "", catName: cat.name,
  };

  // 路由:有未完成的预约上下文(5 分钟内的 pending)或销售意图关键词时,
  //       进 conversation-engine 确定性技能(真实排班/目录/预约)——
  //       「好的」「1」这类确认语没有关键词,必须靠 pending 接上流程;
  //       其余全部走闺蜜人格(LLM 带记忆)。
  const identityId = `h5:${visitorId}`;
  const convId = getOrCreateConversation(store.id, identityId, "h5");
  // 会话归属:绑定会员后把 member_id 回写会话,B 端收件箱才能显示真人
  sqlite.prepare("UPDATE conversations SET member_id = ? WHERE id = ? AND member_id IS NULL")
    .run(bound.member_id as string, convId);
  const pending = loadPending(convId);
  const salesIntent = !!pending.action
    || /(预约|有空|多少钱|价格|优惠|会员权益|推荐|新品|款式|预算|做「|周三|周四|周五|周六|周日|周一|周二|券|抵扣)/.test(text)
    // 不满/投诉必须进确定性引擎:暂停营销、转老板娘,不能让闺蜜人格嘻嘻哈哈接住
    || /(不满意|投诉|差评|态度|退款)/.test(text);
  let text2: string, cards: unknown[] = [], quickReplies: string[] = [], stage = "chat", engine: string = config.apiKey ? "llm" : "rules";

  if (salesIntent) {
    const r = handleCustomerMessage({
      storeId: store.id, identityId, memberId: bound.member_id as string,
      member: memberView, message: text,
    });
    text2 = r.text; cards = r.cards; quickReplies = r.quickReplies; stage = r.stage;
    engine = "rules·销售技能";
  } else {
    const r = await bestieReply({
      storeId: store.id, config, member: memberView,
      catName: cat.name, catStage: cat.stage, text,
    });
    text2 = r.text; quickReplies = r.quickReplies; engine = r.engine;
  }

  // 记忆提取(LLM 主路径 / 规则兜底)——聊天是记忆最重要的来源
  let newMemories: string[] = [];
  try {
    const ex = await extractAndSave({
      storeId: store.id, userId: bound.member_id as string, catId: cat.id,
      memberName: bound.name as string, text, source: "chat",
      sourceRef: `conversation:${new Date().toISOString().slice(0, 10)}`, config,
    });
    newMemories = ex.items.map((i) => `${i.attribute}: ${i.value}`);
    if (ex.engine === "rules" && ex.items.length) engine = engine === "llm" ? engine : "rules·记忆";
  } catch { /* 记忆提取失败不阻塞对话 */ }

  // 能量与亲密度(真实互动驱动,dedupe 防刷)
  const e1 = awardEnergy({
    catId: cat.id, userId: bound.member_id as string, action: "daily_first_chat",
    dedupeKey: `daily_first_chat:${cat.id}:${new Date().toISOString().slice(0, 10)}`,
  });
  const hash = Buffer.from(text).toString("base64").slice(0, 16);
  const e2 = awardEnergy({
    catId: cat.id, userId: bound.member_id as string, action: "effective_interaction",
    dedupeKey: `eff:${cat.id}:${hash}`, source: "chat",
  });
  if (e1.ok) awardBond(cat.id, bound.member_id as string, "daily_first_chat", "每日首次聊天");
  if (text.length >= 6) awardBond(cat.id, bound.member_id as string, "share_style", "有效分享");

  // 预约成功 → appointment_done 能量
  const apptCard = (cards as Array<{ type: string; appointmentId?: string }>).find((c) => c.type === "appointment");
  if (apptCard?.appointmentId) {
    awardEnergy({
      catId: cat.id, userId: bound.member_id as string, action: "appointment_done",
      relatedType: "appointment", relatedId: apptCard.appointmentId,
      dedupeKey: `appointment_done:${apptCard.appointmentId}`,
    });
    awardBond(cat.id, bound.member_id as string, "appointment_done", "完成预约");
  }

  return NextResponse.json({
    text: text2, cards, quickReplies, stage, engine,
    mode: "bestie",
    cat: catView(cat),
    newMemories,
    energyEvents: [e1, e2].filter((e) => e.ok).map((e) => e.delta),
  });
}
