/* ============================================================
   WAKECAT 数据类型(第一阶段 UI 的唯一事实来源)
   字段设计对齐未来的 Supabase 表结构,切换数据源时无需改 UI。
   ============================================================ */

export type Zone = "active" | "sleeping" | "premium" | "new" | "risk";
export type CatState = "happy" | "awake" | "drowsy" | "sleep";
export type RiskLevel = "low" | "mid" | "high";
export type MemberLevel = "普通" | "白银" | "黄金" | "钻石";
export type CatColorway = "orange" | "gray" | "calico" | "cow" | "ragdoll" | "purple";

export interface MemberCatView {
  id: string;
  name: string;
  phoneMasked: string;
  level: MemberLevel;
  zone: Zone;
  state: CatState;
  colorway: CatColorway;
  spend: number;
  visits: number;
  lastVisitDays: number;
  favoriteService: string;
  tags: string[];
  risk: RiskLevel;
  strategyHint: string;
  joinedAt: string;
  catName: string;
}

export type MemoryType =
  | "消费记忆" | "服务偏好" | "购买记录" | "沟通记录" | "特殊事件" | "会员反馈";

export interface MemoryEntry {
  id: string;
  memberId: string;
  type: MemoryType;
  content: string;
  source: string;          // 数据来源,如「消费流水 #cr_1042」「老板娘口述」
  recordedAt: string;
}

export type EmployeeId = "boss" | "detective" | "strategist" | "seller" | "accountant";

export interface Employee {
  id: EmployeeId;
  name: string;
  title: string;
  personality: string;      // 一句角色个性
  duties: string[];
  colorway: CatColorway;
  accessory: "crown" | "magnifier" | "scroll" | "envelope" | "coins";
  status: "working" | "waiting" | "idle";
  statusText: string;
  tasksDoneToday: number;
  currentTask: string;
  recentLogs: { time: string; text: string }[];
  greeting: string;
  sampleReplies: string[];  // 演示对话的固定回复池
  tools: { name: string; desc: string }[];
}

export type TaskStatus =
  | "pending_approval" | "approved" | "running" | "paused" | "completed" | "rejected";

export interface WakeTask {
  id: string;
  name: string;
  kind: string;             // 优惠券唤醒 / 新品推荐 / 权益提醒 / 轻回访 / 节日营销
  ownerId: EmployeeId;
  memberNames: string[];
  targetCount: number;
  cost: number;
  expectedRevenue: number;
  risk: RiskLevel;
  status: TaskStatus;
  progress: number;         // 0-100
  steps: { name: string; done: boolean }[];
  createdAt: string;
  engineNote: string;       // 引擎标注(演示)
}

export interface CampaignStrategy {
  id: string;
  name: string;
  kind: string;
  desc: string;
  members: number;
  converted: number;
  costPerMember: number;
  conversion: number;       // 0-1
  avgUplift: number;
  isDemo: true;             // 实验数据全部为演示
  trend: { week: string; conversion: number }[];
}

export interface FinancePoint {
  month: string;
  cost: number;
  revenue: number;          // 实际
  predicted: number;        // 预测(演示)
}

export interface FinanceSummary {
  cost: number;
  reached: number;
  replied: number;
  appointments: number;
  visited: number;
  consumption: number;
  profit: number;
  trend: FinancePoint[];
}

export interface WorkLog {
  id: string;
  time: string;
  employeeId: EmployeeId;
  text: string;
}

export interface DashboardData {
  greeting: string;
  dateLabel: string;
  goal: string;
  kpis: {
    totalMembers: number;
    activeMembers: number;
    sleepingMembers: number;
    highRiskMembers: number;
    awakenedThisMonth: number;
    monthCost: number;
    monthRevenue: number;
  };
  logs: WorkLog[];
  briefing: string;
}
