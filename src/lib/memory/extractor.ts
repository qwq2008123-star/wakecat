import { db, sqlite } from "../db/client";
import {
  userMemories, userPreferences, memoryFeedback, cats,
} from "../db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getLlmConfig, LlmConfig } from "../llm";

/* ============================================================
   WAKE MEMORY ENGINE · 记忆提取与检索
   - 五种记忆:长期偏好 / 短期兴趣 / 行为 / 交易 / 互动
   - AI 推测永远带 confidence < 1 且 user_confirmed = 0,
     用户明确说出口的 = confidence 1 + user_confirmed 1
   - 检索权重独立计算(类型权重 × 置信度 × 衰减),不写死在 Prompt
   - 用户可查看 / 修改 / 删除自己的记忆
   ============================================================ */

export type MemoryType =
  | "long_term_preference" | "short_term_interest" | "behavior" | "transaction" | "interaction";

export const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  long_term_preference: "长期偏好",
  short_term_interest: "短期兴趣",
  behavior: "行为记忆",
  transaction: "交易记忆",
  interaction: "互动记忆",
};

/** 记忆权重:类型权重 × 置信度;短期兴趣随天数衰减,长期/交易不因时间衰减 */
export function memoryWeight(m: {
  memoryType: string; confidence: number; updatedAt: string; userConfirmed: number;
}): number {
  const days = Math.max(0, (Date.now() - new Date(m.updatedAt).getTime()) / 86400_000);
  const typeW: Record<string, number> = {
    long_term_preference: 1.0, transaction: 0.95, behavior: 0.85,
    interaction: 0.8, short_term_interest: 0.6,
  };
  const decay = m.memoryType === "short_term_interest"
    ? Math.max(0.2, Math.pow(0.85, days))
    : Math.max(0.7, Math.pow(0.995, days));
  const confirmed = m.userConfirmed ? 1.15 : 1;
  return Math.min(10, +(m.confidence * (typeW[m.memoryType] ?? 0.8) * decay * confirmed).toFixed(3));
}

