import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getLlmStatus } from "@/lib/queries";
import CatIcon from "@/components/CatIcon";
import { SidebarLink, LogoutButton } from "@/components/SidebarClient";

const NAV = [
  { href: "/dashboard", label: "经营驾驶舱", icon: "🧭" },
  { href: "/members", label: "会员中心", icon: "👤" },
  { href: "/tasks", label: "任务大厅", icon: "📋" },
  { href: "/cats", label: "猫咪世界", icon: "🐾" },
  { href: "/reports", label: "收益中心", icon: "📈" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const llm = await getLlmStatus(user.storeId);
  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-[212px] shrink-0 flex-col border-r px-4 py-5 gap-1" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
        <div className="flex items-center gap-2 px-2 mb-5">
          <CatIcon state="awake" colorway="orange" size={34} />
          <div>
            <div className="font-extrabold text-[15px] leading-tight">醒醒喵</div>
            <div className="text-[10px]" style={{ color: "var(--ink2)" }}>WAKECAT · AI 会员唤醒官</div>
          </div>
        </div>
        {NAV.map((n) => (
          <SidebarLink key={n.href} href={n.href} icon={n.icon} label={n.label} />
        ))}
        <div className="mt-auto panel2 p-3 text-[11px]" style={{ color: "var(--ink2)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${llm.hasKey ? "blink" : ""}`} style={{ background: llm.hasKey ? "var(--green)" : "var(--yellow)" }} />
            <b style={{ color: "var(--ink)" }}>{llm.hasKey ? `GLM · ${llm.model}` : "规则引擎模式"}</b>
          </div>
          <div>引擎:{llm.engineMode === "auto" ? "自动(LLM优先)" : llm.engineMode === "llm" ? "仅大模型" : "仅规则"}</div>
          {!llm.hasKey && <div className="mt-1" style={{ color: "var(--yellow)" }}>未配置 API Key → 设置页填入</div>}
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        {/* 顶栏 */}
        <div className="sticky top-0 z-40 backdrop-blur border-b px-5 md:px-8 py-3 flex items-center gap-3" style={{ borderColor: "var(--line)", background: "rgba(10,14,26,.8)" }}>
          <div className="md:hidden flex items-center gap-2 font-bold"><CatIcon state="awake" size={26} /> 醒醒喵</div>
          <div className="hidden md:block text-[13px]" style={{ color: "var(--ink2)" }}>喵屋美甲 · 金山店</div>
          <div className="ml-auto flex items-center gap-3 text-[12.5px]">
            <span className="tag">{user.role === "owner" ? "👑 老板娘" : "💅 店员"} {user.name}</span>
            <LogoutButton />
          </div>
        </div>
        <main className="px-5 md:px-8 py-6 max-w-[1200px]">{children}</main>
      </div>
    </div>
  );
}
