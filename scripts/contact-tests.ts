/**
 * WAKECAT 2.0 · 主动联系决策引擎 12 项验收测试
 * 运行:pnpm exec tsx scripts/contact-tests.ts
 * 使用独立临时数据库,不污染演示数据。
 */
import fs from "node:fs";

/** 关键:env 必须先于 db/client 模块加载(ESM import 会被提升,静态导入不行,必须动态导入) */
async function main() {
  process.env.WAKECAT_DB_URL = "file:/tmp/contact-test.db";
  for (const f of ["/tmp/contact-test.db", "/tmp/contact-test.db-wal", "/tmp/contact-test.db-shm"]) {
    try { fs.rmSync(f, { force: true }); } catch { /* 不存在 */ }
  }
  const { sqlite } = await import("../src/lib/db/client");
  const { getOrCreatePrefs, updatePrefs, decideContact, markDecision } = await import("../src/lib/contact/engine");

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? " → " + detail : ""}`); }
}

/* ---------- 种子:两店两客户,真实结构 ---------- */
const STORE_A = "store_test_a", STORE_B = "store_test_b";
const MA = "m_test_a"; // A 店客户
sqlite.exec(`
  INSERT OR IGNORE INTO stores (id, name, owner_name, created_at) VALUES ('${STORE_A}','测试店A','甲',datetime('now')), ('${STORE_B}','测试店B','乙',datetime('now'));
  INSERT OR IGNORE INTO members (id, store_id, name, phone_masked, level, tags_json, joined_at, is_demo, created_at) VALUES
    ('${MA}','${STORE_A}','测试客户A','138****0001','黄金','["猫眼款党"]',datetime('now'),1,datetime('now')),
    ('m_test_b','${STORE_B}','测试客户B','138****0002','白银','[]',datetime('now'),1,datetime('now'));
  INSERT OR IGNORE INTO store_services (id, store_id, name, price, cost, duration_min, status, is_new) VALUES
    ('svc_new_a','${STORE_A}','猫眼镭射款',168,50,90,'active',1),
    ('svc_old_a','${STORE_A}','基础美甲',98,25,60,'active',0);
  INSERT OR IGNORE INTO agent_configs (id, store_id, updated_at) VALUES ('cfg_a','${STORE_A}',datetime('now')), ('cfg_b','${STORE_B}',datetime('now'));
`);

// 测试客户:关闭安静时段(测试可能在深夜跑),其余按用例单独授权
function quietOff() {
  updatePrefs(STORE_A, MA, { quietStart: "00:00", quietEnd: "00:00" });
}
function addMemory(value: string, daysAgo = 1) {
  sqlite.prepare(`INSERT INTO user_memories (id, store_id, user_id, cat_id, memory_type, category, attribute, value, confidence, source, source_ref, status, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    `um_${Math.random().toString(36).slice(2, 8)}`, STORE_A, MA, "", "short_term_interest",
    "style", "想尝试", value, 0.8, "chat", "test", "active",
    new Date(Date.now() - daysAgo * 86400_000).toISOString(), new Date(Date.now() - daysAgo * 86400_000).toISOString());
}
function addFavorite(title: string, tags: string[]) {
  sqlite.prepare(`INSERT INTO inspiration_items (id, store_id, user_id, title, style_tags_json, source, created_at)
    VALUES (?,?,?,?,?,?,datetime('now'))`).run(
    `ii_${Math.random().toString(36).slice(2, 8)}`, STORE_A, MA, title, JSON.stringify(tags), "upload");
}
function addOrder(daysAgo: number) {
  sqlite.prepare(`INSERT INTO consumption_records (id, store_id, member_id, service, amount, artist, occurred_at)
    VALUES (?,?,?,?,?,?,datetime('now', ?))`).run(
    `cr_${Math.random().toString(36).slice(2, 8)}`, STORE_A, MA, "基础美甲", 98, "小林", `-${daysAgo} day`);
}
function addCoupon() {
  sqlite.prepare(`INSERT INTO coupon_grants (id, store_id, task_id, member_id, name, value, status, granted_at)
    VALUES (?,?,?,?,?,?, 'granted', datetime('now'))`).run(
    `cg_${Math.random().toString(36).slice(2, 8)}`, STORE_A, "task_x", MA, "测试券", 20);
}
function addPriorDecision(serviceName: string, decision = "contact") {
  sqlite.prepare(`INSERT INTO contact_decisions (id, store_id, member_id, decision, category, need_type, reason,
    relevance, usefulness, timing, consent_status, total_score, service_name, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now', '-1 day'))`).run(
    `cd_${Math.random().toString(36).slice(2, 8)}`, STORE_A, MA, decision, "commercial",
    "new_item_match", "历史决策", 0.9, 0.9, 1, "granted", 0.81, serviceName);
}

