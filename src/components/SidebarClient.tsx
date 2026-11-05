"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[13.5px] font-semibold transition-colors"
      style={active
        ? { background: "rgba(124,108,255,.14)", color: "var(--brand2)" }
        : { color: "var(--ink2)" }}
    >
      <span>{icon}</span> {label}
    </Link>
  );
}

export function LogoutButton() {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >退出</button>
  );
}
