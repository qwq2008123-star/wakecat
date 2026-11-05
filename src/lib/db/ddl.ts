/* 手写 DDL(避免依赖 drizzle-kit),与 schema.ts 保持一致 */
export const DDL = `
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT '未知',
  birthday_text TEXT,
  level TEXT NOT NULL DEFAULT '普通',
  joined_at TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consumption_records (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  service TEXT NOT NULL,
  amount REAL NOT NULL,
  artist TEXT NOT NULL,
  note TEXT,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cr_member ON consumption_records(member_id);
CREATE TABLE IF NOT EXISTS member_memories (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_ref TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  created_by_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_mm_member ON member_memories(member_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  payload_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT NOT NULL DEFAULT '{}',
  cost_estimate REAL NOT NULL DEFAULT 0,
  engine TEXT NOT NULL DEFAULT 'rules',
  created_by_agent TEXT NOT NULL DEFAULT '喵老板',
  decided_by TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_logs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  step TEXT NOT NULL,
  tool_name TEXT,
  tool_input_json TEXT,
  tool_output_json TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tl_task ON task_logs(task_id);
CREATE TABLE IF NOT EXISTS strategies (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'wecom-mock',
  predicted_cost REAL NOT NULL DEFAULT 0,
  predicted_uplift REAL NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_st_task ON strategies(task_id);
CREATE TABLE IF NOT EXISTS outreach_messages (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  strategy_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  failure_reason TEXT,
  external_id TEXT,
  sent_at TEXT,
  reply_intent TEXT,
  reply_text TEXT,
  replied_at TEXT,
  engine TEXT NOT NULL DEFAULT 'rules',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_om_task ON outreach_messages(task_id);
CREATE TABLE IF NOT EXISTS coupon_grants (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'granted',
  granted_at TEXT NOT NULL,
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  task_id TEXT,
  member_id TEXT NOT NULL,
  proposed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS finance_entries (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  task_id TEXT,
  strategy_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  occurred_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS member_cats (
  member_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  colorway TEXT NOT NULL DEFAULT 'orange',
  xp INTEGER NOT NULL DEFAULT 0,
  lv INTEGER NOT NULL DEFAULT 1,
  decorations_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_configs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'glm',
  base_url TEXT NOT NULL DEFAULT 'https://open.bigmodel.cn/api/paas/v4',
  model TEXT NOT NULL DEFAULT 'glm-4-flash',
  api_key TEXT,
  engine_mode TEXT NOT NULL DEFAULT 'auto',
  mock_fail_rate REAL NOT NULL DEFAULT 0.08,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
`;
