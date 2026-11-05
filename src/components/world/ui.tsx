"use client";

/* 共享 UI 原语:统一圆角、间距、标签、标题 */
import { ReactNode } from "react";

export function PageHeader({ title, desc, right }: { title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight">{title}</h1>
        {desc && <p className="text-[13px] mt-1 max-w-[640px]" style={{ color: "var(--ink-2)" }}>{desc}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}

export function DemoTag({ label = "演示数据" }: { label?: string }) {
  return <span className="tag tag-demo">{label}</span>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[15px] font-bold tracking-wide">{children}</h2>
      {right}
    </div>
  );
}

export function StatTile({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: ReactNode; accent?: string;
}) {
  return (
    <div className="surface p-4 min-w-0">
      <div className="text-[11.5px] font-medium truncate" style={{ color: "var(--ink-2)" }}>{label}</div>
      <div className="text-[24px] font-extrabold mt-1 leading-none tracking-tight" style={{ color: accent ?? "var(--ink)" }}>{value}</div>
      {sub && <div className="text-[11px] mt-1.5" style={{ color: "var(--ink-3)" }}>{sub}</div>}
    </div>
  );
}

export function StatusDot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative inline-flex w-2 h-2">
      {pulse && <span className="absolute inset-0 rounded-full" style={{ background: color, animation: "pulse-ring 1.8s ease-out infinite" }} />}
      <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
