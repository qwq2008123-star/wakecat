import { getSessionUser } from "@/lib/session";
import { getLlmStatus } from "@/lib/queries";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const llm = await getLlmStatus(user.storeId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">⚙️ 设置</h1>
      <SettingsForm
        initial={{
          engineMode: llm.engineMode, model: llm.model,
          hasKey: llm.hasKey, keyMasked: llm.keyMasked,
          mockFailRate: llm.mockFailRate, provider: llm.provider,
        }}
        role={user.role}
      />
      <div className="panel p-5 text-[13px] space-y-2">
        <div className="font-bold text-[15px]">🛡️ 合规与数据说明</div>
        <p style={{ color: "var(--ink2)" }}>
          · 会员手机号入库即脱敏(138****1234),任何页面与 Agent 工具都拿不到完整号码。<br />
          · 会员记忆必须带数据来源(消费流水 / 聊天记录 / 老板娘口述),AI 推断类记忆会被显著标注。<br />
          · 所有对外动作(发消息、发券)必须经老板审批,服务层强制校验任务状态,全程写 audit_log。<br />
          · 当前店铺数据为<b style={{ color: "var(--yellow)" }}>演示数据</b>(种子脚本生成,会员侧昵称已脱敏),与真实数据严格区分。<br />
          · 发送走「企微演示通道」:结构与真实企微接口一致,接入真实企微只需替换 channel 适配器。
        </p>
      </div>
    </div>
  );
}
