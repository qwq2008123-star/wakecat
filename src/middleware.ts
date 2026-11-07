import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * B端页面守卫:没有会话 cookie 时跳登录页。
 * 注意:这只是体验层引导,真正的鉴权在各 API 路由(401)。
 * C端客户页 / 客户图片 / 登录页 / API 不拦。
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login")) return NextResponse.next();
  const hasSession = Boolean(req.cookies.get("wxcat_session")?.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!customer|api|img|login|_next/static|_next/image|favicon.ico).*)"],
};
