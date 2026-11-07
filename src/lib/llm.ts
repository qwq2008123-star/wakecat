import { db } from "./db/client";
import { agentConfigs } from "./db/schema";
import { eq } from "drizzle-orm";

export type LlmConfig = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string | null;
  engineMode: "auto" | "llm" | "rules";
  mockFailRate: number;
  autoRun: boolean;
};

export async function getLlmConfig(storeId: string): Promise<LlmConfig> {
  const rows = await db.select().from(agentConfigs).where(eq(agentConfigs.storeId, storeId)).limit(1);
  const c = rows[0];
  return {
    provider: c?.provider ?? "glm",
    baseUrl: c?.baseUrl ?? process.env.GLM_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
    model: c?.model ?? process.env.GLM_MODEL ?? "glm-4-flash",
    apiKey: c?.apiKey ?? process.env.GLM_API_KEY ?? null,
    engineMode: (c?.engineMode as LlmConfig["engineMode"]) ?? "auto",
    mockFailRate: c?.mockFailRate ?? 0.08,
    autoRun: !!c?.autoRun,
  };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ToolSchema = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolLoopResult = {
  text: string;
  engine: "llm" | "rules";
  toolCallCount: number;
  error?: string;
};

/**
 * OpenAI 兼容的 function-calling 循环(适配智谱 GLM)。
 * onToolCall 回调会把每次真实工具调用(入参/出参)交给上层写日志。
 * 任何网络/格式错误都向上返回 error,由调用方决定降级到规则引擎,绝不假装成功。
 */
export async function runToolLoop(opts: {
  config: LlmConfig;
  system: string;
  messages: ChatMessage[];
  tools: ToolSchema[];
  maxRounds?: number;
  onToolCall?: (name: string, args: unknown, output: unknown) => Promise<void> | void;
  executeTool: (name: string, args: unknown) => Promise<unknown> | unknown;
}): Promise<ToolLoopResult> {
  const { config, system, messages, tools, executeTool } = opts;
  const maxRounds = opts.maxRounds ?? 6;
  if (!config.apiKey) {
    return { text: "", engine: "rules", toolCallCount: 0, error: "未配置 API Key" };
  }
  let toolCallCount = 0;
  const convo: ChatMessage[] = [
    { role: "system", content: system },
    ...messages,
  ];
  try {
    for (let round = 0; round < maxRounds; round++) {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: convo,
          tools: tools.length ? tools : undefined,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`GLM HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const choice = data.choices?.[0]?.message;
      if (!choice) throw new Error("GLM 返回格式异常:缺少 choices[0].message");
      const toolCalls: ToolCall[] = choice.tool_calls ?? [];
      if (!toolCalls.length) {
        return { text: choice.content ?? "", engine: "llm", toolCallCount };
      }
      convo.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
      for (const tc of toolCalls) {
        let args: unknown = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
        let output: unknown;
        try {
          output = await executeTool(tc.function.name, args);
          toolCallCount++;
          await opts.onToolCall?.(tc.function.name, args, output);
        } catch (e) {
          output = { error: String(e instanceof Error ? e.message : e) };
          await opts.onToolCall?.(tc.function.name, args, output);
        }
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(output).slice(0, 8000),
        });
      }
    }
    throw new Error(`工具调用超过最大轮数(${maxRounds})`);
  } catch (e) {
    return {
      text: "", engine: "rules", toolCallCount,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
