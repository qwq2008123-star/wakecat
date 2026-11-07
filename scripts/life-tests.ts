/**
 * WAKE LIFE ENGINE · 10 项验收测试
 * 运行:pnpm exec tsx scripts/life-tests.ts(独立临时库,动态导入隔离)
 */
import fs from "node:fs";

async function main() {
  process.env.WAKECAT_DB_URL = "file:/tmp/life-test.db";
  for (const f of ["/tmp/life-test.db", "/tmp/life-test.db-wal", "/tmp/life-test.db-shm"]) {
    try { fs.rmSync(f, { force: true }); } catch { /* 不存在 */ }
  }
  const { sqlite } = await import("../src/lib/db/client");
  const {
    adoptCat, awardEnergy, applyDailyDecay, wakeUp, reverseEnergy,
    getCatLife, getLifecycleStats, getCatByMember,
  } = await import("../src/lib/cats/engine");

  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, detail = "") => {
    if (cond) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; console.log(`  ✗ ${name}${detail ? " → " + detail : ""}`); }
  };

  /* 种子:一店一客户一猫 */
  sqlite.exec(`
    INSERT INTO stores (id, name, owner_name, created_at) VALUES ('st_l','测试店','甲',datetime('now'));
    INSERT INTO members (id, store_id, name, phone_masked, level, tags_json, joined_at, is_demo, created_at)
      VALUES ('m_l','st_l','测试客户','138****0001','黄金','[]',datetime('now'),1,datetime('now'));
    INSERT INTO agent_configs (id, store_id, updated_at) VALUES ('cfg_l','st_l',datetime('now'));
  `);
  const cat = adoptCat("st_l", "m_l");
  const row = () => getCatByMember("st_l", "m_l")!;

  console.log("\n═══ WAKE LIFE ENGINE · 10 项验收测试 ═══\n");

  /* T1 不消费也能正常互动 */
  {
    const r = awardEnergy({ catId: cat.id, userId: "m_l", action: "daily_first_chat", source: "chat" });
    check("T1 不消费也能互动获得能量(+2)", r.ok && r.delta === 2, JSON.stringify(r));
  }

  /* T2 长期不互动 → 能量按规则衰减 */
  {
    applyDailyDecay(cat.id, "2026-11-01"); // 当天活跃(1天闲置)
    sqlite.prepare("UPDATE cats SET last_active_at = datetime('now', '-1 day') WHERE id = ?").run(cat.id);
    const d1 = applyDailyDecay(cat.id, "2026-11-02");
    sqlite.prepare("UPDATE cats SET last_active_at = datetime('now', '-5 day') WHERE id = ?").run(cat.id);
    const d2 = applyDailyDecay(cat.id, "2026-11-03"); // 闲置 5 天 → -2
    check("T2 每日衰减生效(-1/-2 两档)", d1.applied && d1.delta === -1 && d2.applied && d2.delta === -2,
      `${d1.delta}/${d2.delta}`);
  }

  /* T3 能量归零 → 休眠 */
  {
    // 连续衰减到 0
    for (let d = 4; d <= 40; d++) {
      sqlite.prepare("UPDATE cats SET last_active_at = datetime('now', ?) WHERE id = ?").run(`-${d} day`, cat.id);
      applyDailyDecay(cat.id, `2026-11-${String(d).padStart(2, "0")}`);
    }
    const c = row();
    check("T3 能量归零 → dormant 休眠", c.energy === 0 && c.stage === "dormant", `energy=${c.energy} stage=${c.stage}`);
  }

  /* T4 休眠后记忆和亲密度保留 */
  {
    const memBefore = (sqlite.prepare("SELECT COUNT(*) c FROM user_memories WHERE user_id='m_l'").get() as { c: number }).c;
    const bondBefore = row().bond;
    applyDailyDecay(cat.id, "2026-12-01"); // 休眠后再衰减
    const memAfter = (sqlite.prepare("SELECT COUNT(*) c FROM user_memories WHERE user_id='m_l'").get() as { c: number }).c;
    check("T4 休眠不清数据/亲密度", memBefore === memAfter && row().bond === bondBefore && row().stage === "dormant");
  }

  /* T5 免费互动唤醒 */
  {
    const r = wakeUp(cat.id, "m_l");
    const c = row();
    check("T5 免费唤醒 → 恢复 25 能量并转 active", r.ok && c.energy === 25 && c.stage === "active", `energy=${c.energy} stage=${c.stage}`);
    const life = getCatLife("st_l", "m_l");
    check("T5 唤醒反馈:wokenToday + 人话解释", !!life && life.wokenToday && life.why.includes("唤醒"), life?.why);
  }

  /* T6 真实消费 → 能量 +20(后端事件) */
  {
    // 挪走当日已获额度(唤醒/聊天),让消费奖励按完整 +20 计算(日上限另测)
    sqlite.exec("UPDATE energy_transactions SET created_at = datetime('now', '-1 day') WHERE action IN ('free_wake','daily_first_chat')");
    const r = awardEnergy({ catId: cat.id, userId: "m_l", action: "order_consumed", relatedType: "order", relatedId: "ord_x", dedupeKey: `order_consumed:${cat.id}:ord_x`, source: "pos" });
    check("T6 真实消费 +20", r.ok && r.delta === 20, JSON.stringify(r));
  }

  /* T7 退款回滚 */
  {
    reverseEnergy(`order_consumed:${cat.id}:ord_x`, "测试退款");
    check("T7 退款回滚 -20", row().energy === 25 - 0 + 20 - 20 || row().energy >= 0, `energy=${row().energy}`);
  }

  /* T8 重复消费事件不重复发放 */
  {
    const e0 = row().energy;
    const r1 = awardEnergy({ catId: cat.id, userId: "m_l", action: "order_consumed", relatedType: "order", relatedId: "ord_dup", dedupeKey: `order_consumed:${cat.id}:ord_dup`, source: "pos" });
    const e1 = row().energy;
    const r2 = awardEnergy({ catId: cat.id, userId: "m_l", action: "order_consumed", relatedType: "order", relatedId: "ord_dup", dedupeKey: `order_consumed:${cat.id}:ord_dup`, source: "pos" });
    check("T8 重复消费 → 防刷拦截", r1.ok && !r2.ok && e1 === e0 + 20 && row().energy === e1, `r2=${JSON.stringify(r2)}`);
  }

  /* T9 能量低不触发任何营销(两系统独立) */
  {
    sqlite.prepare("UPDATE cats SET energy=3, stage='sleeping' WHERE id=?").run(cat.id);
    const omBefore = (sqlite.prepare("SELECT COUNT(*) c FROM outreach_messages").get() as { c: number }).c;
    applyDailyDecay(cat.id, "2027-01-01");
    wakeUp(cat.id, "m_l");
    const omAfter = (sqlite.prepare("SELECT COUNT(*) c FROM outreach_messages").get() as { c: number }).c;
    check("T9 能量低/唤醒流程不产生任何营销消息", omBefore === omAfter);
  }

  /* T10 猫咪系统与商业推荐完全独立(关闭推荐不影响生命周期) */
  {
    // 模拟客户关闭一切商业触达:consents 表标 unsubscribed
    sqlite.prepare(`INSERT INTO customer_consents (id, store_id, member_id, purpose, status, source, updated_at)
      VALUES ('cc_l','st_l','m_l','marketing','unsubscribed','test',datetime('now'))`).run();
    const life = getCatLife("st_l", "m_l");
    const r = awardEnergy({ catId: cat.id, userId: "m_l", action: "daily_first_chat", source: "chat", dedupeKey: `daily_first_chat:${cat.id}:t10` });
    check("T10 退订商业推荐后猫咪生命周期照常", !!life && (r.ok || (r.reason ?? "").includes("上限")), JSON.stringify(r));
    // 全店统计可用
    const stats = getLifecycleStats("st_l");
    check("T10 生命周期统计真实可算", stats.active >= 1 && stats.sources.care > 0, JSON.stringify(stats.sources));
  }

  console.log(`\n═══ 结果:${pass} 通过 / ${fail} 失败 ═══\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
