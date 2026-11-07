import Database from "libsql";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { DDL } from "./ddl";

export type DB = BetterSQLite3Database<typeof schema>;

/* ============================================================
   数据库客户端:libsql 驱动(better-sqlite3 的官方替换品,同步 API 不变)
   - 本地开发:WAKECAT_DB_URL=file:./data/wakecat.db(或不设,用默认)
   - 生产(Turso):WAKECAT_DB_URL=libsql://xxx.turso.io  WAKECAT_DB_TOKEN=xxx
   同一份代码/SQL 在本地与云端都跑——方言是 SQLite,不换。
   ============================================================ */

const DB_URL_RAW = process.env.WAKECAT_DB_URL || "file:./data/wakecat.db";
// Turso 鉴权走 URL 查询参数(libsql://xxx?authToken=yyy)
const DB_URL = process.env.WAKECAT_DB_TOKEN
  ? `${DB_URL_RAW}${DB_URL_RAW.includes("?") ? "&" : "?"}authToken=${process.env.WAKECAT_DB_TOKEN}`
  : DB_URL_RAW;
const IS_LOCAL = DB_URL_RAW.startsWith("file:");

declare global {
  // eslint-disable-next-line no-var
  var __wxCatDb: Database.Database | undefined;
}

function openDb(): Database.Database {
  if (!globalThis.__wxCatDb) {
    const raw = new Database(DB_URL);
    // WAL 只对本地文件有意义;Turso 远端自行管理
    if (IS_LOCAL) {
      try { raw.pragma("journal_mode = WAL"); } catch { /* 首次建库中 */ }
    }
    raw.exec(DDL);
    // 轻量迁移:为旧库补充新增列
    const cols = (t: string) =>
      (raw.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    if (!cols("finance_entries").includes("strategy_id")) {
      raw.exec("ALTER TABLE finance_entries ADD COLUMN strategy_id TEXT");
    }
    if (!cols("orders").includes("attribution")) {
      raw.exec("ALTER TABLE orders ADD COLUMN attribution TEXT NOT NULL DEFAULT 'natural'");
    }
    if (!cols("agent_configs").includes("auto_run")) {
      raw.exec("ALTER TABLE agent_configs ADD COLUMN auto_run INTEGER NOT NULL DEFAULT 0");
    }
    if (!cols("cat_bond_logs").includes("action")) {
      raw.exec("ALTER TABLE cat_bond_logs ADD COLUMN action TEXT NOT NULL DEFAULT 'legacy'");
    }
    if (!cols("cat_bond_logs").includes("dedupe_key")) {
      raw.exec("ALTER TABLE cat_bond_logs ADD COLUMN dedupe_key TEXT");
    }
    if (!cols("inspiration_items").includes("image_hash")) {
      raw.exec("ALTER TABLE inspiration_items ADD COLUMN image_hash TEXT");
    }
    if (!cols("staff_users").includes("password_hash")) {
      raw.exec("ALTER TABLE staff_users ADD COLUMN password_hash TEXT");
    }
    // WAKECAT 2.0:主动联系决策引擎
    raw.exec(`CREATE TABLE IF NOT EXISTS contact_decisions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'commercial',
      need_type TEXT,
      reason TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '[]',
      relevance REAL NOT NULL DEFAULT 0,
      usefulness REAL NOT NULL DEFAULT 0,
      timing REAL NOT NULL DEFAULT 0,
      consent_status TEXT NOT NULL DEFAULT 'unknown',
      total_score REAL NOT NULL DEFAULT 0,
      task_id TEXT,
      strategy_id TEXT,
      service_name TEXT,
      dedupe_key TEXT,
      outcome TEXT,
      created_at TEXT NOT NULL
    )`);
    raw.exec("CREATE INDEX IF NOT EXISTS idx_cd_member ON contact_decisions(store_id, member_id, created_at);");
    raw.exec(`CREATE TABLE IF NOT EXISTS customer_preferences (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      member_id TEXT NOT NULL UNIQUE,
      allow_commercial INTEGER NOT NULL DEFAULT 0,
      allow_appointment_reminder INTEGER NOT NULL DEFAULT 1,
      allow_new_items INTEGER NOT NULL DEFAULT 0,
      allow_promotions INTEGER NOT NULL DEFAULT 0,
      weekly_cap INTEGER NOT NULL DEFAULT 1,
      quiet_start TEXT NOT NULL DEFAULT '22:00',
      quiet_end TEXT NOT NULL DEFAULT '09:00',
      rejected_categories_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    )`);
    for (const col of ["service_name TEXT", "staff_name TEXT", "scheduled_for TEXT", "source TEXT NOT NULL DEFAULT 'seller'"]) {
      const name = col.split(" ")[0];
      if (!cols("appointments").includes(name)) {
        raw.exec(`ALTER TABLE appointments ADD COLUMN ${col}`);
      }
    }
    // 幂等约束:同一任务下同一策略只允许一条触达消息(CREATE INDEX IF NOT EXISTS 自身幂等)
    raw.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_om_task_strategy ON outreach_messages(task_id, strategy_id);");
    raw.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_appt ON orders(appointment_id) WHERE appointment_id IS NOT NULL;");
    globalThis.__wxCatDb = raw;
  }
  return globalThis.__wxCatDb;
}

export const sqlite = openDb();
// libsql 包是 better-sqlite3 的官方替换品(同步 API 一致);
// 类型用 @types/better-sqlite3(仅类型,运行时零依赖),一次诚实断言桥接
type Bs3Database = import("better-sqlite3").Database;
export const db: DB = drizzle(sqlite as unknown as Bs3Database, { schema });
export { schema };
