import { CampaignStrategy, DashboardData, EmployeeId, FinanceSummary, WakeTask, WorkLog } from "./types";

/* ---------- 任务大厅(演示) ---------- */
export const TASKS: WakeTask[] = [
  {
    id: "t_101", name: "店庆周 · 高价值老客唤醒", kind: "优惠券唤醒", ownerId: "boss",
    memberNames: ["王姐", "芳芳", "琳达", "雪梨", "半半", "可可", "皮皮", "蛋卷"],
    targetCount: 8, cost: 60, expectedRevenue: 341, risk: "mid",
    status: "completed", progress: 100,
    steps: [
      { name: "侦探喵体检", done: true }, { name: "军师喵定策略", done: true },
      { name: "商家审批", done: true }, { name: "销售喵触达", done: true }, { name: "财务喵复盘", done: true },
    ],
    createdAt: "2026-11-06 10:24",
    engineNote: "本任务由内置规则引擎演示生成;接入 GLM 后同一流程由大模型驱动",
  },
  {
    id: "t_102", name: "临期权益保卫战", kind: "权益提醒", ownerId: "strategist",
    memberNames: ["小寒", "霜霜", "大雪", "冬至", "惊蛰", "春分"],
    targetCount: 6, cost: 0, expectedRevenue: 156, risk: "low",
    status: "pending_approval", progress: 60,
    steps: [
      { name: "侦探喵体检", done: true }, { name: "军师喵定策略", done: true },
      { name: "商家审批", done: false }, { name: "销售喵触达", done: false }, { name: "财务喵复盘", done: false },
    ],
    createdAt: "2026-11-06 11:12",
    engineNote: "零成本策略:一句「权益要作废了」比优惠券更有效",
  },
  {
    id: "t_103", name: "新色板首发 · 尝鲜派专场", kind: "新品推荐", ownerId: "seller",
    memberNames: ["米娅", "布丁", "李李", "乐乐", "糖糖"],
    targetCount: 5, cost: 25, expectedRevenue: 240, risk: "low",
    status: "running", progress: 45,
    steps: [
      { name: "侦探喵体检", done: true }, { name: "军师喵定策略", done: true },
      { name: "商家审批", done: true }, { name: "销售喵触达", done: false }, { name: "财务喵复盘", done: false },
    ],
    createdAt: "2026-11-06 14:02",
    engineNote: "触达进行中:2 人已回复,1 人预约",
  },
  {
    id: "t_104", name: "深度沉睡挽回 · 老板娘亲笔信", kind: "人工关系修复", ownerId: "strategist",
    memberNames: ["周阿姨", "半半", "月亮"],
    targetCount: 3, cost: 0, expectedRevenue: 320, risk: "high",
    status: "pending_approval", progress: 40,
    steps: [
      { name: "侦探喵体检", done: true }, { name: "军师喵定策略", done: true },
      { name: "商家审批", done: false }, { name: "销售喵触达", done: false }, { name: "财务喵复盘", done: false },
    ],
    createdAt: "2026-11-06 15:40",
    engineNote: "高风险会员:不建议机器话术,建议老板娘亲自写一段话",
  },
  {
    id: "t_105", name: "感恩节 · 回流会员答谢", kind: "节日营销", ownerId: "boss",
    memberNames: ["谷雨", "楠楠", "月月", "豆豆"],
    targetCount: 4, cost: 48, expectedRevenue: 210, risk: "low",
    status: "paused", progress: 30,
    steps: [
      { name: "侦探喵体检", done: true }, { name: "军师喵定策略", done: true },
      { name: "商家审批", done: true }, { name: "销售喵触达", done: false }, { name: "财务喵复盘", done: false },
    ],
    createdAt: "2026-11-05 16:20",
    engineNote: "已暂停:等待店庆活动效果数据回收后再决策",
  },
  {
    id: "t_106", name: "新会员二单转化计划", kind: "套餐复购", ownerId: "detective",
    memberNames: ["七七", "芒果", "椰奶", "妞妞"],
    targetCount: 4, cost: 32, expectedRevenue: 186, risk: "mid",
    status: "rejected", progress: 25,
    steps: [
      { name: "侦探喵体检", done: true }, { name: "军师喵定策略", done: true },
      { name: "商家审批", done: true }, { name: "销售喵触达", done: false }, { name: "财务喵复盘", done: false },
    ],
    createdAt: "2026-11-04 09:15",
    engineNote: "商家驳回:话术太像广告,要求重写后再审",
  },
];

