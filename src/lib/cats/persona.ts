import { getLlmConfig, LlmConfig } from "../llm";
import { topMemoriesForPrompt } from "../memory/extractor";
import { recommendServices, getCatalog } from "../sales/recommendation-engine";
import { MemberCatView } from "@/mock-data/types";

/* ============================================================
   闺蜜喵人格层:先做闺蜜,再做销售
   LLM 主路径(带加权记忆上下文 + 真实在售服务摘要);
   规则兜底(基于记忆的模板,诚实标注)。
   销售意图(预约/询价)仍走 conversation-engine 确定性技能,
   闺蜜层负责陪伴、点评、记忆对话。
   ============================================================ */

export interface PersonaReply {
  text: string;
  cards: PersonaCard[];
  quickReplies: string[];
  engine: "llm" | "rules";
}

export type PersonaCard =
  | { type: "services"; title: string; items: { id: string; name: string; price: number; durationMin: number; isNew: boolean }[] };

export async function bestieReply(opts: {
  storeId: string;
  config: LlmConfig;
  member: MemberCatView;          // 已绑定会员
  catName: string;
  catStage: string;
  text: string;
}): Promise<PersonaReply> {
  const { storeId, config, member, catName, text } = opts;
  const memories = topMemoriesForPrompt(member.id, 12);
  const catalog = getCatalog(storeId).slice(0, 8)
    .map((s) => `${s.name} ¥${s.price}${s.isNew ? "(新品)" : ""}`).join(";");

  const system = `你是「${catName}」,一位美甲店会员的 AI 闺蜜猫。
性格:${opts.catStage === "active" ? "活泼温暖" : "有点困但依然在意主人"}。
说话风格:像认识多年的闺蜜——自然、口语化、偶尔用一两个颜文字或 emoji、绝不长篇大论(3 句以内)。
你记得的主人档案(按重要度排序,聊天时自然地用到,但不要一次性背诵):
${memories.length ? memories.map((m) => "- " + m).join("\n") : "(还不太了解主人,聊天时可以自然地问主人喜欢什么)"}
店里真实在售服务(引用价格时只能从这里取,禁止编造):${catalog}
底线:1) 不主动推销,先关心人;2) 主人问价格/预约时,如实告知并说"我来帮你安排~";
3) 主人纠正你时,道歉并说"我记住啦";4) 不知道的事就说不记得,请主人告诉你。`;

  if (config.apiKey) {
    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: text },
          ],
          temperature: 0.85,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[bestieReply] GLM HTTP ${res.status}: ${errBody.slice(0, 200)}`);
      } else {
        const data = await res.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) {
          return { text: reply.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim(), cards: [], quickReplies: defaultQuick(text), engine: "llm" };
        }
        console.error("[bestieReply] GLM 返回 200 但无 content:", JSON.stringify(data).slice(0, 300));
      }
    } catch (e) {
      console.error("[bestieReply] GLM 调用异常:", e instanceof Error ? e.message : e);
    }
  }

  /* ---------- 规则兜底:基于记忆的模板(诚实标注由调用方处理) ---------- */
  const like = memories.find((m) => m.includes("喜欢"));
  const want = memories.find((m) => m.includes("想尝试"));
  let replyText: string;
  if (/喜欢|爱/.test(text) && like) {
    replyText = `嗯嗯,我记住了!你喜欢${like.split(": ")[1] ?? ""}——下次来店里,我第一时间帮你留意${like.includes("颜色") ? "这个色系" : "这类款式"}的新款~`;
  } else if (like) {
    replyText = `对了对了,我记得你喜欢${like.split(": ")[1] ?? ""}。最近店里上了些新品,要看看吗?`;
  } else if (want) {
    replyText = `你想尝试${want.split(": ")[1] ?? ""}对吧!我帮你留意着,有合适的马上告诉你~`;
  } else if (/你好|在吗|嗨|hi/i.test(text)) {
    replyText = `${member.name}来啦~今天想聊点什么?或者让我帮你挑挑款式、看看预约时间?`;
  } else {
    replyText = `嗯嗯,我在听~跟你聊天我总能学到新东西。想让我推荐款式的话直接说预算就行!`;
  }
  return { text: replyText, cards: [], quickReplies: defaultQuick(replyText), engine: "rules" };
}

function defaultQuick(text: string): string[] {
  const q = ["看看今天的新款", "我想预约"];
  if (/喜欢|记/.test(text)) q.unshift("查我的记忆");
  return q;
}

/** 「今天发现的新款」:按会员偏好(记忆标签)匹配真实目录 */
export function todayDiscoveries(storeId: string, member: MemberCatView, memories: string[]): {
  name: string; price: number; durationMin: number; isNew: boolean; reason: string;
}[] {
  const all = getCatalog(storeId).filter((s) => s.isNew);
  const prefHit = (name: string) => memories.some((m) => m.includes(name.slice(0, 2)));
  return all
    .map((s) => ({
      ...s,
      reason: prefHit(s.name)
        ? `和你喜欢的「${member.favoriteService}」同风格的新款`
        : "本月新品,第一个想到你",
    }))
    .sort((a, b) => Number(prefHit(b.name)) - Number(prefHit(a.name)))
    .slice(0, 3);
}
