import { db, sqlite } from "./db/client";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import {
  stores, staffUsers, members, consumptionRecords, memberMemories,
  memberCats, agentConfigs, storeServices, storeStaffSchedules, customerConsents,
} from "./db/schema";
import { sql } from "drizzle-orm";

/* 确定性随机,保证演示数据可复现 */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261106);
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const ri = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));

const STORE_ID = "store_demo_001";
const NOW = new Date("2026-11-06T10:00:00+08:00");
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => iso(new Date(NOW.getTime() - n * 86400_000));

const SERVICES = [
  { name: "猫眼款美甲", amount: 128 },
  { name: "法式白边", amount: 108 },
  { name: "极光粉", amount: 138 },
  { name: "碎钻款", amount: 168 },
  { name: "手绘小花", amount: 158 },
  { name: "渐变晕染", amount: 148 },
  { name: "纯色跳色", amount: 98 },
  { name: "卸甲+手部护理", amount: 68 },
];
const ARTISTS = ["小林", "小周", "阿柒", "美美"];
const COLORWAYS = ["orange", "gray", "calico", "cow", "ragdoll"];

const NICKS = [
  "王姐", "李李", "芳芳", "楠楠", "璐璐", "陈小姐", "妹妹", "月月", "周阿姨", "小鹿",
  "图图", "可可", "琳达", "桃子", "球球", "安安", "米娅", "朵朵", "西西", "佳佳",
  "贝拉", "小雨", "七七", "芒果", "汤圆", "布丁", "芝麻", "椰奶", "奶茶", "豆豆",
  "妞妞", "糖糖", "果冻", "雪梨", "星星", "月亮", "云朵", "南南", "北北", "一一",
  "半半", "多多", "乐乐", "悠悠", "皮皮", "蛋卷", "麻薯", "年糕", "瓜子", "花生",
  "小满", "立夏", "谷雨", "白露", "霜霜", "大雪", "冬至", "小寒", "惊蛰", "春分",
];

const QUIPS = [
  "嫌蓝绿色显黑", "约会前必来做", "要拍照发小红书", "白边要窄一点",
  "小花画在左手", "喜欢带闪的", "怕磨得疼,手法要轻", "带闺蜜一起来",
  "喜欢聊八卦", "想试镭射款", "对猫过敏但爱看猫", "每次都坐靠窗位",
];

export function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function ensureSeeded() {
  const row = sqlite.prepare("SELECT COUNT(*) as c FROM stores").get() as { c: number };
  if (row.c > 0) return;

  db.insert(stores).values({
    id: STORE_ID, name: "喵屋美甲 · 金山店", ownerName: "芳姐", createdAt: daysAgo(720),
  }).run();
  db.insert(staffUsers).values([
    {
      id: "user_owner", storeId: STORE_ID, name: "芳姐", role: "owner",
      // 生产部署:设置 WAKECAT_OWNER_PASSWORD 后,首次建库即写入老板娘登录密码(sha256 加盐)
      passwordHash: process.env.WAKECAT_OWNER_PASSWORD
        ? hashPassword(process.env.WAKECAT_OWNER_PASSWORD, "user_owner")
        : null,
    },
    { id: "user_staff", storeId: STORE_ID, name: "小林", role: "staff" },
  ]).run();
  db.insert(agentConfigs).values({
    id: "cfg_001", storeId: STORE_ID, provider: "glm",
    baseUrl: process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    model: process.env.GLM_MODEL || "glm-4-flash",
    apiKey: process.env.GLM_API_KEY || null,
    engineMode: "auto", mockFailRate: 0.08, updatedAt: iso(NOW),
  }).run();

  // 状态分布:活跃 20 / 打盹 18 / 冬眠 16 / 卡快过期 6
  const statusOf = (i: number): { days: number; tag: string } => {
    if (i < 20) return { days: ri(2, 30), tag: "active" };
    if (i < 38) return { days: ri(35, 75), tag: "drowsy" };
    if (i < 54) return { days: ri(80, 170), tag: "hibernate" };
    return { days: ri(20, 60), tag: "sick" };
  };

  for (let i = 0; i < 60; i++) {
    const { days, tag } = statusOf(i);
    const name = NICKS[i];
    const memberId = `m_${String(i + 1).padStart(3, "0")}`;
    const joinedDays = ri(200, 900);
    const years = Math.max(1, Math.round(joinedDays / 365));
    const level = tag === "active" && rnd() > 0.5 ? pick(["黄金", "钻石"]) : pick(["普通", "白银", "白银", "黄金"]);
    const service = pick(SERVICES);

    db.insert(members).values({
      id: memberId, storeId: STORE_ID, name,
      phoneMasked: `1${ri(3, 9)}8****${String(ri(1000, 9999))}`,
      gender: rnd() > 0.12 ? "女" : "男",
      birthdayText: `${ri(1, 12)}月${ri(1, 28)}日`,
      level, joinedAt: daysAgo(joinedDays),
      tagsJson: JSON.stringify([
        service.name.split("美甲")[0] + "党",
        pick(["话痨", "安静", "完美主义", "价格敏感", "尝鲜派"]),
        ...(tag === "sick" ? ["卡快过期"] : []),
      ]),
      notes: null, isDemo: 1, createdAt: daysAgo(joinedDays),
    }).run();

    // 6 个月消费记录:越近期越少(沉睡会员),活跃会员频率高
    const totalVisits = tag === "active" ? ri(5, 9) : tag === "drowsy" ? ri(3, 6) : ri(3, 7);
    const gap = Math.max(12, Math.floor(days / Math.max(1, totalVisits - 1)));
    let memoryCount = 0;
    for (let v = 0; v < totalVisits; v++) {
      const occurred = daysAgo(Math.min(days + ri(3, 30) + v * gap, joinedDays - 5));
      const svc = v === totalVisits - 1 ? service : pick(SERVICES);
      const recId = `cr_${memberId}_${v}`;
      db.insert(consumptionRecords).values({
        id: recId, storeId: STORE_ID, memberId, service: svc.name,
        amount: svc.amount + ri(-10, 20), artist: pick(ARTISTS),
        note: null, occurredAt: occurred,
      }).run();
      if (memoryCount < 3) {
        memoryCount++;
        db.insert(memberMemories).values({
          id: `mm_${memberId}_${memoryCount}`, memberId,
          kind: memoryCount === 1 ? "preference" : "fact",
          content:
            memoryCount === 1
              ? `偏爱「${service.name}」,曾提过${pick(QUIPS)}`
              : `做过「${svc.name}」,由${pick(ARTISTS)}服务`,
          sourceType: "order", sourceRef: `consumption_record:${recId}`,
          confidence: 1, createdAt: occurred, createdByAgent: null,
        }).run();
      }
    }

    // 老板娘手工记忆(有来源:manual)
    if (rnd() > 0.35) {
      db.insert(memberMemories).values({
        id: `mm_${memberId}_m1`, memberId, kind: pick(["preference", "event"]),
        content: pick([
          `上次聊天提到${pick(QUIPS)}`,
          `生日月喜欢收到小惊喜`,
          `介绍过${ri(1, 3)}位朋友来店里`,
          `喜欢靠窗的位置`,
        ]),
        sourceType: "manual", sourceRef: "manual:老板娘芳姐口述",
        confidence: 0.9, createdAt: daysAgo(ri(10, 80)), createdByAgent: null,
      }).run();
    }

    // 猫
    const catLv = Math.max(1, Math.min(9, totalVisits + ri(0, 2)));
    db.insert(memberCats).values({
      memberId, name: pick(["糯米", "橘座", "煤球", "雪球", "三三", "布偶", "芝麻", "汤圆", "年糕", "豆包"]) + i,
      colorway: pick(COLORWAYS), xp: totalVisits * 100 + ri(0, 80), lv: catLv,
      decorationsJson: JSON.stringify(catLv >= 6 ? ["美甲小皇冠"] : []),
      updatedAt: daysAgo(Math.min(days, 60)),
    }).run();
  }
}