/* ---------- 驾驶舱(演示数据,统一标注) ---------- */
export const DASHBOARD: DashboardData = {
  greeting: "早上好,老板。今天你的 AI 团队已经准备好开始工作。",
  dateLabel: "11 月 6 日 星期五",
  goal: "店庆周:唤醒 20 位高价值沉睡会员,预算控制在 ¥100 以内",
  kpis: {
    totalMembers: 2800,
    activeMembers: 1860,
    sleepingMembers: 620,
    highRiskMembers: 120,
    awakenedThisMonth: 86,
    monthCost: 328,
    monthRevenue: 12680,
  },
  logs: [
    { id: "l1", time: "10:24", employeeId: "boss", text: "接收今日目标「店庆周唤醒」,拆解为 3 个子任务并派发" },
    { id: "l2", time: "09:40", employeeId: "detective", text: "完成 2,800 名会员 RFM 分群:沉睡 620,高风险 120" },
    { id: "l3", time: "10:31", employeeId: "detective", text: "定位 8 名唤醒价值最高的会员,6 人卡临期" },
    { id: "l4", time: "10:58", employeeId: "strategist", text: "8 份一对一策略完成,总成本压在 ¥60 内" },
    { id: "l5", time: "11:30", employeeId: "seller", text: "「临期权益保卫战」等待审批,批准后即可发送" },
    { id: "l6", time: "11:47", employeeId: "seller", text: "谷雨回复「周六有空」,预约单已建" },
    { id: "l7", time: "12:05", employeeId: "accountant", text: "昨日任务入账:回流 ¥1,029,净收益 ¥969" },
    { id: "l8", time: "12:06", employeeId: "accountant", text: "策略对比:权益提醒 ROI 6.8,建议加量" },
  ] as WorkLog[],
  briefing:
    "芳姐,今天的重点是「临期权益保卫战」——6 张卡月底到期,零成本策略,你批准就能发。另外优惠券策略 ROI 3.9、权益提醒 6.8,建议本月向权益类倾斜。谷雨周六要来,记得留靠窗的位置。",
};

/* ---------- 营销实验室(实验数据全部为演示) ---------- */
export const CAMPAIGNS: CampaignStrategy[] = [
  {
    id: "c1", name: "优惠券唤醒", kind: "优惠券唤醒", desc: "30 元喵喵券,定向发给高消费沉睡会员",
    members: 320, converted: 61, costPerMember: 30, conversion: 0.19, avgUplift: 186, isDemo: true,
    trend: [{ week: "W1", conversion: 0.12 }, { week: "W2", conversion: 0.15 }, { week: "W3", conversion: 0.17 }, { week: "W4", conversion: 0.19 }],
  },
  {
    id: "c2", name: "权益到期提醒", kind: "权益提醒", desc: "「卡要作废了」——零成本的最高 ROI 策略",
    members: 186, converted: 52, costPerMember: 0, conversion: 0.28, avgUplift: 132, isDemo: true,
    trend: [{ week: "W1", conversion: 0.2 }, { week: "W2", conversion: 0.24 }, { week: "W3", conversion: 0.26 }, { week: "W4", conversion: 0.28 }],
  },
  {
    id: "c3", name: "新品推荐", kind: "新品推荐", desc: "新色板上市,第一个想到她",
    members: 210, converted: 29, costPerMember: 5, conversion: 0.14, avgUplift: 158, isDemo: true,
    trend: [{ week: "W1", conversion: 0.08 }, { week: "W2", conversion: 0.1 }, { week: "W3", conversion: 0.12 }, { week: "W4", conversion: 0.14 }],
  },
  {
    id: "c4", name: "套餐复购", kind: "套餐复购", desc: "次卡 + 护理组合,锁定未来 3 次到店",
    members: 150, converted: 18, costPerMember: 8, conversion: 0.12, avgUplift: 264, isDemo: true,
    trend: [{ week: "W1", conversion: 0.06 }, { week: "W2", conversion: 0.09 }, { week: "W3", conversion: 0.11 }, { week: "W4", conversion: 0.12 }],
  },
  {
    id: "c5", name: "人工关系修复", kind: "人工关系修复", desc: "高风险会员,老板娘亲自写一段话",
    members: 42, converted: 15, costPerMember: 0, conversion: 0.36, avgUplift: 312, isDemo: true,
    trend: [{ week: "W1", conversion: 0.3 }, { week: "W2", conversion: 0.32 }, { week: "W3", conversion: 0.34 }, { week: "W4", conversion: 0.36 }],
  },
  {
    id: "c6", name: "节日营销", kind: "节日营销", desc: "感恩节答谢,只送不推",
    members: 96, converted: 20, costPerMember: 12, conversion: 0.21, avgUplift: 142, isDemo: true,
    trend: [{ week: "W1", conversion: 0.14 }, { week: "W2", conversion: 0.17 }, { week: "W3", conversion: 0.19 }, { week: "W4", conversion: 0.21 }],
  },
];

/* ---------- 收益中心(实际数与预测数分开,预测标注演示) ---------- */
export const FINANCE: FinanceSummary = {
  cost: 328, reached: 86, replied: 52, appointments: 34, visited: 27,
  consumption: 12680, profit: 12352,
  trend: [
    { month: "6月", cost: 120, revenue: 3120, predicted: 2900 },
    { month: "7月", cost: 186, revenue: 5210, predicted: 4800 },
    { month: "8月", cost: 240, revenue: 7480, predicted: 7100 },
    { month: "9月", cost: 265, revenue: 8920, predicted: 9100 },
    { month: "10月", cost: 296, revenue: 10850, predicted: 11400 },
    { month: "11月", cost: 328, revenue: 12680, predicted: 13200 },
  ],
};
