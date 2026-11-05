import { MemberCatView, MemoryEntry } from "@/mock-data/types";

/* ============================================================
   会员档案演示生成器:消费历史 / 营销效果 / AI 分析
   全部为确定性伪数据(同一会员每次打开结果一致),界面明确标注「演示」。
   ============================================================ */

export interface PurchaseRecord {
  service: string;
  amount: number;
  date: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SERVICE_POOL = [
  "猫眼款美甲", "法式白边", "极光粉", "碎钻款", "手绘小花",
  "渐变晕染", "纯色跳色", "卸甲+手部护理", "猫眼镭射",
];

/** 确定性消费历史(演示):以会员 id 为种子,同一会员结果稳定 */
export function getPurchaseHistory(m: MemberCatView): PurchaseRecord[] {
  const rnd = mulberry32(hash(m.id));
  const n = Math.max(3, Math.min(6, Math.round(m.visits / 1.6)));
  const out: PurchaseRecord[] = [];
  for (let i = 0; i < n; i++) {
    const service = i === 0 ? m.favoriteService : SERVICE_POOL[Math.floor(rnd() * SERVICE_POOL.length)];
    const days = Math.min(m.lastVisitDays + i * 21 + Math.floor(rnd() * 12), 300);
    const d = new Date(Date.now() - days * 86400_000);
    out.push({
      service,
      amount: 88 + Math.floor(rnd() * 90),
      date: d.toISOString().slice(0, 10),
    });
  }
  return out;
}

/** 历史营销效果(演示):与会员状态自洽——沉睡者触达少、活跃者有完整漏斗 */
export function getMarketingEffect(m: MemberCatView): {
  reached: number; replied: number; appointed: number; note: string;
} {
  const rnd = mulberry32(hash(m.id + "#mkt"));
  if (m.zone === "sleeping") {
    return { reached: 1, replied: 0, appointed: 0, note: "近期仅有一条唤醒触达在排期,回复后自动更新" };
  }
  const reached = 2 + Math.floor(rnd() * 2);
  const replied = m.zone === "active" ? 1 + Math.floor(rnd() * 2) : Math.floor(rnd() * 2);
  const appointed = m.zone === "premium" || m.risk !== "high" ? Math.min(replied, 1) : 0;
  return {
    reached, replied, appointed,
    note: "来自企微演示通道的触达记录汇总",
  };
}

export interface MemberAnalysis {
  headline: string;
  summary: string;
  riskPct: number;
  actions: string[];
}

/** 「让 AI 分析这位会员」:本地规则引擎拼装(演示),接入 GLM 后由大模型生成 */
export function analyzeMember(m: MemberCatView, memories: MemoryEntry[]): MemberAnalysis {
  const rnd = mulberry32(hash(m.id + "#ai"));
  const spendLevel = m.spend >= 1500 ? "顶级" : m.spend >= 800 ? "高价值" : m.spend >= 400 ? "中坚" : "入门";
  const memoryHook = memories.find((x) => x.type === "服务偏好" || x.type === "特殊事件")?.content;

  const byZone: Record<string, string> = {
    premium: `她是店里的${spendLevel}会员,但已经 ${m.lastVisitDays} 天没有出现。这种沉默不是离开,更像被忽略了——建议本周内用一条专属消息把她请回来。`,
    active: `状态健康:最近一次到店在 ${m.lastVisitDays} 天前,节奏稳定。现在的任务是别让她冷下来,${Math.max(m.lastVisitDays, 14)} 天内安排一次轻互动即可。`,
    sleeping: `${m.lastVisitDays} 天的沉默已经让这段关系进入危险区。好消息是她对「${m.favoriteService}」有过明确好感,有抓手,不是盲打。`,
    risk: `流失信号明确:长期未到店 + ${spendLevel}体量,每拖一周挽回成本都在涨。这一位建议跳过模板消息,由老板娘亲自出手。`,
  };

  const actions: string[] = [
    `发送「${m.favoriteService}」相关的一对一消息(引用她的偏好,不群发)`,
  ];
  if (m.risk !== "low") {
    actions.push(m.zone === "premium" || m.risk === "high"
      ? "补一张限时权益券,给一个 7 天内到店的具体理由"
      : "跟进一条轻内容(新色板图/短视频),不做硬推销");
  }
  if (memoryHook) actions.push(`对话时自然提起:「${memoryHook.slice(0, 24)}…」——被记得的感觉是回流的开始`);
  if (m.visits >= 8) actions.push("到店后邀请加入老客专属群,沉淀长期关系");

  return {
    headline: `${spendLevel}会员 · ${m.lastVisitDays} 天未到店 · ${m.risk === "high" ? "需要立刻行动" : m.risk === "mid" ? "值得主动经营" : "保持温度"}`,
    summary: (byZone[m.zone] ?? byZone.sleeping) + (memoryHook ? `档案里还留着一个细节:${memoryHook}。` : ""),
    riskPct: m.risk === "high" ? 78 + Math.floor(rnd() * 14) : m.risk === "mid" ? 42 + Math.floor(rnd() * 16) : 12 + Math.floor(rnd() * 15),
    actions: actions.slice(0, 3),
  };
}
