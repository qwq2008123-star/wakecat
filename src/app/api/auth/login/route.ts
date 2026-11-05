import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { staffUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE } from "@/lib/session";
import { audit } from "@/lib/services";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { as = "owner" } = await req.json().catch(() => ({ as: "owner" }));
  const role = as === "staff" ? "staff" : "owner";
  const rows = await db.select().from(staffUsers).where(eq(staffUsers.role, role)).limit(1);
  const u = rows[0];
  if (!u) return NextResponse.json({ error: "演示账号缺失,请先初始化" }, { status: 500 });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, u.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 * 7 });
  await audit(u.name, "auth.login", u.id, { role });
  return NextResponse.json({ ok: true, user: { name: u.name, role: u.role } });
}
