import { MemberCatView, MemoryEntry, RiskLevel, Zone } from "./types";

type Seed = [
  name: string, zone: Zone, level: MemberCatView["level"], colorway: MemberCatView["colorway"],
  spend: number, visits: number, days: number, fav: string, tags: string, risk: RiskLevel, hint: string,
];

/* 演示数据:46 名有完整档案的会员(驾驶舱的 2,800 为聚合唱数,已标注演示) */
const SEEDS: Seed[] = [
  // ---- 活跃街区 ----
  ["楠楠", "active", "黄金", "ragdoll", 866, 8, 2, "手绘小花", "完美主义", "low", "下次到店推荐同系列新色"],
  ["月月", "active", "黄金", "cow", 1204, 14, 3, "纯色跳色", "话痨", "low", "生日月快到了,准备小惊喜"],
  ["图图", "active", "白银", "gray", 502, 6, 5, "极光粉", "尝鲜派", "low", "拍照爱好者,可邀请晒单"],
  ["小满", "active", "白银", "orange", 688, 7, 8, "猫眼款", "安静", "low", "到店频次稳定,维持关怀即可"],
  ["立夏", "active", "普通", "calico", 431, 5, 9, "渐变晕染", "价格敏感", "low", "适合拼团/次卡类活动"],
  ["谷雨", "active", "白银", "cow", 1155, 8, 1, "极光粉", "安静", "low", "刚被唤醒回流,趁热推套餐"],
  ["图图姐", "active", "普通", "orange", 388, 4, 12, "卸甲护理", "完美主义", "low", "护理类目复购潜力高"],
  ["多多", "active", "黄金", "calico", 934, 9, 4, "碎钻款", "话痨", "low", "可发展为门店会员推荐官"],
  ["乐乐", "active", "白银", "ragdoll", 720, 8, 6, "手绘小花", "尝鲜派", "low", "对新品反应快,推新首选"],
  ["一一", "active", "普通", "gray", 356, 4, 15, "纯色跳色", "安静", "low", "到店间隔开始拉长,留意"],
  ["小寒", "active", "白银", "orange", 640, 6, 3, "猫眼镭射", "尝鲜派", "low", "镭射款还没试过,机会点"],
  ["北北", "active", "普通", "cow", 298, 3, 7, "法式白边", "话痨", "low", "带朋友来过,可推闺蜜拼团"],
  ["星星", "active", "白银", "ragdoll", 590, 6, 10, "极光粉", "完美主义", "low", "偏好靠窗位,服务动线要记住"],
  ["南南", "active", "普通", "calico", 312, 3, 18, "纯色跳色", "价格敏感", "mid", "到店间隔 18 天,临界点关注"],

  // ---- 沉睡森林 ----
  ["李李", "sleeping", "白银", "orange", 620, 5, 52, "极光粉", "尝鲜派", "mid", "瞌睡期,推新色板正合适"],
  ["璐璐", "sleeping", "黄金", "orange", 890, 9, 63, "渐变晕染", "话痨", "mid", "约会前必来,节日前是唤醒窗口"],
  ["小鹿", "sleeping", "普通", "ragdoll", 380, 3, 47, "猫眼款", "安静", "mid", "第一次做猫眼体验不错,可续推"],
  ["悠悠", "sleeping", "白银", "calico", 560, 5, 68, "碎钻款", "完美主义", "mid", "需轻回访,不宜直接推促销"],
  ["芝麻", "sleeping", "普通", "gray", 290, 3, 71, "卸甲护理", "价格敏感", "mid", "适合小额券试探唤回"],
  ["年糕", "sleeping", "白银", "orange", 540, 5, 82, "渐变晕染", "尝鲜派", "high", "80 天+临界,本周必须触达"],
  ["奶茶", "sleeping", "普通", "cow", 268, 3, 96, "纯色跳色", "安静", "high", "再不唤醒将进入深度流失"],
  ["皮皮", "sleeping", "黄金", "calico", 780, 7, 88, "碎钻款", "话痨", "high", "历史高消费,流失损失大"],
  ["蛋卷", "sleeping", "白银", "ragdoll", 610, 6, 91, "手绘小花", "尝鲜派", "high", "对花色敏感,推新系列试试"],
  ["麻薯", "sleeping", "白银", "cow", 490, 5, 104, "法式白边", "安静", "high", "白边要窄一点——服务细节要带上"],
  ["月亮", "sleeping", "普通", "orange", 310, 3, 112, "极光粉", "价格敏感", "high", "沉睡超过 100 天,需组合拳"],
  ["贝拉", "sleeping", "白银", "gray", 470, 4, 89, "猫眼款", "完美主义", "high", "曾嫌蓝绿显黑,推荐时避开"],

  // ---- 高价值庄园 ----
  ["王姐", "premium", "钻石", "calico", 2380, 18, 98, "猫眼款", "安静", "high", "会员 2 年,卡里还有 ¥300 未核销"],
  ["芳芳", "premium", "钻石", "cow", 3160, 19, 121, "碎钻款", "完美主义", "high", "结婚照拍过手模,情感联结强"],
  ["琳达", "premium", "钻石", "ragdoll", 2890, 16, 76, "渐变晕染", "话痨", "high", "消费力最强,流失即重损"],
  ["米娅", "premium", "黄金", "purple", 1980, 13, 45, "猫眼镭射", "尝鲜派", "mid", "愿试新色,新品首发人选"],
  ["西西", "premium", "黄金", "cow", 1760, 12, 58, "手绘小花", "完美主义", "mid", "对细节挑剔,策略要走心"],
  ["佳佳", "premium", "黄金", "orange", 1520, 11, 39, "碎钻款", "话痨", "mid", "到店频次在降,需重点关注"],
  ["雪梨", "premium", "黄金", "ragdoll", 1690, 10, 66, "极光粉", "安静", "high", "沉睡中的高价值,优先级最高"],
  ["布丁", "premium", "黄金", "calico", 1450, 9, 72, "纯色跳色", "尝鲜派", "high", "可邀约新品品鉴会"],

  // ---- 新会员村 ----
  ["七七", "new", "普通", "orange", 128, 1, 6, "猫眼款", "尝鲜派", "low", "首单体验好,二单转化是关键"],
  ["芒果", "new", "普通", "calico", 96, 1, 9, "法式白边", "安静", "low", "需要一次「记住了她」的服务"],
  ["汤圆", "new", "普通", "cow", 138, 2, 4, "纯色跳色", "话痨", "low", "两次到店间隔短,积极信号"],
  ["椰奶", "new", "普通", "gray", 88, 1, 12, "卸甲护理", "价格敏感", "mid", "首单低客单,推入门套餐"],
  ["豆豆", "new", "普通", "ragdoll", 158, 2, 3, "极光粉", "尝鲜派", "low", "正在探索期,推会员卡正合适"],
  ["妞妞", "new", "普通", "orange", 118, 1, 15, "猫眼款", "安静", "mid", "15 天未复购,新客唤醒窗口"],
  ["糖糖", "new", "普通", "purple", 142, 2, 8, "手绘小花", "完美主义", "low", "喜欢拍照,可邀请发小红书"],

  // ---- 风险警戒区 ----
  ["周阿姨", "risk", "白银", "orange", 420, 5, 140, "纯色跳色", "价格敏感", "high", "沉睡 140 天,需老板娘亲自回访"],
  ["陈小姐", "risk", "白银", "gray", 610, 7, 87, "法式白边", "完美主义", "high", "对白边宽度挑剔,恢复信任优先"],
  ["可可", "risk", "黄金", "calico", 840, 9, 103, "手绘小花", "尝鲜派", "high", "生日月想换风格——绝佳切入"],
  ["半半", "risk", "黄金", "cow", 947, 10, 158, "手绘小花", "话痨", "high", "流失最久的千元客,需组合策略"],
  ["小雨", "risk", "白银", "purple", 530, 5, 95, "渐变晕染", "价格敏感", "high", "曾被推销引起不适,话术要轻"],
];

