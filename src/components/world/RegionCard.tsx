"use client";

/* 生态区域卡片:主题布景 + 区域信息 + AI 经营建议 + 猫咪角色预览(角落错落探头,非排队) */
import { ArrowUpRight } from "lucide-react";
import CatCharacter from "./CatCharacter";
import ZoneBackdrop from "./ZoneBackdrop";
import { MemberCatView, Zone } from "@/mock-data/types";

export default function RegionCard({ title, desc, advice, accent, count, extraNote, backdrop, previewMembers, onClick }: {
  title: string;
  desc: string;
  advice: string;
  accent: string;
  count: number;
  extraNote?: string;
  backdrop: Zone;                 // 决定用哪套 SVG 场景
  previewMembers: MemberCatView[];
  onClick: () => void;
}) {
  const preview = previewMembers.slice(0, 3);
  const sizes = [58, 46, 40];

  return (
    <button
      onClick={onClick}
      className="surface relative overflow-hidden text-left p-5 group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-2)] w-full"
      style={{ minHeight: 176 }}
    >
      <ZoneBackdrop zone={backdrop} />
      {/* 猫咪预览:右下角错落探头 */}
      <div className="absolute right-4 bottom-3 z-10 pointer-events-none">
        {preview.map((m, i) => (
          <div
            key={m.id}
            className="absolute transition-transform duration-300 group-hover:-translate-y-1.5"
            style={{
              right: i * 46, bottom: i === 1 ? 16 : 5,
              transform: `rotate(${(i - 1) * 5}deg)`,
              zIndex: 3 - i,
            }}
          >
            <CatCharacter
              colorway={m.colorway}
              state={m.state}
              size={sizes[i] ?? 40}
              badge={m.zone === "premium" ? "premium" : m.risk === "high" ? "risk" : null}
            />
          </div>
        ))}
      </div>

      <div className="relative z-10 pr-[108px]">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[16px] font-extrabold tracking-wide" style={{ color: accent }}>{title}</h3>
          <span className="tag" style={{ color: accent, borderColor: accent }}>{count} 只档案猫</span>
        </div>
        <p className="text-[12px] mt-1" style={{ color: "var(--ink-2)" }}>{desc}{extraNote ? ` · ${extraNote}` : ""}</p>
        <div className="mt-3 flex items-start gap-1.5">
          <span className="tag tag-brand shrink-0 mt-px">AI 建议</span>
          <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "var(--ink-2)" }}>{advice}</p>
        </div>
        <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--brand-2)" }}>
          进入街区 <ArrowUpRight size={13} />
        </div>
      </div>
      <div className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent 70%)`, opacity: .7 }} />
    </button>
  );
}
