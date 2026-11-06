import {
  CampaignStrategy, DashboardData, Employee, EmployeeId, FinanceSummary,
  MemberCatView, MemoryEntry, TaskStatus, WakeTask,
} from "@/mock-data/types";
import { CAMPAIGNS, FINANCE } from "@/mock-data/workspace";
import { EMPLOYEES, EMPLOYEE_MAP } from "@/mock-data/employees";
import { MEMBERS, MEMORIES } from "@/mock-data/members";
import { DASHBOARD, TASKS as TASKS_MOCK } from "@/mock-data/workspace";

/* ============================================================
   数据提供者接口
   阶段①:dashboard/members/memories/tasks/finance 走真实 SQLite API;
   employees(角色设定)/campaigns(实验数据)保留 Mock,界面已标注「演示」。
   第二阶段:换 SupabaseProvider,UI 零改动。
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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `接口错误 ${res.status}`);
  }
  return res.json() as Promise<T>;
}

class HttpApiProvider implements WakeCatDataProvider {
  async getDashboard() { return api<DashboardData>("/api/data/dashboard"); }
  async getEmployees() { await delay(80); return EMPLOYEES; }
  async getEmployee(id: EmployeeId) { await delay(80); return EMPLOYEE_MAP[id] ?? null; }
  async getMembers() { return api<MemberCatView[]>("/api/data/members"); }
  async getMemories(memberId?: string) {
    return api<MemoryEntry[]>(`/api/data/memories${memberId ? `?memberId=${memberId}` : ""}`);
  }
  async getTasks() { return api<WakeTask[]>("/api/data/tasks"); }
  async setTaskStatus(id: string, status: TaskStatus) {
    if (status === "approved" || status === "rejected") {
      await api(`/api/tasks/${id}/decide`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve: status === "approved" }),
      });
    } else if (status === "paused" || status === "running") {
      await api(`/api/tasks/${id}/pause`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pause: status === "paused" }),
      });
    }
    return this.getTasks();
  }
  async getCampaigns() { await delay(80); return CAMPAIGNS; }
  async getFinance() { return api<FinanceSummary>("/api/data/finance"); }
}

/* 演示回退:接口不可用时仍可浏览(所有页面已自带「演示」标注) */
class MockDataProvider implements WakeCatDataProvider {
  private tasks: WakeTask[] = [...TASKS_MOCK];
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
    await delay(150);
    this.tasks = this.tasks.map((t) => (t.id === id
      ? { ...t, status, progress: status === "completed" ? 100 : t.progress }
      : t));
    return [...this.tasks];
  }
  async getCampaigns() { await delay(); return CAMPAIGNS; }
  async getFinance() { await delay(); return FINANCE; }
}

export const dataProvider: WakeCatDataProvider = new HttpApiProvider();
export { MockDataProvider };
