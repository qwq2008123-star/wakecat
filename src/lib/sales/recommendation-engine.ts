import { sqlite } from "../db/client";

/* ============================================================
   推荐引擎:军师喵的策略底座
   只从 store_services 真实目录读取价格/成本,绝不编造。
   ============================================================ */

export interface CatalogService {
  id: string; name: string; price: number; cost: number;
  durationMin: number; isNew: boolean;
}

export function getCatalog(storeId: string, opts?: { maxPrice?: number; onlyActive?: boolean }): CatalogService[] {
  const rows = sqlite.prepare(`
    SELECT id, name, price, cost, duration_min, is_new FROM store_services
    WHERE store_id = ? ${opts?.onlyActive === false ? "" : "AND status='active'"}
    ORDER BY price ASC
  `).all(storeId) as Record<string, unknown>[];
  let list: CatalogService[] = rows.map((r) => ({
    id: r.id as string, name: r.name as string,
    price: r.price as number, cost: r.cost as number,
    durationMin: r.duration_min as number, isNew: !!(r.is_new as number),
  }));
  if (opts?.maxPrice != null) list = list.filter((s) => s.price <= opts.maxPrice!);
  return list;
}

export interface ServiceRecommendation {
  service: CatalogService;
  reason: string;
  margin: number;               // price - cost
  confidence: number;           // 0-1
  discount: number;             // 0 = 不打折;由商家预算约束
}

/**
 * 为会员生成结构化推荐:优先匹配历史偏好,预算内可给替代方案。
 * discount 永远由调用方(商家授权/预算)决定,引擎只提议。
 */
export function recommendServices(opts: {
  storeId: string;
  favoriteService?: string | null;
  budget?: number;
  wantNew?: boolean;
  limit?: number;
}): ServiceRecommendation[] {
  const { storeId, favoriteService, budget, wantNew, limit = 3 } = opts;
  let catalog = getCatalog(storeId, { maxPrice: budget });
  if (wantNew) {
    const news = catalog.filter((s) => s.isNew);
    if (news.length) catalog = [...news, ...catalog.filter((s) => !s.isNew)];
  }
  // 与偏好前缀匹配的排前
  if (favoriteService) {
    catalog.sort((a, b) =>
      Number(b.name.includes(favoriteService.slice(0, 2))) - Number(a.name.includes(favoriteService.slice(0, 2))));
  }
  return catalog.slice(0, limit).map((s, i) => ({
    service: s,
    reason: favoriteService && s.name.includes(favoriteService.slice(0, 2))
      ? `与你常做的「${favoriteService}」同系列,价格 ¥${s.price} 在预算内`
      : `店内${s.isNew ? "本月新品" : "热门项目"},¥${s.price} · 约 ${s.durationMin} 分钟`,
    margin: s.price - s.cost,
    confidence: +(0.9 - i * 0.12).toFixed(2),
    discount: 0,
  }));
}

/** 询价:返回真实价格(不编造),可带组合建议 */
export function quoteService(storeId: string, keyword: string): {
  found: boolean; items: CatalogService[]; combos?: { name: string; total: number; items: string[] }[];
} {
  const all = getCatalog(storeId);
  const kw = keyword.trim();
  const items = all.filter((s) => s.name.includes(kw) || kw.includes(s.name.slice(0, 2)));
  if (!items.length) return { found: false, items: [] };
  const base = items[0];
  const care = all.find((s) => s.name.includes("手部护理"));
  const combos = care ? [{
    name: `${base.name} + ${care.name}`,
    total: +(base.price + care.price).toFixed(2),
    items: [base.name, care.name],
  }] : undefined;
  return { found: true, items: items.slice(0, 4), combos };
}
