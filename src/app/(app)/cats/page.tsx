import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { listCats } from "@/lib/queries";
import { STATE_META } from "@/components/ui";
import CatIcon from "@/components/CatIcon";

export default async function CatsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const members = await listCats(user.storeId);
  const groups = (["sick", "hibernate", "drowsy", "active"] as const).map((s) => ({
    state: s, list: members.filter((m) => m.state === s),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">🐾 猫咪世界</h1>
        <p className="text-[12.5px]" style={{ color: "var(--ink2)" }}>
          每个会员关联一只猫:会员活跃,猫就精神;会员沉睡,猫就打盹、冬眠。点击猫打开对应会员档案。
          猫咪状态是会员关系的可视化,不代表真实储值金额。
        </p>
      </div>
      {groups.map((g) => (
        <div key={g.state}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`tag ${STATE_META[g.state].cls}`}>{STATE_META[g.state].icon} {STATE_META[g.state].label}</span>
            <span className="text-[12px]" style={{ color: "var(--ink2)" }}>{g.list.length} 只</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {g.list.map((m) => (
              <Link key={m.id} href={`/members/${m.id}`} className="panel p-3 text-center hover:opacity-90 transition-opacity">
                <div className="grid place-items-center mb-1.5">
                  <CatIcon state={m.state === "active" ? "happy" : m.state === "drowsy" ? "drowsy" : "sleep"} colorway={m.catColorway} size={52} />
                </div>
                <div className="text-[12.5px] font-bold truncate">{m.name}</div>
                <div className="text-[10.5px]" style={{ color: "var(--ink2)" }}>Lv.{m.catLv} · {m.daysSinceVisit == null ? "从未到店" : `${m.daysSinceVisit}天`}</div>
                {m.decorations.length > 0 && (
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--yellow)" }}>{m.decorations.join(" ")}</div>
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