export const MEMBERS: MemberCatView[] = SEEDS.map((s, i) => {
  const [name, zone, level, colorway, spend, visits, days, fav, tag, risk, hint] = s;
  const state = zone === "active" || zone === "premium" ? (days <= 5 ? "happy" : "awake")
    : zone === "new" ? "awake"
    : zone === "risk" ? "sleep"
    : days > 80 ? "sleep" : "drowsy";
  return {
    id: `m_${String(i + 1).padStart(3, "0")}`,
    name,
    phoneMasked: `1${3 + (i % 7)}8****${1000 + i * 137 % 9000}`,
    level, zone,
    state: state as MemberCatView["state"],
    colorway, spend, visits, lastVisitDays: days,
    favoriteService: fav,
    tags: [tag, `${fav.slice(0, 2)}党`],
    risk,
    strategyHint: hint,
    joinedAt: `202${4 + (i % 3)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(2 + (i % 27)).padStart(2, "0")}`,
    catName: ["糯米", "橘座", "煤球", "雪球", "三三", "豆包", "年糕", "汤圆"][i % 8] + (i + 1),
  };
});

export const ZONE_META: Record<Zone, { label: string; desc: string; accent: string; glow: string }> = {
  premium: { label: "高价值庄园", desc: "累计消费千元以上,流失一位都是重损失", accent: "#FFC94D", glow: "rgba(255,201,77,.16)" },
  active: { label: "活跃街区", desc: "30 天内有到店,关系健康", accent: "#3ECF8E", glow: "rgba(62,207,142,.13)" },
  new: { label: "新会员村", desc: "入会 90 天内,二单转化是关键", accent: "#4ECFE0", glow: "rgba(78,207,224,.13)" },
  sleeping: { label: "沉睡森林", desc: "35 天以上未到店,正在打瞌睡", accent: "#7C6CFF", glow: "rgba(124,108,255,.14)" },
  risk: { label: "风险警戒区", desc: "流失风险高,需要立刻行动", accent: "#FF5F7E", glow: "rgba(255,95,126,.14)" },
};

