import { cookies } from "next/headers";
import { db } from "./db/client";
import { staffUsers } from "./db/schema";
import { eq } from "drizzle-orm";
import { ensureBootstrap } from "./bootstrap";

export const SESSION_COOKIE = "wxcat_session";

export type SessionUser = {
  id: string;
  storeId: string;
  name: string;
  role: "owner" | "staff";
};

export async function getSessionUser(): Promise<SessionUser | null> {
  await ensureBootstrap();
  const jar = await cookies();
  const uid = jar.get(SESSION_COOKIE)?.value;
  if (!uid) {
    // 自动老板娘身份:仅限本地演示(必须显式设置 WAKECAT_AUTO_OWNER=1)。
    // 生产环境(Vercel 等)不设该变量 → 未登录一律 401,走 /api/auth/login。
    if (process.env.WAKECAT_AUTO_OWNER !== "1") return null;
    const rows = await db.select().from(staffUsers).where(eq(staffUsers.role, "owner")).limit(1);
    const u = rows[0];
    return u ? { id: u.id, storeId: u.storeId, name: u.name, role: "owner" } : null;
  }
  const rows = await db.select().from(staffUsers).where(eq(staffUsers.id, uid)).limit(1);
  const u = rows[0];
  if (!u) return null;
  return { id: u.id, storeId: u.storeId, name: u.name, role: u.role as "owner" | "staff" };
}

/** 服务端 API 用的强校验:未登录直接抛 401 */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new HttpError(401, "未登录");
  return u;
}

/** 敏感操作(审批/设置)需要 owner 角色 */
export async function requireOwner(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== "owner") throw new HttpError(403, "该操作需要老板(店长)权限");
  return u;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
