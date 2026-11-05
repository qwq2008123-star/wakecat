import {
  CampaignStrategy, DashboardData, Employee, EmployeeId, FinanceSummary,
  MemberCatView, MemoryEntry, TaskStatus, WakeTask,
} from "@/mock-data/types";
import { CAMPAIGNS, DASHBOARD, FINANCE, TASKS } from "@/mock-data/workspace";
import { EMPLOYEES, EMPLOYEE_MAP } from "@/mock-data/employees";
import { MEMBERS, MEMORIES } from "@/mock-data/members";

/* ============================================================
   数据提供者接口:第一阶段由 MockDataProvider 实现;
   第二阶段换 SupabaseProvider / AgentAPIProvider 时 UI 零改动。
   ============================================================ */
export interface WakeCatDataProvider {
  getDashboard(): Promise<DashboardData>;
  getEmployees(): Promise<Employee[]>;
  getEmployee(id: EmployeeId): Promise<Employee | null>;
  getMembers(): Promise<MemberCatView[]>;
  getMemories(memberId?: string): Promise<MemoryEntry[]>;
  getTasks(): Promise<WakeTask[]>;
  setTaskStatus(id: string, status: TaskStatus): Promise<WakeTask[]>;
  getCampaigns(): Promise<CampaignStrategy[]>;
  getFinance(): Promise<FinanceSummary>;
}

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

class MockDataProvider implements WakeCatDataProvider {
  private tasks: WakeTask[] = [...TASKS];

  async getDashboard() { await delay(); return DASHBOARD; }
  async getEmployees() { await delay(); return EMPLOYEES; }
  async getEmployee(id: EmployeeId) { await delay(); return EMPLOYEE_MAP[id] ?? null; }
  async getMembers() { await delay(); return MEMBERS; }
  async getMemories(memberId?: string) {
    await delay();
    return memberId ? MEMORIES.filter((m) => m.memberId === memberId) : MEMORIES;
  }
  async getTasks() { await delay(); return [...this.tasks]; }
  async setTaskStatus(id: string, status: TaskStatus) {
    await delay(200);
    this.tasks = this.tasks.map((t) => {
      if (t.id !== id) return t;
      let progress = t.progress;
      const steps = t.steps.map((s) => ({ ...s }));
      if (status === "approved") { steps[2].done = false; }
      if (status === "running") { progress = Math.max(progress, 70); }
      if (status === "paused" || status === "rejected") { progress = t.progress; }
      return { ...t, status, progress, steps };
    });
    return [...this.tasks];
  }
  async getCampaigns() { await delay(); return CAMPAIGNS; }
  async getFinance() { await delay(); return FINANCE; }
}

/* 未来在此切换:SupabaseProvider / HttpAgentProvider,UI 层无感知 */
export const dataProvider: WakeCatDataProvider = new MockDataProvider();
