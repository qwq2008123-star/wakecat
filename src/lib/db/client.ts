import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";
import { DDL } from "./ddl";

export type DB = BetterSQLite3Database<typeof schema>;

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "wakecat.db");

declare global {
  // eslint-disable-next-line no-var
  var __wxCatDb: Database.Database | undefined;
}

function openDb(): Database.Database {
  if (!globalThis.__wxCatDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const raw = new Database(DB_PATH);
    raw.pragma("journal_mode = WAL");
    raw.exec(DDL);
    // 轻量迁移:为旧库补充新增列
    const cols = (t: string) =>
      (raw.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);
    if (!cols("finance_entries").includes("strategy_id")) {
      raw.exec("ALTER TABLE finance_entries ADD COLUMN strategy_id TEXT");
    }
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
export const db: DB = drizzle(sqlite, { schema });
export { schema };