/* ============================================================
   销售基础设施种子:可对已存在的旧库增量补充(与 ensureSeeded 解耦)
   ============================================================ */
export function ensureSalesSeed() {
  const has = sqlite.prepare("SELECT COUNT(*) as c FROM store_services").get() as { c: number };
  if (has.c > 0) return;

  const CATALOG: [string, number, number, number, boolean][] = [
    ["基础美甲", 98, 25, 60, false],
    ["纯色跳色", 98, 24, 60, false],
    ["法式白边", 108, 28, 75, false],
    ["猫眼款美甲", 158, 40, 90, false],
    ["渐变晕染", 148, 38, 85, false],
    ["极光粉", 138, 34, 80, true],
    ["猫眼镭射", 168, 44, 95, true],
    ["高级款美甲", 228, 70, 120, false],
    ["手部护理", 38, 10, 30, false],
    ["卸甲+手部护理", 68, 18, 45, false],
  ];
  CATALOG.forEach(([name, price, cost, dur, isNew], i) => {
    db.insert(storeServices).values({
      id: `svc_${String(i + 1).padStart(3, "0")}`, storeId: STORE_ID,
      name, price, cost, durationMin: dur, status: "active",
      isNew: isNew ? 1 : 0,
      tagsJson: JSON.stringify(isNew ? ["新品"] : []),
    }).run();
  });

  const base = new Date();
  for (let d = 0; d < 7; d++) {
    const day = new Date(base.getTime() + d * 86400_000).toISOString().slice(0, 10);
    ARTISTS.forEach((a, ai) => {
      if ((d + ai) % 5 === 4) return;
      db.insert(storeStaffSchedules).values({
        id: `sch_d${d}_a${ai}`, storeId: STORE_ID, staffName: a,
        workDate: day, startAt: "10:00", endAt: "20:00",
      }).run();
    });
  }

  const memberRows = sqlite.prepare("SELECT id FROM members WHERE store_id = ?").all(STORE_ID) as { id: string }[];
  const r2 = mulberry32(777);
  memberRows.forEach((m, i) => {
    db.insert(customerConsents).values({
      id: `cons_${m.id}`, storeId: STORE_ID, memberId: m.id,
      channel: "any", purpose: "marketing",
      status: i % 20 === 7 ? "unsubscribed" : "allowed",
      source: i % 20 === 7 ? "会员回复「以后不要联系」" : "入会协议默认勾选",
      updatedAt: new Date(Date.now() - Math.floor(r2() * 200) * 86400_000).toISOString(),
    }).run();
  });
}
