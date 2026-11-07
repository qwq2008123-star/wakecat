"use client";

/* 全局壳:左侧导航(桌面)/ 抽屉(移动)+ 顶栏 */
import Link from "next/link";
import {
  usePathname } from "next/navigation";
import { useState, ReactNode } from "react";
import {
  LayoutDashboard, Cat, UsersRound, ClipboardList, BookOpen,
  TrendingUp, Bell, Menu, X, Settings, HeartHandshake,
  MessageSquareText,
} from "lucide-react";
import CatCharacter from "./CatCharacter";
import { StatusDot } from "./ui";

const NAV = [
  { href: "/dashboard", label: "经营驾驶舱", icon: LayoutDashboard },
  { href: "/agents", label: "AI 员工中心", icon: UsersRound },
  { href: "/members", label: "会员宇宙", icon: Cat },
  { href: "/tasks", label: "任务大厅", icon: ClipboardList },
  { href: "/contact-center", label: "联系决策", icon: HeartHandshake },
  { href: "/memory", label: "记忆博物馆", icon: BookOpen },
  { href: "/inbox", label: "会话接管", icon: MessageSquareText },
  { href: "/finance", label: "收益中心", icon: TrendingUp },
  { href: "/settings", label: "系统设置", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active = pathname === n.href || pathname.startsWith(n.href + "/");
        const Icon = n.icon;
        return (
          <Link
            key={n.href} href={n.href} onClick={onNavigate}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all"
            style={active
              ? { background: "linear-gradient(92deg, rgba(124,108,255,.18), rgba(124,108,255,.06))", color: "var(--brand-2)", boxShadow: "inset 0 0 0 1px rgba(124,108,255,.35)" }
              : { color: "var(--ink-2)" }}
          >
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {n.label}
          </Link>
        );
      })}
    </>
  );
}

function SidebarFooter() {
  return (
    <div className="mt-auto panel2 p-3 text-[11px]" style={{ color: "var(--ink-2)" }}>
      <div className="flex items-center gap-2 mb-1">
        <StatusDot color="var(--yellow)" pulse />
        <b style={{ color: "var(--ink)" }}>销售系统 · 本地真实数据库</b>
      </div>
      <p>经营数据来自本地 SQLite(60 名演示会员);角色设定与实验数据仍为 mock,已标注。</p>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const today = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg-0)" }}>
      {/* 桌面侧栏 */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-[224px] flex-col px-4 py-5 z-40"
        style={{ background: "linear-gradient(180deg, var(--panel) 0%, var(--bg-1) 100%)", borderRight: "1px solid var(--line)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1 mb-7">
          <CatCharacter state="awake" colorway="orange" accessory="crown" size={40} />
          <div>
            <div className="font-extrabold text-[15px] tracking-wide leading-tight">WAKECAT</div>
            <div className="text-[10px]" style={{ color: "var(--ink-3)" }}>醒醒喵 · AI 会员销售团队</div>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">{<NavLinks />}</nav>
        <SidebarFooter />
      </aside>

      {/* 移动抽屉 */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(5,7,15,.7)" }} />
          <aside
            className="absolute inset-y-0 left-0 w-[240px] flex flex-col px-4 py-5"
            style={{ background: "var(--panel)", borderRight: "1px solid var(--line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <CatCharacter state="awake" colorway="orange" accessory="crown" size={32} />
                <b>WAKECAT</b>
              </div>
              <button onClick={() => setOpen(false)} aria-label="关闭菜单"><X size={18} /></button>
            </div>
            <nav className="flex flex-col gap-1"><NavLinks onNavigate={() => setOpen(false)} /></nav>
            <SidebarFooter />
          </aside>
        </div>
      )}

      {/* 顶栏 */}
      <div className="lg:pl-[224px]">
        <header
          className="sticky top-0 z-30 flex items-center gap-3 px-4 md:px-7 py-3"
          style={{ background: "rgba(5,7,15,.78)", backdropFilter: "blur(14px)", borderBottom: "1px solid var(--line-soft)" }}
        >
          <button className="lg:hidden p-1.5" onClick={() => setOpen(true)} aria-label="打开菜单">
            <Menu size={19} />
          </button>
          <div className="hidden sm:flex items-center gap-2 text-[13px] font-semibold">
            <span>喵屋美甲 · 金山店</span>
            <span style={{ color: "var(--ink-3)" }}>·</span>
            <span className="font-normal" style={{ color: "var(--ink-2)" }}>{today}</span>
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            <button className="relative p-1.5 rounded-lg hover:bg-white/5" aria-label="通知">
              <Bell size={17} style={{ color: "var(--ink-2)" }} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: "var(--red)" }} />
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full grid place-items-center text-[12px] font-bold"
                style={{ background: "linear-gradient(135deg, var(--brand), var(--orange))", color: "#fff" }}
              >芳</div>
              <div className="hidden md:block text-[12.5px]">
                <div className="font-semibold leading-tight">芳姐</div>
                <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>老板 · 店主</div>
              </div>
            </div>
          </div>
        </header>
        <main className="px-4 md:px-7 py-6 max-w-[1240px] mx-auto pb-16">{children}</main>
      </div>
    </div>
  );
}
