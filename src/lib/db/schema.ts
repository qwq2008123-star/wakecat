import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/* ---------- 商家与员工 ---------- */
export const stores = sqliteTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerName: text("owner_name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const staffUsers = sqliteTable("staff_users", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(), // owner | staff
});

/* ---------- 会员域 ---------- */
export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  phoneMasked: text("phone_masked").notNull(), // 138****1234,脱敏存储
  gender: text("gender").notNull().default("未知"),
  birthdayText: text("birthday_text"),
  level: text("level").notNull().default("普通"), // 普通 | 白银 | 黄金 | 钻石
  joinedAt: text("joined_at").notNull(),
  tagsJson: text("tags_json").notNull().default("[]"),
  notes: text("notes"),
  isDemo: integer("is_demo").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

export const consumptionRecords = sqliteTable("consumption_records", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id").notNull(),
  service: text("service").notNull(),
  amount: real("amount").notNull(),
  artist: text("artist").notNull(),
  note: text("note"),
  occurredAt: text("occurred_at").notNull(),
});

/* 每条记忆必须带来源,禁止 AI 编造事实 */
export const memberMemories = sqliteTable("member_memories", {
  id: text("id").primaryKey(),
  memberId: text("member_id").notNull(),
  kind: text("kind").notNull(), // fact | preference | event | feedback
  content: text("content").notNull(),
  sourceType: text("source_type").notNull(), // order | chat | manual | agent_inferred
  sourceRef: text("source_ref").notNull(), // 如 consumption_record:id / chat:2026-08-12 / manual:老板娘
  confidence: real("confidence").notNull().default(1),
  createdAt: text("created_at").notNull(),
  createdByAgent: text("created_by_agent"),
});

/* ---------- 任务域 ---------- */
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  type: text("type").notNull(), // awaken_campaign | birthday_care | new_item_launch ...
  title: text("title").notNull(),
  goal: text("goal").notNull(), // 商家原始自然语言目标
  status: text("status").notNull().default("draft"),
  // draft -> pending_approval -> approved | rejected -> running -> completed | failed
  payloadJson: text("payload_json").notNull().default("{}"), // 侦探分析、机会清单等
  resultJson: text("result_json").notNull().default("{}"), // 财务复盘报告
  costEstimate: real("cost_estimate").notNull().default(0),
  engine: text("engine").notNull().default("rules"), // llm | rules(本任务实际使用的引擎)
  createdByAgent: text("created_by_agent").notNull().default("喵老板"),
  decidedBy: text("decided_by"),
  decidedAt: text("decided_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const taskLogs = sqliteTable("task_logs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  agent: text("agent").notNull(), // 喵老板 | 侦探喵 | 军师喵 | 销售喵 | 财务喵
  step: text("step").notNull(),
  toolName: text("tool_name"),
  toolInputJson: text("tool_input_json"),
  toolOutputJson: text("tool_output_json"),
  message: text("message"),
  status: text("status").notNull().default("ok"), // ok | error
  createdAt: text("created_at").notNull(),
});

export const strategies = sqliteTable("strategies", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  memberId: text("member_id").notNull(),
  kind: text("kind").notNull(), // coupon | new_item | rights | callback
  content: text("content").notNull(),
  channel: text("channel").notNull().default("wecom-manual"),
  predictedCost: real("predicted_cost").notNull().default(0),
  predictedUplift: real("predicted_uplift").notNull().default(0),
  reason: text("reason"),
  createdAt: text("created_at").notNull(),
});

export const outreachMessages = sqliteTable("outreach_messages", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull(),
  strategyId: text("strategy_id").notNull(),
  memberId: text("member_id").notNull(),
  channel: text("channel").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  // draft -> queued -> sent | failed -> replied
  failureReason: text("failure_reason"),
  externalId: text("external_id"),
  sentAt: text("sent_at"),
  replyIntent: text("reply_intent"), // accept | price | decline
  replyText: text("reply_text"),
  repliedAt: text("replied_at"),
  engine: text("engine").notNull().default("rules"),
  createdAt: text("created_at").notNull(),
});

export const couponGrants = sqliteTable("coupon_grants", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  taskId: text("task_id").notNull(),
  memberId: text("member_id").notNull(),
  name: text("name").notNull(),
  value: real("value").notNull(),
  status: text("status").notNull().default("granted"), // granted | used | expired
  grantedAt: text("granted_at").notNull(),
  usedAt: text("used_at"),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  taskId: text("task_id"),
  memberId: text("member_id"),
  serviceName: text("service_name"),
  staffName: text("staff_name"),
  scheduledFor: text("scheduled_for"),
  source: text("source").notNull().default("seller"),
  proposedAt: text("proposed_at").notNull(),
  status: text("status").notNull().default("proposed"), // proposed | confirmed | visited | cancelled
  createdAt: text("created_at").notNull(),
});

