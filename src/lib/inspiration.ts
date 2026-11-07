import { sqlite } from "./db/client";
import { getLlmConfig, LlmConfig } from "./llm";
import { getCatalog, CatalogService } from "./sales/recommendation-engine";
import { saveExtractedMemories, ExtractedMemory } from "./memory/extractor";
import { awardEnergy, awardBond } from "./cats/engine";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/* ============================================================
   阶段④ 灵感收藏室:发图 → GLM-4V 看图 → 风格标签 → 归主题
   → 匹配店内真实服务 → 顺手写进闺蜜猫的记忆。
   诚实降级:没 Key / 视觉模型失败时,图片照常收藏,
   标签来源标注 manual(用户备注)/ failed(AI 没看懂)。
   ============================================================ */

const VISION_MODEL = "glm-4v-flash"; // 智谱免费视觉模型,OpenAI 兼容格式
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export interface InspirationAnalysis {
  title: string;
  theme: string;           // 归类主题,如「蓝色系」「法式」
  tags: string[];          // 风格标签
  catComment: string;      // 闺蜜猫的点评
  engine: "llm" | "manual" | "failed";
}

export interface InspirationItemView {
  id: string;
  title: string;
  note: string | null;
  imageUrl: string | null;
  tags: string[];
  catNote: string | null;
  themeName: string | null;
  source: string;
  createdAt: string;
  matchedServices: { id: string; name: string; price: number; durationMin: number }[];
}

const rid = (p: string) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

/* ---------- GLM-4V 看图 ---------- */
async function visionAnalyze(config: LlmConfig, imageDataUrl: string, note: string): Promise<InspirationAnalysis | null> {
  if (!config.apiKey) return null;
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageDataUrl } },
            { type: "text", text: `你是美甲店会员的闺蜜猫,会员${note ? `补充说:「${note}」` : "发来一张喜欢的美甲图"}。看图输出 JSON(禁止多余文字):\n{"title":"10字内图片标题","theme":"归类主题(如 蓝色系/法式/猫眼/短甲纯色)","tags":["风格标签,3-5个"],"catComment":"闺蜜口吻点评,30字内,提到适合她"}\n只从图里看到的内容取材,不要编造品牌。` },
          ],
        }],
        temperature: 0.5,
        max_tokens: 400,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error(`[inspiration] GLM-4V HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const raw: string | undefined = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const p = JSON.parse(json) as Partial<InspirationAnalysis>;
    if (!p.title || !Array.isArray(p.tags)) return null;
    return {
      title: String(p.title).slice(0, 24),
      theme: String(p.theme || "未分类").slice(0, 12),
      tags: p.tags.slice(0, 6).map((t) => String(t).slice(0, 10)),
      catComment: String(p.catComment || "").slice(0, 80),
      engine: "llm",
    };
  } catch (e) {
    console.error("[inspiration] GLM-4V 异常:", e instanceof Error ? e.message : e);
    return null;
  }
}

/* ---------- 标签 × 真实目录匹配 ---------- */
export function matchServices(storeId: string, tags: string[], title: string): CatalogService[] {
  const catalog = getCatalog(storeId);
  const words = [...tags, title].join(" ");
  return catalog
    .map((s) => {
      let score = 0;
      for (const t of tags) if (t.length >= 2 && s.name.includes(t.slice(0, 2))) score += 2;
      for (const ch of new Set(words.replace(/\s/g, ""))) if (s.name.includes(ch)) score += 0.3;
      return { s, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.s);
}

/* ---------- 主题归档:同名自动主题复用 ---------- */
function assignTheme(storeId: string, userId: string, name: string): string {
  const existing = sqlite.prepare(
    "SELECT id FROM inspiration_themes WHERE store_id = ? AND user_id = ? AND name = ?"
  ).get(storeId, userId, name) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = rid("th");
  sqlite.prepare(
    "INSERT INTO inspiration_themes (id, store_id, user_id, name, auto, created_at) VALUES (?,?,?,?,1,?)"
  ).run(id, storeId, userId, name, nowIso());
  return id;
}

/* ---------- 保存图片文件,返回可访问的 API 路径 ---------- */
async function saveImageFile(dataUrl: string): Promise<string | null> {
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const ext = m[1] === "png" ? "png" : m[1] === "webp" ? "webp" : "jpg";
  const buf = Buffer.from(m[2], "base64");
  if (buf.length > 5 * 1024 * 1024) return null; // 5MB 上限
  const id = rid("img");
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, `${id}.${ext}`), buf);
  return `/api/img/${id}.${ext}`;
}

/* ---------- 主入口:收藏 + 分析 ---------- */
export async function collectInspiration(opts: {
  storeId: string; userId: string; catId: string | null;
  imageDataUrl?: string; note?: string; source?: string;
}): Promise<{
  item: InspirationItemView; analysis: InspirationAnalysis;
  newMemories: string[]; energyDelta: number; imageError?: string;
}> {
  const { storeId, userId, catId } = opts;
  const note = (opts.note ?? "").slice(0, 120);
  const config = await getLlmConfig(storeId);

  // 1. 存图
  let imagePath: string | null = null, imageError: string | undefined;
  if (opts.imageDataUrl) {
    imagePath = await saveImageFile(opts.imageDataUrl);
    if (!imagePath) imageError = "图片格式不支持或超过 5MB";
  }

  // 2. 看图(GLM-4V)→ 诚实降级
  let analysis: InspirationAnalysis;
  const vision = imagePath && !imageError ? await visionAnalyze(config, opts.imageDataUrl!, note) : null;
  if (vision) {
    analysis = vision;
  } else if (note) {
    analysis = {
      title: note.slice(0, 16), theme: "手动收藏",
      tags: note.split(/[,,、\s]+/).filter(Boolean).slice(0, 4),
      catComment: imagePath ? "图我先收好啦,你说说哪里喜欢,我记下来~" : "记下来了!",
      engine: "manual",
    };
  } else {
    analysis = {
      title: imagePath ? "灵感图片" : "灵感速记", theme: "未分类", tags: [],
      catComment: imagePath ? "这张我还没看懂,你说两句它哪里好看?我马上记~" : "想收藏点什么,写一句吧~",
      engine: imagePath ? "failed" : "manual",
    };
  }

  // 3. 入库 + 归主题
  const themeId = analysis.tags.length || analysis.theme !== "未分类" ? assignTheme(storeId, userId, analysis.theme) : null;
  const id = rid("ii");
  sqlite.prepare(`
    INSERT INTO inspiration_items (id, store_id, user_id, theme_id, title, note, image_path, style_tags_json, cat_note, source, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, storeId, userId, themeId, analysis.title, note || null, imagePath,
    JSON.stringify(analysis.tags), analysis.catComment, opts.source ?? "upload", nowIso());

  // 4. 闺蜜猫的记忆:风格偏好写进去(未确认的 AI 推测,用户可在成长中心纠正)
  const newMemories: string[] = [];
  if (analysis.tags.length) {
    const items: ExtractedMemory[] = [{
      memoryType: "short_term_interest",
      category: "style",
      attribute: "近期喜欢的风格",
      value: analysis.tags.join("、"),
      confidence: analysis.engine === "llm" ? 0.75 : 0.5,
    }];
    const r = saveExtractedMemories({ storeId, userId, catId: catId ?? "", items, source: "inspiration", sourceRef: id });
    if (r.saved + r.updated > 0) newMemories.push(`近期喜欢的风格: ${analysis.tags.join("、")}`);
  }

  // 5. 能量(分享款式 +3,防刷)+ 亲密度
  let energyDelta = 0;
  if (catId && (imagePath || note)) {
    const hash = Buffer.from(`${imagePath ?? ""}|${note}`).toString("base64").slice(0, 20);
    const e = awardEnergy({
      catId, userId, action: "share_style",
      relatedType: "inspiration", relatedId: id,
      dedupeKey: `share_style:${catId}:${hash}`,
    });
    if (e.ok) { energyDelta = e.delta; awardBond(catId, userId, "share_style", "分享灵感"); }
  }

  return { item: toItem(rowById(id)), analysis, newMemories, energyDelta, imageError };
}