const rid = (p: string) => `${p}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
const nowIso = () => new Date().toISOString();

export interface ExtractedMemory {
  memoryType: MemoryType;
  category: string;
  attribute: string;
  value: string;
  confidence: number;
}

/* ---------- 规则提取(兜底,可解释) ---------- */
export function rulesExtract(text: string): ExtractedMemory[] {
  const out: ExtractedMemory[] = [];
  const push = (memoryType: MemoryType, category: string, attribute: string, value: string, confidence: number, confirmed = false) => {
    if (value && value.trim().length >= 1 && out.length < 4) {
      out.push({ memoryType, category, attribute, value: value.trim(), confidence, });
      void confirmed;
    }
  };
  // 明确要求记住 → 互动记忆 + 视为用户确认
  const remember = /记住[:：,，]?\s*我?(喜欢|不喜欢|爱|讨厌|在|想)(.{1,20})/.exec(text);
  if (remember) {
    const neg = /不喜欢|讨厌|不爱/.test(remember[1]);
    push("interaction", "用户嘱托", neg ? "不喜欢" : "喜欢", `${remember[2].trim()}`, 1);
  }
  // 喜欢 X(排除否定前缀「不/别」,避免产生矛盾记忆)
  const likeRe = /我?(?:特别喜欢|很喜欢|喜欢|爱)(?:上了)?([^\u4e00-\u9fa5]?[\u4e00-\u9fa5A-Za-z0-9]{1,14})/g;
  let likeM: RegExpExecArray | null;
  while ((likeM = likeRe.exec(text))) {
    const pre = text.slice(Math.max(0, likeM.index - 2), likeM.index);
    if (/不|别$/.test(pre)) continue; // 「不喜欢」「别喜欢」→ 由 dislike 分支处理
    if (/喜欢吗|喜欢你/.test(likeM[0])) continue;
    const v = likeM[1].replace(/[的。,，!！?？~]/g, "");
    if (!v) continue;
    const cat = /色|白|黑|粉|蓝/.test(v) ? "颜色" : /款|风|风格/.test(v) ? "款式" : "偏好";
    push("long_term_preference", cat, "喜欢", v, 0.9);
    break; // 每条消息只取一个「喜欢」
  }
  const dislike = /(?:不喜欢|讨厌|别用|不要)([\u4e00-\u9fa5A-Za-z0-9]{1,12})/.exec(text);
  if (dislike) push("long_term_preference", "偏好", "不喜欢", dislike[1], 0.9);
  // 想尝试 X
  const want = /(?:想(?:尝试|试试|做|要)|来一[个次])([\u4e00-\u9fa5A-Za-z0-9]{1,14})/.exec(text);
  if (want) push("short_term_interest", "款式", "想尝试", want[1], 0.8);
  // 预算
  const budget = /预算\s*(\d{2,4})|\s*(\d{2,4})\s*元/.exec(text);
  if (budget) push("short_term_interest", "预算", "本次预算", `${budget[1] ?? budget[2]} 元`, 0.85);
  return out;
}

/* ---------- LLM 提取(GLM,主路径) ---------- */
async function llmExtract(text: string, config: LlmConfig, memberName: string): Promise<ExtractedMemory[] | null> {
  if (!config.apiKey) return null;
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: `你是猫咪记忆引擎。从用户对闺蜜猫说的话中提取值得长期保存的记忆。只提取稳定的偏好/兴趣/事实,忽略寒暄。AI 不得编造用户没说的内容。
输出 JSON 数组(不要解释):[{"memory_type":"long_term_preference|short_term_interest|behavior|interaction","category":"颜色|款式|风格|服务|预算|生活","attribute":"喜欢|不喜欢|想尝试|做过|聊过","value":"...","confidence":0-1}]
规则:用户明确说出口的 confidence 0.9-1;根据语气推测的 0.5-0.7;最多 4 条;没有可提取的返回 []。`,
          },
          { role: "user", content: `会员「${memberName}」对闺蜜猫说:「${text}」` },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "";
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]) as Array<Record<string, unknown>>;
    const valid: MemoryType[] = ["long_term_preference", "short_term_interest", "behavior", "transaction", "interaction"];
    return arr
      .filter((x) => valid.includes(x.memory_type as MemoryType) && String(x.value ?? "").trim())
      .slice(0, 4)
      .map((x) => ({
        memoryType: x.memory_type as MemoryType,
        category: String(x.category ?? "偏好"),
        attribute: String(x.attribute ?? "偏好"),
        value: String(x.value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").trim().slice(0, 60),
        confidence: Math.min(1, Math.max(0.3, Number(x.confidence) || 0.7)),
      }));
  } catch {
    return null; // 由调用方诚实降级到规则提取
  }
}

/* ---------- 保存:同 (user,category,attribute) 更新而非重复插入 ---------- */
export function saveExtractedMemories(opts: {
  storeId: string; userId: string; catId: string;
  items: ExtractedMemory[]; source: string; sourceRef?: string;
}): { saved: number; updated: number } {
  let saved = 0, updated = 0;
  for (const item of opts.items) {
    const existing = sqlite.prepare(`
      SELECT id, value, confidence FROM user_memories
      WHERE user_id = ? AND category = ? AND attribute = ? AND status = 'active'
      ORDER BY updated_at DESC LIMIT 1
    `).get(opts.userId, item.category, item.attribute) as { id: string; value: string; confidence: number } | undefined;
    if (existing) {
      if (existing.value === item.value) {
        db.update(userMemories).set({
          confidence: Math.min(1, existing.confidence + 0.05), updatedAt: nowIso(),
        }).where(eq(userMemories.id, existing.id)).run();
      } else {
        db.update(userMemories).set({
          value: item.value, confidence: item.confidence, updatedAt: nowIso(),
        }).where(eq(userMemories.id, existing.id)).run();
      }
      updated++;
      continue;
    }
    db.insert(userMemories).values({
      id: rid("um"), storeId: opts.storeId, userId: opts.userId, catId: opts.catId,
      memoryType: item.memoryType, category: item.category,
      attribute: item.attribute, value: item.value,
      confidence: item.confidence, source: opts.source,
      sourceRef: opts.sourceRef ?? null,
      userConfirmed: 0, visibility: "user_visible", status: "active",
      expiresAt: item.memoryType === "short_term_interest"
        ? new Date(Date.now() + 45 * 86400_000).toISOString() : null,
      createdAt: nowIso(), updatedAt: nowIso(),
    }).run();
    saved++;
  }
  // 画像聚合(user_preferences):同 category+attribute 取置信度最高值
  const profile = sqlite.prepare(`
    SELECT category, attribute, value, MAX(confidence * (CASE WHEN memory_type='long_term_preference' THEN 1.2 ELSE 1 END)) as w
    FROM user_memories WHERE user_id = ? AND status = 'active'
    GROUP BY category, attribute HAVING w >= 0.5
  `).all(opts.userId) as Array<{ category: string; attribute: string; value: string; w: number }>;
  for (const p of profile) {
    const pid = `pref_${opts.userId}_${Buffer.from(p.category + p.attribute).toString("hex").slice(0, 16)}`;
    sqlite.prepare(`
      INSERT INTO user_preferences (id, store_id, user_id, category, attribute, value, confidence, updated_at)
      VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id, category, attribute) DO UPDATE SET value = excluded.value, confidence = excluded.confidence, updated_at = excluded.updated_at
    `).run(pid, opts.storeId, opts.userId, p.category, p.attribute, p.value, +p.w.toFixed(2), nowIso());
  }
  return { saved, updated };
}

/** 提取入口:LLM 优先,失败/无 Key 诚实降级到规则提取 */
export async function extractAndSave(opts: {
  storeId: string; userId: string; catId: string; memberName: string;
  text: string; source?: string; sourceRef?: string; config: LlmConfig;
}): Promise<{ items: ExtractedMemory[]; engine: "llm" | "rules" }> {
  let items = await llmExtract(opts.text, opts.config, opts.memberName);
  let engine: "llm" | "rules" = "llm";
  if (items === null) {
    items = rulesExtract(opts.text);
    engine = "rules";
  }
  if (items.length) {
    saveExtractedMemories({
      storeId: opts.storeId, userId: opts.userId, catId: opts.catId,
      items, source: opts.source ?? "chat", sourceRef: opts.sourceRef,
    });
  }
  return { items, engine };
}

/* ---------- 用户记忆 CRUD(用户可见层) ---------- */
export function listUserMemories(userId: string) {
  return sqlite.prepare(`
    SELECT id, memory_type, category, attribute, value, confidence, source, source_ref,
           user_confirmed, status, created_at, updated_at
    FROM user_memories WHERE user_id = ? AND status = 'active' AND visibility = 'user_visible'
    ORDER BY memory_weight(updated_at) DESC, updated_at DESC
  `.replace("memory_weight(updated_at) DESC", "updated_at DESC")).all(userId) as Row[];
}
type Row = Record<string, unknown>;

export function correctMemory(opts: { userId: string; memoryId: string; value?: string; remove?: boolean }) {
  const m = sqlite.prepare(
    "SELECT * FROM user_memories WHERE id = ? AND user_id = ?"
  ).get(opts.memoryId, opts.userId) as Record<string, unknown> | undefined;
  if (!m) throw new Error("记忆不存在");
  if (opts.remove) {
    db.update(userMemories).set({ status: "deleted", updatedAt: nowIso() })
      .where(eq(userMemories.id, opts.memoryId)).run();
    db.insert(memoryFeedback).values({
      id: rid("mf"), memoryId: opts.memoryId, userId: opts.userId,
      feedback: "deleted", oldValue: m.value as string, newValue: null, createdAt: nowIso(),
    }).run();
    // 用户删除 = 明确否决,画像同步移除
    db.delete(userPreferences).where(
      and(eq(userPreferences.userId, opts.userId), eq(userPreferences.attribute, m.attribute as string))).run();
    return { ok: true, deleted: true };
  }
  const oldValue = m.value as string;
  db.update(userMemories).set({
    value: opts.value!, confidence: 1, userConfirmed: 1, updatedAt: nowIso(),
  }).where(eq(userMemories.id, opts.memoryId)).run();
  db.insert(memoryFeedback).values({
    id: rid("mf"), memoryId: opts.memoryId, userId: opts.userId,
    feedback: "corrected", oldValue, newValue: opts.value!, createdAt: nowIso(),
  }).run();
  // 用户纠正 = 用户确认的事实,画像直接采纳
  sqlite.prepare(`
    UPDATE user_preferences SET value = ?, confidence = 1, updated_at = ?
    WHERE user_id = ? AND attribute = ?
  `).run(opts.value!, nowIso(), opts.userId, m.attribute);
  return { ok: true, deleted: false };
}

/** 供 Prompt 使用的加权记忆上下文 */
export function topMemoriesForPrompt(userId: string, limit = 12): string[] {
  const rows = sqlite.prepare(`
    SELECT memory_type, category, attribute, value, confidence, user_confirmed, updated_at
    FROM user_memories WHERE user_id = ? AND status = 'active'
  `).all(userId) as Array<{ memory_type: string; category: string; attribute: string; value: string; confidence: number; user_confirmed: number; updated_at: string }>;
  return rows
    .map((m) => ({
      ...m,
      w: memoryWeight({
        memoryType: m.memory_type, confidence: m.confidence,
        updatedAt: m.updated_at, userConfirmed: m.user_confirmed ? 1 : 0,
      }),
    }))
    .sort((a, b) => b.w - a.w)
    .slice(0, limit)
    .map((m) => `[${MEMORY_TYPE_LABEL[m.memory_type as MemoryType] ?? m.memory_type}${m.user_confirmed ? "·已确认" : ""}] ${m.attribute}: ${m.value}`);
}