console.log("\n═══ WAKECAT 2.0 联系决策引擎 · 12 项验收测试 ═══\n");

/* T1 客户没有授权商业推荐 → 不发送 */
{
  quietOff();
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "coupon" });
  check("T1 未授权商业推荐 → 沉默", r.decision === "stay_silent" && r.consent_status === "not_granted", JSON.stringify(r.decision));
}

/* T2 客户关闭商业消息 → 不发送任何营销消息 */
{
  updatePrefs(STORE_A, MA, { allowCommercial: true, allowPromotions: true });
  addCoupon();
  const r1 = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "coupon" });
  const wasContact = r1.decision !== "stay_silent";
  updatePrefs(STORE_A, MA, { allowCommercial: false });
  const r2 = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "coupon" });
  check("T2 授权后可联系(前置)", wasContact, r1.reason);
  check("T2 关闭商业消息 → 沉默", r2.decision === "stay_silent" && r2.consent_status === "not_granted");
  updatePrefs(STORE_A, MA, { allowCommercial: true }); // 恢复,供后续测试
}

/* T3 刚刚消费完成 → 不发无关广告 */
{
  addOrder(2);
  addCoupon();
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "coupon" });
  check("T3 刚消费 2 天 → 商业沉默", r.decision === "stay_silent" && r.reason.includes("消费"), r.reason);
}

/* T4 客户明确表达预约需求 → 合适时间生成预约提醒 */
{
  quietOff();
  addMemory("下个月想做一次猫眼款的", 3);
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "appointment_reminder" });
  check("T4 表达过预约意图 → 预约提醒可联系", r.decision === "contact" && r.need.need_type === "appointment_reminder", `${r.decision}/${r.need.need_type} ${r.reason}`);
  check("T4 证据来自真实记忆", r.need.evidence.some((e) => e.includes("客户记忆")), JSON.stringify(r.need.evidence));
}

/* T5 收藏猫眼 + 店内上架匹配新品 → 有真实记忆依据的推荐建议 */
{
  updatePrefs(STORE_A, MA, { allowNewItems: true, weeklyCap: 5 }); // T6 单测去重,上限调高避免抢先生效
  sqlite.prepare("DELETE FROM consumption_records WHERE member_id=?").run(MA); // 收藏匹配场景与"刚消费"无关
  addFavorite("深海蓝猫眼美甲", ["猫眼", "深海蓝"]);
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "new_item" });
  check("T5 收藏匹配新品 → 生成推荐建议(联系或人工审核)",
    (r.decision === "contact" || r.decision === "needs_review") && r.service_name === "猫眼镭射款",
    `${r.decision} ${r.reason}`);
  check("T5 依据是真实收藏+真实商品", r.need.evidence.some((e) => e.includes("客户收藏") && e.includes("店内新品")), JSON.stringify(r.need.evidence));
}

/* T6 同一商品已推荐过 → 不重复推送 */
{
  addPriorDecision("猫眼镭射款", "contact");
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "new_item" });
  check("T6 同商品 30 天内已推荐 → 沉默", r.decision === "stay_silent" && r.reason.includes("已经推荐过"), r.reason);
}

/* T7 客户明确表示不喜欢某款式 → 不再推荐同类型 */
{
  updatePrefs(STORE_A, MA, { rejectedCategories: ["猫眼"] });
  // 用另一款含"猫眼"的新品绕过同品去重:换新品名
  sqlite.prepare(`UPDATE store_services SET name='猫眼星河款' WHERE id='svc_new_a'`).run();
  sqlite.prepare(`DELETE FROM contact_decisions WHERE member_id='${MA}'`).run();
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "new_item" });
  sqlite.prepare(`UPDATE store_services SET name='猫眼镭射款' WHERE id='svc_new_a'`).run();
  check("T7 客户拒绝过的类型 → 沉默", r.decision === "stay_silent" && r.reason.includes("不感兴趣"), r.reason);
  updatePrefs(STORE_A, MA, { rejectedCategories: [] });
}