export const financeEntries = sqliteTable("finance_entries", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  taskId: text("task_id"),
  strategyId: text("strategy_id"),
  type: text("type").notNull(), // cost | revenue
  amount: real("amount").notNull(),
  note: text("note"),
  occurredAt: text("occurred_at").notNull(),
});

/* ---------- 猫咪世界 ---------- */
export const memberCats = sqliteTable("member_cats", {
  memberId: text("member_id").primaryKey(),
  name: text("name").notNull(),
  colorway: text("colorway").notNull().default("orange"), // orange | gray | calico | cow | ragdoll
  xp: integer("xp").notNull().default(0),
  lv: integer("lv").notNull().default(1),
  decorationsJson: text("decorations_json").notNull().default("[]"),
  updatedAt: text("updated_at").notNull(),
});

/* ---------- 系统配置 ---------- */
export const agentConfigs = sqliteTable("agent_configs", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  provider: text("provider").notNull().default("glm"),
  baseUrl: text("base_url").notNull().default("https://open.bigmodel.cn/api/paas/v4"),
  model: text("model").notNull().default("glm-4-flash"),
  apiKey: text("api_key"), // 仅服务端可读,前端只显示掩码
  engineMode: text("engine_mode").notNull().default("auto"), // auto | llm | rules
  mockFailRate: real("mock_fail_rate").notNull().default(0.08),
  autoRun: integer("auto_run").notNull().default(0), // 全自动模式:编排完成自动批准+执行(闸门照常)
  updatedAt: text("updated_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  metaJson: text("meta_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

/* ---------- 销售转化系统 ---------- */
export const storeServices = sqliteTable("store_services", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  price: real("price").notNull(),
  cost: real("cost").notNull().default(0),
  durationMin: integer("duration_min").notNull().default(60),
  status: text("status").notNull().default("active"),
  isNew: integer("is_new").notNull().default(0),
  tagsJson: text("tags_json").notNull().default("[]"),
});

export const storeStaffSchedules = sqliteTable("store_staff_schedules", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  staffName: text("staff_name").notNull(),
  workDate: text("work_date").notNull(),
  startAt: text("start_at").notNull(),
  endAt: text("end_at").notNull(),
});

export const customerIdentities = sqliteTable("customer_identities", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id"),
  channel: text("channel").notNull(),
  externalUserId: text("external_user_id").notNull(),
  displayName: text("display_name"),
  createdAt: text("created_at").notNull(),
});

export const customerConsents = sqliteTable("customer_consents", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id").notNull(),
  channel: text("channel").notNull().default("any"),
  purpose: text("purpose").notNull().default("marketing"),
  status: text("status").notNull().default("allowed"),
  source: text("source"),
  updatedAt: text("updated_at").notNull(),
});

export const salesOpportunities = sqliteTable("sales_opportunities", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id").notNull(),
  score: real("score").notNull(),
  componentsJson: text("components_json").notNull().default("{}"),
  reason: text("reason"),
  recommendedAction: text("recommended_action"),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id"),
  identityId: text("identity_id"),
  channel: text("channel").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull(),
});

export const conversationMessages = sqliteTable("conversation_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  direction: text("direction").notNull(), // in | out
  content: text("content").notNull(),
  metaJson: text("meta_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id"),
  appointmentId: text("appointment_id"),
  taskId: text("task_id"),
  attribution: text("attribution").notNull().default("natural"),
  totalAmount: real("total_amount").notNull(),
  totalCost: real("total_cost").notNull().default(0),
  status: text("status").notNull().default("completed"),
  occurredAt: text("occurred_at").notNull(),
});

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  serviceId: text("service_id"),
  serviceName: text("service_name").notNull(),
  price: real("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const messageEvents = sqliteTable("message_events", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull(),
  eventType: text("event_type").notNull(),
  metaJson: text("meta_json").notNull().default("{}"),
  occurredAt: text("occurred_at").notNull(),
});

export const campaignMembers = sqliteTable("campaign_members", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  taskId: text("task_id").notNull(),
  memberId: text("member_id").notNull(),
  groupType: text("group_type").notNull().default("experiment"),
  attributionStatus: text("attribution_status").notNull().default("pending"),
});

