"use client";

/* 精致会员卡:头像只作身份形象,信息清晰分层,底部 AI 推荐操作 */
import CatCharacter from "./CatCharacter";
import { ZONE_META } from "@/mock-data/members";
import { MemberCatView } from "@/mock-data/types";

const RISK_DOT = { high: "var(--red)", mid: "var(--yellow)", low: "var(--green)" } as const;

export default function MemberCard({ member, onOpen }: { member: MemberCatView; onOpen: () => void }) {
  const meta = ZONE_META[member.zone];
  const isNew = member.zone === "new";
  return (
    <button
      onClick={onOpen}
      className="surface relative overflow-hidden text-left p-4 group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-2)] w-full"
    >
      {/* 街区色脊线 */}
      <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full" style={{ background: meta.accent, opacity: .55 }} />

      <div className="flex gap-3.5">
        {/* 头像(身份形象,不占主体) */}
        <div className="shrink-0 relative">
          <CatCharacter
            colorway={member.colorway} state={member.state} size={56}
            badge={member.zone === "premium" ? "premium" : null}
          />
          {member.risk === "high" && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ background: "var(--red)", boxShadow: "0 0 6px var(--red)" }} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <b className="text-[14.5px]">{member.name}</b>
            <span className="tag tag-brand">{member.level}</span>
            {isNew && <span className="tag tag-cyan">新村民</span>}
            <span
              className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold"
              style={{ color: RISK_DOT[member.risk] }}
              title={`流失风险:${member.risk === "high" ? "高" : member.risk === "mid" ? "中" : "低"}`}
            >
              <i className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: RISK_DOT[member.risk] }} />
              {member.risk === "high" ? "风险高" : member.risk === "mid" ? "风险中" : "风险低"}
            </span>
          </div>
          <div className="text-[12px] mt-1 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: "var(--ink-2)" }}>
            <span>最近消费 <b style={{ color: member.lastVisitDays > 75 ? "var(--red)" : "var(--ink)" }}>{member.lastVisitDays} 天前</b></span>
            <span>累计 <b style={{ color: "var(--ink)" }}>¥{member.spend.toLocaleString()}</b></span>
            <span className="hidden sm:inline">偏好 {member.favoriteService}</span>
          </div>
        </div>
      </div>

      {/* AI 推荐操作 */}
      <div className="mt-3 pt-2.5 flex items-start gap-1.5" style={{ borderTop: "1px dashed var(--line-soft)" }}>
        <span className="tag tag-yellow shrink-0 mt-px">AI 操作</span>
        <p className="text-[11.5px] leading-relaxed line-clamp-1" style={{ color: "var(--ink-2)" }}>{member.strategyHint}</p>
      </div>
    </button>
  );
}