/* ---------- 查询 ---------- */
interface ItemRow {
  id: string; store_id: string; theme_id: string | null; title: string; note: string | null;
  image_path: string | null; style_tags_json: string; cat_note: string | null;
  source: string; created_at: string;
}
function rowById(id: string): ItemRow {
  return sqlite.prepare("SELECT * FROM inspiration_items WHERE id = ?").get(id) as ItemRow;
}
function toItem(row: ItemRow): InspirationItemView {
  const tags: string[] = JSON.parse(row.style_tags_json || "[]");
  const theme = row.theme_id
    ? sqlite.prepare("SELECT name FROM inspiration_themes WHERE id = ?").get(row.theme_id) as { name: string } | undefined
    : undefined;
  return {
    id: row.id, title: row.title, note: row.note,
    imageUrl: row.image_path, tags, catNote: row.cat_note,
    themeName: theme?.name ?? null, source: row.source, createdAt: row.created_at,
    matchedServices: matchServicesByRow(row, tags),
  };
}
function matchServicesByRow(row: ItemRow, tags: string[]) {
  // 按标签 + 标题匹配当前在售目录
  const hit = matchServices(row.store_id, tags, row.title);
  return hit.map((s) => ({ id: s.id, name: s.name, price: s.price, durationMin: s.durationMin }));
}

export function listInspiration(storeId: string, userId: string): {
  themes: { id: string; name: string; count: number }[];
  items: InspirationItemView[];
} {
  const rows = sqlite.prepare(`
    SELECT * FROM inspiration_items WHERE store_id = ? AND user_id = ? AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 60
  `).all(storeId, userId) as unknown as ItemRow[];
  const items = rows.map(toItem);
  const themeRows = sqlite.prepare(`
    SELECT t.id, t.name, COUNT(i.id) AS count FROM inspiration_themes t
    LEFT JOIN inspiration_items i ON i.theme_id = t.id AND i.deleted_at IS NULL
    WHERE t.store_id = ? AND t.user_id = ?
    GROUP BY t.id ORDER BY t.created_at ASC
  `).all(storeId, userId) as unknown as { id: string; name: string; count: number }[];
  return { themes: themeRows, items };
}

export function deleteInspiration(storeId: string, userId: string, itemId: string): boolean {
  const r = sqlite.prepare(`
    UPDATE inspiration_items SET deleted_at = ?
    WHERE id = ? AND store_id = ? AND user_id = ? AND deleted_at IS NULL
  `).run(nowIso(), itemId, storeId, userId);
  return r.changes > 0;
}
