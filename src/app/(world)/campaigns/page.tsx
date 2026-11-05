"use client";

/* 营销实验室:策略卡片 + 实验对比图表(Recharts),全部标注演示数据 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import CatCharacter from "@/components/world/CatCharacter";
import { DemoTag, PageHeader } from "@/components/world/ui";
import { dataProvider } from "@/lib/data-provider";
import { CampaignStrategy, EmployeeId } from "@/mock-data/types";
import { EMPLOYEE_MAP } from "@/mock-data/employees";

/* 每种策略的主办员工(演示设定) */
const OWNER: Record<string, EmployeeId> = {
  优惠券唤醒: "strategist",
  权益提醒: "strategist",
  新品推荐: "seller",
  套餐复购: "detective",
  人工关系修复: "boss",
  节日营销: "seller",
};

export default function CampaignsPage() {
  const [list, setList] = useState<CampaignStrategy[]>([]);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => { dataProvider.getCampaigns().then((c) => { setList(c); setActive(c[0]?.id ?? null); }); }, []);

  const activeStrategy = useMemo(() => {
    const c = list.find((x) => x.id === active);
    if (!c) return null;
    return { ...c, trend: c.trend.map((t) => ({ week: t.week, conversion: +(t.conversion * 100).toFixed(1) })) };
  }, [list, active]);
  const compareData = useMemo(
    () => list.map((c) => ({ name: c.name, 转化率: +(c.conversion * 100).toFixed(1), 客单增量: c.avgUplift })),
    [list],
  );
  const roiData = useMemo(
    () => list.map((c) => ({
      name: c.name,
      ROI: c.costPerMember === 0 ? null : +(c.avgUplift / Math.max(c.costPerMember, 1)).toFixed(1),
      每人成本: c.costPerMember,
    })),
    [list],
  );

  if (!list.length) {
    return <div className="min-h-[40vh] grid place-items-center anim-breathe" style={{ color: "var(--ink-2)" }}>实验室烧杯加热中…</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="营销实验室"
        desc="军师喵的策略试验田:同一批沉睡会员,不同打法跑出不同转化。以下实验数据全部为演示,接入真实 Agent 后由回流数据自动更新。"
        right={<DemoTag label="实验数据 · 演示" />}
      />

      {/* 策略卡片墙:横向卷轴式,选中放大 */}
      <div className="flex gap-3.5 overflow-x-auto pb-3 -mx-1 px-1">
        {list.map((c, i) => {
          const activeCard = c.id === active;
          const owner = EMPLOYEE_MAP[OWNER[c.kind] ?? "strategist"];
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              onClick={() => setActive(c.id)}
              className={`surface shrink-0 w-[248px] text-left p-4 transition-all cursor-pointer ${activeCard ? "glow-brand" : "opacity-80 hover:opacity-100"}`}
              style={activeCard ? { borderColor: "var(--brand)" } : {}}
            >
              <div className="flex items-center gap-3">
                <CatCharacter colorway={owner.colorway} state="awake" accessory={owner.accessory} size={44} />
                <div className="min-w-0">
                  <b className="text-[14.5px] block truncate">{c.name}</b>
                  <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>{owner.name} 主导 · {c.members} 人参与</span>
                </div>
              </div>
              <p className="text-[12px] mt-2.5 leading-relaxed line-clamp-2" style={{ color: "var(--ink-2)" }}>{c.desc}</p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-[22px] font-extrabold" style={{ color: "var(--green)" }}>
                    {(c.conversion * 100).toFixed(1)}%
                  </div>
                  <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>唤醒转化率</div>
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-bold">¥{c.avgUplift}</div>
                  <div className="text-[10.5px]" style={{ color: "var(--ink-3)" }}>人均回流</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* 选中策略详情 + 四周趋势 */}
      {activeStrategy && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="surface p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[15px] font-bold">{activeStrategy.name} · 四周转化曲线</h3>
              <DemoTag />
            </div>
            <p className="text-[12px] mb-4" style={{ color: "var(--ink-2)" }}>{activeStrategy.desc}</p>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeStrategy.trend} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "转化率"]}
                    contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
                  />
                  {/* trend.conversion 已在 useMemo 中换算为百分数 */}
                  <Line type="monotone" dataKey="conversion" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 3.5, fill: "var(--orange)", strokeWidth: 0 }} name="转化率" unit="%" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[15px] font-bold">策略 ROI 对比(成本视角)</h3>
              <DemoTag />
            </div>
            <p className="text-[12px] mb-4" style={{ color: "var(--ink-2)" }}>
              权益提醒与人工修复几乎零成本,ROI 天然占优;优惠券胜在规模化。
            </p>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roiData} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--ink-3)", fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v, name) => [name === "ROI" ? `${v} 倍` : `¥${v}`, name as string]}
                    contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11.5 }} />
                  <Bar dataKey="ROI" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="每人成本" fill="var(--orange)" radius={[6, 6, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* 全量对比总表 */}
      <div className="surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-bold">全部策略横向对比</h3>
          <DemoTag />
        </div>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData} margin={{ top: 6, right: 12, bottom: 4, left: -14 }}>
              <CartesianGrid stroke="var(--line-soft)" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--ink-3)", fontSize: 10.5 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis yAxisId="l" tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
              <YAxis yAxisId="r" orientation="right" tick={{ fill: "var(--ink-3)", fontSize: 11 }} axisLine={false} tickLine={false} unit="元" />
              <Tooltip
                contentStyle={{ background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12 }}
                formatter={(v, name) => [name === "转化率" ? `${v}%` : `¥${v}`, name as string]}
              />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
              <Bar yAxisId="l" dataKey="转化率" fill="var(--brand)" radius={[6, 6, 0, 0]} maxBarSize={30} />
              <Bar yAxisId="r" dataKey="客单增量" fill="var(--orange)" radius={[6, 6, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
