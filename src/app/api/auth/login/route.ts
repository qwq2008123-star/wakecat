import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { staffUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE } from "@/lib/session";
import { audit } from "@/lib/services";
import { hashPassword } from "@/lib/seed-data";
import { cookies } from "next/headers";

/** 登录:密码校验(sha256 加盐)。生产部署用 WAKECAT_OWNER_PASSWORD 种子化 */
export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const rows = await db.select().from(staffUsers).where(eq(staffUsers.role, "owner")).limit(1);
  const u = rows[0];
  if (!u) return NextResponse.json({ error: "账号缺失,请先初始化" }, { status: 500 });
  if (!u.passwordHash) {
    return NextResponse.json(
      { error: "尚未设置登录密码:在部署环境配置 WAKECAT_OWNER_PASSWORD 后重新初始化数据库" },
      { status: 403 },
    );
  }
  if (hashPassword(String(password ?? ""), u.id) !== u.passwordHash) {
    return NextResponse.json({ error: "密码不对" }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, u.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 * 7 });
  await audit(u.name, "auth.login", u.id, { role: u.role });
  return NextResponse.json({ ok: true, user: { name: u.name, role: u.role } });
}
