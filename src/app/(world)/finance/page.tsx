"use client";

/* 收益中心:漏斗 + 趋势图(实际 vs 预测分色区分),数字全部来自演示数据集 */
import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar,
} from "recharts";
import CatCharacter from "@/components/world/CatCharacter";
import { DemoTag, PageHeader, StatTile } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { FinanceSummary } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

export default function FinancePage() {
  const [f, setF] = useState<FinanceSummary | null>(null);
  useEffect(() => { dataProvider.getFinance().then(setF); }, []);

  if (!f) {
    return <div className="min-h-[40vh] grid place-items-center anim-breathe" style={{ color: "var(--ink-2)" }}>财务喵正在翻账本…</div>;
  }

  const funnel = [
    { label: "触达", v: f.reached, cat: "seller", color: "var(--brand)" },
    { label: "回复", v: f.replied, cat: "seller", color: "var(--cyan)" },
    { label: "预约", v: f.appointments, cat: "strategist", color: "var(--yellow)" },
    { label: "到店", v: f.visited, cat: "detective", color: "var(--orange)" },
    { label: "实际消费", v: f.consumption, cat: "accountant", color: "var(--green)" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="经营收益中心"
        desc="财务喵的账本:实际数据与预测数据分色呈现,不混淆、不美化。接入真实 Agent 后按日自动更新。"
        right={<DemoTag label="账本数据 · 演示" />}
      />

      {/* 总览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatTile label="预测回流" value={`¥${(f.predictedRevenue ?? 0).toLocaleString()}`} sub="策略预估(军师喵)" accent="var(--brand-2)" />
        <StatTile label="实际消费" value={`¥${(f.actualRevenue ?? f.consumption).toLocaleString()}`} sub="真实订单(剔除退款)" accent="var(--green)" />
        <StatTile label="AI 增量" value={`¥${(f.incrementalRevenue ?? 0).toLocaleString()}`} sub="AI 唤回归因订单" accent="var(--yellow)" />
        <StatTile label="营销成本" value={`¥${f.cost.toLocaleString()}`} sub={`AI 增量 ROI ${f.cost > 0 && f.incrementalRevenue ? ((f.incrementalRevenue / f.cost).toFixed(1) + " 倍") : "—"}`} accent="var(--red)" />
      </div>

      {/* 漏斗 + 每一环的猫员工 */}
      <div className="surface p-5">
        <h3 className="text-[15px] font-bold mb-4">唤醒漏斗 · 每一环都有负责员工</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {funnel.map((x, i) => {
            const emp = EMPLOYEE_MAP[x.cat as keyof typeof EMPLOYEE_MAP];
            const rate = i === 0 ? null : `${Math.round((x.v / funnel[i - 1].v) * 100)}%`;
            return (
              <div key={x.label} className="panel2 p-4 relative overflow-hidden">
                <div
                  className="absolute inset-x-0 bottom-0 h-1"
                  style={{ background: x.color, opacity: 0.8 }}
                />
                <CatCharacter colorway={emp.colorway} state="awake" accessory={emp.accessory} size={46} />
                <div className="text-[22px] font-extrabold mt-2">{x.v.toLocaleString()}</div>
                <div className="text-[12px] font-semibold">{x.label}</div>
                <div className="text-[10.5px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                  {emp.name}负责{i === funnel.length - 1
                    ? ` · 人均 ¥${Math.round(x.v / funnel[0].v)}`
                    : rate ? ` · 环比转化 ${rate}` : " · 起点"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 趋势:实际 vs 预测 */}
      <div className="surface p-5">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h3 className="text-[15px] font-bold">月度回流消费趋势</h3>
          <span className="text-[11.5px] inline-flex items-center gap-3" style={{ color: "var(--ink-2)" }}>
            <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-1.5 rounded-full" style={{ background: "var(--green)" }} />实际</span>
            <span className="inline-flex items-center gap-1"><i className="inline-block w-3 h-1.5 rounded-full" style={{ background: "var(--ink-3)" }} />预测(演示模型)</span>
          </span>
        </div>
        <p className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
          财务喵只对「实际」负责;预测线由规则模型生成,偏差会被写进复盘报告。
        </p>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={f.trend} margin={{ top: 8, right: 14, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--green)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--green)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--red)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--red)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--ink-3)", fontSize: 11.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="¥" width={64} />
              <Tooltip
                formatter={(v, name) => [`¥${Number(v).toLocaleString()}`, name as string]}
                contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Area type="monotone" dataKey="revenue" name="实际回流" stroke="var(--green)" strokeWidth={2.5} fill="url(#gRev)" />
              <Area type="monotone" dataKey="predicted" name="预测回流" stroke="var(--ink-3)" strokeWidth={1.8} strokeDasharray="6 5" fill="transparent" connectNulls />
              <Area type="monotone" dataKey="cost" name="营销成本" stroke="var(--red)" strokeWidth={2} fill="url(#gCost)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 成本结构 */}
      <div className="surface p-5">
        <h3 className="text-[15px] font-bold mb-1">成本与消费对照</h3>
        <p className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>每个月的绿色余量,就是醒醒喵给店里挣出来的增量。</p>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={f.trend} margin={{ top: 6, right: 14, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "var(--ink-3)", fontSize: 11.5 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="¥" width={64} />
              <Tooltip
                formatter={(v, name) => [`¥${Number(v).toLocaleString()}`, name as string]}
                contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar dataKey="cost" name="成本" fill="var(--red)" radius={[5, 5, 0, 0]} maxBarSize={30} />
              <Bar dataKey="revenue" name="回流消费" fill="var(--green)" radius={[5, 5, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