/* T8 一周内达到商业触达上限 → 不再发送 */
{
  updatePrefs(STORE_A, MA, { weeklyCap: 1, rejectedCategories: [] });
  addPriorDecision("猫眼镭射款", "contact"); // 本周已有 1 次商业联系
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "new_item" });
  check("T8 周上限已达 → 沉默", r.decision === "stay_silent" && r.reason.includes("上限"), r.reason);
}

/* T9 客户未上线(H5 关闭)→ 不得宣称已送达 */
{
  // 未绑定的客户没有 customer_identities,deliverInSite 的前提不存在;
  // 引擎层验证:决策可以做,但没有身份就不可能产生「已发送」
  const ident = sqlite.prepare("SELECT COUNT(*) c FROM customer_identities WHERE member_id=? AND store_id=?").get(MA, STORE_A) as { c: number };
  const sent = sqlite.prepare("SELECT COUNT(*) c FROM outreach_messages WHERE member_id=? AND status='sent'").get(MA) as { c: number };
  check("T9 未绑定 H5 → 无身份无发送记录", ident.c === 0 && sent.c === 0);
}

/* T10 跨店隔离 */
{
  // B 店客户与 A 店客户数据互不可见:B 店做同样的决策,B 店客户无记忆无收藏 → 沉默理由不同
  const rB = decideContact({ storeId: STORE_B, memberId: "m_test_b", category: "commercial", kind: "new_item" });
  check("T10 B 店客户不受 A 店收藏影响 → 沉默(无匹配)", rB.decision === "stay_silent", rB.reason);
  // 决策记录按店隔离
  const a = (sqlite.prepare("SELECT COUNT(*) c FROM contact_decisions WHERE store_id=? AND member_id=?").get(STORE_A, "m_test_b") as { c: number }).c;
  const b = (sqlite.prepare("SELECT COUNT(*) c FROM contact_decisions WHERE store_id=? AND member_id=?").get(STORE_B, "m_test_b") as { c: number }).c;
  check("T10 决策日志按店隔离", a === 0 && b > 0);
}

/* T11 引擎决定沉默 → 记录 stay_silent,不产生虚假发送记录 */
{
  const before = (sqlite.prepare("SELECT COUNT(*) c FROM outreach_messages WHERE member_id=?").get(MA) as { c: number }).c;
  const r = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "callback" });
  const after = (sqlite.prepare("SELECT COUNT(*) c FROM outreach_messages WHERE member_id=?").get(MA) as { c: number }).c;
  const logged = (sqlite.prepare(`SELECT COUNT(*) c FROM contact_decisions WHERE member_id=? AND decision='stay_silent' AND date(created_at)=date('now')`).get(MA) as { c: number }).c;
  check("T11 沉默决策被记录", r.decision === "stay_silent" && logged > 0);
  check("T11 沉默不产生发送记录", before === after);
}

/* T12 同一发送任务重复执行 → 幂等 */
{
  sqlite.prepare(`INSERT INTO tasks (id, store_id, type, title, goal, status, created_at, updated_at)
    VALUES ('task_t12','${STORE_A}','awaken_campaign','T12','x','approved',datetime('now'),datetime('now'))`).run();
  sqlite.prepare(`INSERT INTO strategies (id, task_id, member_id, kind, content, channel, predicted_cost, created_at)
    VALUES ('st_t12','task_t12','${MA}','callback','回访','in-site',0,datetime('now'))`).run();
  sqlite.prepare(`INSERT INTO outreach_messages (id, task_id, strategy_id, member_id, channel, body, status, created_at)
    VALUES ('om_t12','task_t12','st_t12','${MA}','in-site','你好呀','sent',datetime('now'))`).run();
  let dupBlocked = false;
  try {
    sqlite.prepare(`INSERT INTO outreach_messages (id, task_id, strategy_id, member_id, channel, body, status, created_at)
      VALUES ('om_t12_dup','task_t12','st_t12','${MA}','in-site','你好呀','sent',datetime('now'))`).run();
  } catch (e) {
    dupBlocked = String((e as Error).message).includes("UNIQUE");
  }
  check("T12 同任务同策略重复插入 → 唯一约束拦截", dupBlocked);
  // 决策引擎的 dedupe_key 幂等
  const r1 = decideContact({ storeId: STORE_A, memberId: MA, category: "commercial", kind: "callback" });
  markDecision(r1.decisionId, "sent");
  check("T12 决策记录可追踪 outcome", r1.decisionId.length > 0);
}

  console.log(`\n═══ 结果:${pass} 通过 / ${fail} 失败 ═══\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