export const ZONE_ORDER: Zone[] = ["premium", "active", "new", "sleeping", "risk"];

/* ---- 记忆博物馆(每条都有来源,呼应真实产品的反编造原则) ---- */
export const MEMORIES: MemoryEntry[] = [
  { id: "mm_01", memberId: "m_030", type: "特殊事件", content: "结婚照要拍手模,碎钻款是她自己挑的", source: "老板娘口述", recordedAt: "2026-08-12" },
  { id: "mm_02", memberId: "m_030", type: "购买记录", content: "做了「碎钻款」¥168,由阿柒服务", source: "消费流水 #cr_0412", recordedAt: "2026-07-08" },
  { id: "mm_03", memberId: "m_030", type: "服务偏好", content: "钻石装饰要多加一层,嫌不够闪", source: "沟通记录 2026-07-08", recordedAt: "2026-07-08" },
  { id: "mm_04", memberId: "m_030", type: "消费记忆", content: "累计消费 ¥3,160,是店内 TOP3 会员", source: "消费流水汇总", recordedAt: "2026-11-01" },
  { id: "mm_05", memberId: "m_001", type: "服务偏好", content: "偏爱「猫眼款美甲」,曾提过嫌蓝绿色显黑", source: "消费流水 #cr_053_0", recordedAt: "2026-07-11" },
  { id: "mm_06", memberId: "m_001", type: "特殊事件", content: "生日月喜欢收到小惊喜", source: "老板娘口述", recordedAt: "2026-09-11" },
  { id: "mm_07", memberId: "m_001", type: "购买记录", content: "卡内余额 ¥300 未核销,4 次权益未使用", source: "卡券系统", recordedAt: "2026-11-01" },
  { id: "mm_08", memberId: "m_001", type: "沟通记录", content: "11-05 收到店庆唤醒消息,回复「这周六有空」", source: "企微演示通道", recordedAt: "2026-11-05" },
  { id: "mm_09", memberId: "m_042", type: "会员反馈", content: "上次的推销让她不舒服,希望只聊穿搭不推项目", source: "老板娘口述", recordedAt: "2026-09-28" },
  { id: "mm_10", memberId: "m_042", type: "消费记忆", content: "累计消费 ¥947,第 10 次到店后开始沉睡", source: "消费流水汇总", recordedAt: "2026-06-02" },
  { id: "mm_11", memberId: "m_006", type: "沟通记录", content: "唤醒消息回复「好呀,周六有空」,已建预约单", source: "企微演示通道", recordedAt: "2026-11-05" },
  { id: "mm_12", memberId: "m_006", type: "购买记录", content: "到店做了「极光粉」¥177,由小林服务", source: "消费流水 #cr_1108", recordedAt: "2026-11-05" },
  { id: "mm_13", memberId: "m_018", type: "服务偏好", content: "第一次做猫眼款,体验反馈很好", source: "消费流水 #cr_0287", recordedAt: "2026-09-20" },
  { id: "mm_14", memberId: "m_018", type: "会员反馈", content: "说下次想带闺蜜一起来", source: "沟通记录 2026-09-20", recordedAt: "2026-09-20" },
  { id: "mm_15", memberId: "m_038", type: "消费记忆", content: "新会员,首单「猫眼款」体验顺利", source: "消费流水 #cr_0980", recordedAt: "2026-10-31" },
];

/* 会员档案的「推荐经营策略」:从 strategyHint 直接取,展示时标注为 AI 建议(演示) */
