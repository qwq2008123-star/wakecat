import { sqlite } from "./db/client";

/* 单店演示:slug → 店铺。多店时代换成按 slug 查 stores 表 + 租户校验 */
const SLUG_MAP: Record<string, string> = {
  miaowu: "store_demo_001",
};

export function resolveStore(slug: string): { id: string; name: string } | null {
  const storeId = SLUG_MAP[slug];
  if (!storeId) return null;
  const row = sqlite.prepare("SELECT id, name, owner_name FROM stores WHERE id = ?").get(storeId) as
    | { id: string; name: string; owner_name: string }
    | undefined;
  return row ? { id: row.id, name: row.name } : null;
}

export const DEFAULT_STORE_SLUG = "miaowu";
