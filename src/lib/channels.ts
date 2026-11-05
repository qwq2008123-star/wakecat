/**
 * 消息通道适配器。演示环境使用 wecom-mock 演示通道;
 * 未来接入真实企微时实现同一接口即可。发送失败必须如实上报,禁止假装成功。
 */
export type SendResult =
  | { ok: true; externalId: string }
  | { ok: false; failureReason: string };

export async function sendMessage(opts: {
  channel: string;
  memberName: string;
  memberPhoneMasked: string;
  body: string;
  mockFailRate: number;
}): Promise<SendResult> {
  if (opts.channel !== "wecom-mock") {
    return { ok: false, failureReason: `通道 ${opts.channel} 未接入(当前仅支持 wecom-mock 演示通道)` };
  }
  // 模拟网络与平台波动,失败率由商家在设置页控制,默认 8%
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));
  if (Math.random() < opts.mockFailRate) {
    const reasons = [
      "企微接口超时(演示模拟),会员侧未收到消息",
      "企微接口返回 45009:频率限制,消息未送达",
      "会员 48 小时未互动,企微拒绝主动消息(演示模拟)",
    ];
    return { ok: false, failureReason: reasons[Math.floor(Math.random() * reasons.length)] };
  }
  if (opts.body.includes("未授权测试")) {
    return { ok: false, failureReason: "消息包含未授权内容标记,通道拒绝发送" };
  }
  return { ok: true, externalId: `mock_${Date.now()}_${Math.floor(Math.random() * 1e6)}` };
}