/* ---------- AI 闺蜜猫咪(阶段2) ---------- */
export const cats = sqliteTable("cats", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  memberId: text("member_id").notNull(),
  name: text("name").notNull(),
  personality: text("personality").notNull().default("温柔体贴,记得住你说过的话"),
  colorway: text("colorway").notNull().default("orange"),
  energy: integer("energy").notNull().default(60),
  bond: integer("bond").notNull().default(10),
  level: integer("level").notNull().default(1),
  stage: text("stage").notNull().default("active"),
  decorationsJson: text("decorations_json").notNull().default("[]"),
  lastActiveAt: text("last_active_at").notNull(),
  adoptedAt: text("adopted_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const userMemories = sqliteTable("user_memories", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  userId: text("user_id").notNull(),
  catId: text("cat_id").notNull(),
  memoryType: text("memory_type").notNull(), // long_term_preference | short_term_interest | behavior | transaction | interaction
  category: text("category").notNull(),
  attribute: text("attribute").notNull(),
  value: text("value").notNull(),
  confidence: real("confidence").notNull().default(0.8),
  source: text("source").notNull(), // chat | image | order | correction | system
  sourceRef: text("source_ref"),
  userConfirmed: integer("user_confirmed").notNull().default(0),
  visibility: text("visibility").notNull().default("user_visible"),
  status: text("status").notNull().default("active"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const memoryFeedback = sqliteTable("memory_feedback", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull(),
  userId: text("user_id").notNull(),
  feedback: text("feedback").notNull(), // confirmed | corrected | deleted
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: text("created_at").notNull(),
});

export const userPreferences = sqliteTable("user_preferences", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  userId: text("user_id").notNull(),
  category: text("category").notNull(),
  attribute: text("attribute").notNull(),
  value: text("value").notNull(),
  confidence: real("confidence").notNull().default(0.8),
  updatedAt: text("updated_at").notNull(),
});

export const inspirationThemes = sqliteTable("inspiration_themes", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  auto: integer("auto").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const inspirationItems = sqliteTable("inspiration_items", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  userId: text("user_id").notNull(),
  themeId: text("theme_id"),
  title: text("title").notNull(),
  note: text("note"),
  imagePath: text("image_path"),
  productId: text("product_id"),
  serviceId: text("service_id"),
  styleTagsJson: text("style_tags_json").notNull().default("[]"),
  catNote: text("cat_note"),
  source: text("source").notNull().default("upload"),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imagePath: text("image_path"),
  price: real("price"),
  status: text("status").notNull().default("active"),
  source: text("source").notNull().default("merchant"),
  createdAt: text("created_at").notNull(),
});

export const productTags = sqliteTable("product_tags", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  tag: text("tag").notNull(),
});

export const recommendationCandidates = sqliteTable("recommendation_candidates", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  userId: text("user_id").notNull(),
  productId: text("product_id"),
  serviceId: text("service_id"),
  score: real("score").notNull().default(0),
  reason: text("reason"),
  status: text("status").notNull().default("candidate"),
  createdAt: text("created_at").notNull(),
});

export const recommendationEvents = sqliteTable("recommendation_events", {
  id: text("id").primaryKey(),
  candidateId: text("candidate_id").notNull(),
  userId: text("user_id").notNull(),
  eventType: text("event_type").notNull(),
  channel: text("channel"),
  createdAt: text("created_at").notNull(),
});

export const energyTransactions = sqliteTable("energy_transactions", {
  id: text("id").primaryKey(),
  catId: text("cat_id").notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  source: text("source").notNull(),
  delta: integer("delta").notNull(),
  relatedType: text("related_type"),
  relatedId: text("related_id"),
  dedupeKey: text("dedupe_key").notNull().unique(),
  reversed: integer("reversed").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const catEnergyLogs = sqliteTable("cat_energy_logs", {
  id: text("id").primaryKey(),
  catId: text("cat_id").notNull(),
  date: text("date").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const catBondLogs = sqliteTable("cat_bond_logs", {
  id: text("id").primaryKey(),
  catId: text("cat_id").notNull(),
  userId: text("user_id").notNull(),
  delta: integer("delta").notNull(),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
});

export const merchantActions = sqliteTable("merchant_actions", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  reason: text("reason"),
  memberId: text("member_id"),
  payloadJson: text("payload_json").notNull().default("{}"),
  status: text("status").notNull().default("open"),
  actedBy: text("acted_by"),
  createdAt: text("created_at").notNull(),
  actedAt: text("acted_at"),
});
