"use client";

/* 演示提词卡:路演全程讲稿 + 点击动线 + Q&A。仅供老板娘演示使用。 */
import { PageHeader } from "@/components/world/ui";
import CatCharacter from "@/components/world/CatCharacter";

const SECTIONS = [
  {
    t: "开场钩子 · 30 秒",
    time: "00:00",
    lines: [
      { b: "美甲店老板娘最痛的不是没客户,是通讯录里躺着 2800 个会员,一半以上再也没回来过。" },
      { b: "发优惠券?客户直接拉黑。打电话?尴尬。" },
      { n: "我们做的是 WAKECAT——把店里每个会员变成一只专属的 AI 闺蜜猫。卡余额是猫的体力,三个月没来,猫就冬眠了。AI 替老板娘一只一只唤醒它们——不是群发广告,是像朋友一样聊天。" },
    ],
    click: "📱 打开宣传首页 landing.html(第一屏就是这句钩子)",
  },
  {
    t: "第 1 步 · 一键演示,看 AI 团队干活",
    time: "00:30 → 01:30",
    lines: [
      { b: "老板娘只说一句话:『把 45 天没来的高价值会员唤回来,预算 50 元』。" },
      { n: "看进度条——喵老板理解目标,侦探喵用真实工具体检 60 个会员,军师喵逐个调档案定策略,销售喵写消息,财务喵复盘。它们不是聊天机器人,是真的在调工具、真的写数据库。" },
      { b: "指着日志念一条:「比如给麻薯的——『记得白边要窄一点的要求,生日月还有小惊喜』——这来自她上次的真实消费记录,每条消息引用的都是这个客户的记忆。」" },
    ],
    click: "🖱️ 任务大厅 → 点「一键演示」→ 盯住五角色进度条(绿=完成,紫=运行中)",
  },
  {
    t: "第 2 步 · 三道闸门",
    time: "01:30 → 02:00",
    lines: [
      { b: "但 AI 不是想发就发。授权、频次、预算三道闸门:客户没授权就不发、14 天最多 2 次、超出预算直接拒。" },
      { b: "刚才就有几条被拦了——每个拦截都有理由,全部可审计。AI 团队作业,但老板娘的生意和客户的感受,规则说了算。" },
    ],
    click: "🖱️ 指任务卡执行日志里的『触达被业务规则拦截(频次/预算)』行",
  },
  {
    t: "第 3 步 · 客户收到什么",
    time: "02:00 → 03:00",
    lines: [
      { b: "客户这边呢?打开小程序——她收到的是:「小满~记得你喜欢带闪的纯色跳色,这周有空来做个新的吗?✨」" },
      { b: "不是『亲爱的会员您好』。它记得她喜欢什么、做过什么、甚至嫌什么颜色显黑。" },
    ],
    click: "🖱️ 打开 /customer/miaowu → 闺蜜聊天(演示账号里已有历史消息)",
  },
  {
    t: "第 4 步 · 猫的生命周期",
    time: "03:00 → 03:30",
    lines: [
      { b: "这只猫有生命周期:能量来自真实消费和日常陪伴,用完会休眠——但休眠不清记忆、不清亲密度、唤醒永远免费。" },
      { b: "我们不用死亡和焦虑逼客户花钱。" },
    ],
    click: "🖱️ C端成长中心 → 能量来源三行(消费/陪伴/灵感)+ 造型选择可顺带展示",
  },
  {
    t: "收尾 · 一句话",
    time: "03:30 → 04:00",
    lines: [
      { b: "传统 CRM 记录客户,是为了把他们发烦。" },
      { b: "WAKECAT 记住客户,是为了在他们需要的时候,刚好出现——该联系时联系,该沉默时沉默。这就是 AI+商业该有的样子。" },
    ],
    click: "🖱️ 回驾驶舱,停在工作日志滚动画面收尾",
  },
];

const QA = [
  {
    q: "这些数据是真的吗?",
    a: "全部真实:SQLite 落库 30+ 张表,每条消息有状态(送达/排队/拦截+原因),每次决策可审计,退款会真实回滚能量和账目。演示会员是种子数据,但机制全部真实。",
  },
  {
    q: "和微信群发有什么区别?",
    a: "三条:①个性化——引用客户自己的记忆,不是换名字的模板;②克制——有频次上限和授权,宁可沉默不发广告;③双向——客户回复直接进对话,AI 接得住,还能真实预约到店。",
  },
  {
    q: "商业价值在哪?",
    a: "唤醒一个沉睡会员 = 一笔 ¥100-200 的回流消费,成本几乎为零。而且猫的陪伴与消费解耦——不消费的客户也得到服务,留存和转介绍才是长期价值。",
  },
];

const REDLINES = [
  "提前点一次「一键演示」热场,正式讲时点第二次——现场 LLM 可能慢,别让评委干等",
  "别说「已接入微信/短信」——当前是站内通道,如实说「企微通道已留好接口」",
  "LLM 超时降级到规则引擎时,大方指着日志说:「大模型失败了,系统诚实降级并明确标注——商业系统里诚实比表演重要」",
  "执行直播时停留在任务大厅页,进度条和日志都在那里;切页会错过直播",
];

export default function PitchPage() {
  return (
    <div className="space-y-5 max-w-[860px]">
      <PageHeader
        title="演示提词卡"
        desc="路演全程讲稿 + 点击动线 + Q&A。总时长约 4 分钟;左侧顺序即演示顺序。"
      />

      {SECTIONS.map((sec, i) => (
        <div key={i} className="surface p-5" style={{ borderLeft: "3px solid var(--brand-2)" }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[22px] font-extrabold" style={{ color: "var(--brand-2)" }}>{sec.time}</span>
            <b className="text-[15px]">{sec.t}</b>
          </div>
          <div className="space-y-2.5 mb-3">
            {sec.lines.map((l, j) => (
              <p key={j} className="text-[14.5px] leading-relaxed" style={{ color: l.b ? "var(--wc-text, #E9EEFB)" : "var(--ink-2)", fontWeight: l.b ? 600 : 400 }}>
                {l.b ? `「${l.b}」` : l.n}
              </p>
            ))}
          </div>
          <div className="panel2 px-3.5 py-2.5 text-[12px]" style={{ color: "var(--brand-2)" }}>
            {sec.click}
          </div>
        </div>
      ))}

      <div className="surface p-5">
        <div className="flex items-center gap-2 mb-3">
          <CatCharacter colorway="orange" state="awake" accessory={null} size={30} />
          <b className="text-[15px]">评委必问 3 题</b>
        </div>
        <div className="space-y-3">
          {QA.map((x, i) => (
            <div key={i} className="panel2 p-4">
              <p className="text-[13.5px] font-bold">Q{i + 1}:{x.q}</p>
              <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--ink-2)" }}>{x.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="surface p-5" style={{ borderLeft: "3px solid var(--red)" }}>
        <b className="text-[15px]" style={{ color: "var(--red)" }}>⚠ 四条演示红线</b>
        <div className="space-y-2 mt-3">
          {REDLINES.map((r, i) => (
            <p key={i} className="text-[13px] leading-relaxed">{i + 1}. {r}</p>
          ))}
        </div>
      </div>

      <div className="surface p-5 text-center">
        <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
          动线总览:宣传首页 → 任务大厅一键演示(直播) → 驾驶舱行动清单 → C端小屋收信 → 成长中心
        </p>
      </div>
    </div>
  );
}
