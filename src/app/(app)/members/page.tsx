import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { listMembers } from "@/lib/queries";
import { StateBadge, DemoBadge } from "@/components/ui";
import CatIcon from "@/components/CatIcon";

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "active", label: "🐟 活跃" },
  { key: "drowsy", label: "😪 打瞌睡" },
  { key: "hibernate", label: "❄️ 冬眠" },
  { key: "sick", label: "😿 卡快过期" },
  { key: "high_value", label: "💎 高价值" },
] as const;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await getSessionUser();
  if (!user) return null;
  const { f } = await searchParams;
  const filter = (FILTERS.find((x) => x.key === f)?.key ?? "all") as typeof FILTERS[number]["key"];
  const members = await listMembers(user.storeId, filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-extrabold">会员中心</h1>
        <DemoBadge />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/members?f=${x.key}`} className="tag" style={filter === x.key ? { borderColor: "var(--brand)", color: "var(--brand2)", background: "rgba(124,108,255,.1)" } : {}}>
            {x.label}
          </Link>
        ))}
      </div>
      <div className="panel overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left" style={{ color: "var(--ink2)", background: "var(--panel2)" }}>
              <th className="px-4 py-2.5 font-semibold">会员</th>
              <th className="px-3 py-2.5 font-semibold">猫状态</th>
              <th className="px-3 py-2.5 font-semibold">最近到店</th>
              <th className="px-3 py-2.5 font-semibold">上次项目</th>
              <th className="px-3 py-2.5 font-semibold text-right">累计消费</th>
              <th className="px-4 py-2.5 font-semibold text-right">到店次数</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t hover:bg-white/[.02]" style={{ borderColor: "var(--line)" }}>
                <td className="px-4 py-2.5">
                  <Link href={`/members/${m.id}`} className="hover:underline font-semibold">{m.name}</Link>
                  <span className="mono ml-2" style={{ color: "var(--ink2)" }}>{m.phoneMasked}</span>
                  <span className="ml-1.5 tag">{m.level}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <CatIcon state={m.state === "active" ? "happy" : m.state === "drowsy" ? "drowsy" : "sleep"} colorway={m.catColorway} size={30} />
                    <StateBadge state={m.state} />
                  </div>
                </td>
                <td className="px-3 py-2.5" style={{ color: m.daysSinceVisit != null && m.daysSinceVisit > 75 ? "var(--red)" : "inherit" }}>
                  {m.daysSinceVisit == null ? "—" : `${m.daysSinceVisit} 天前`}
                </td>
                <td className="px-3 py-2.5" style={{ color: "var(--ink2)" }}>{m.lastService ?? "—"}</td>
                <td className="px-3 py-2.5 text-right mono">¥{Math.round(m.totalSpend)}</td>
                <td className="px-4 py-2.5 text-right mono">{m.visits}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 && (
          <div className="p-8 text-center text-[13px]" style={{ color: "var(--ink2)" }}>该筛选下暂无会员</div>
        )}
      </div>
    </div>
  );
}
