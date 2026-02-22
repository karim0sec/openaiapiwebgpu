/**
 * POST /v1/chat/completions - OpenAI-compatible chat completion with tool calling.
 */

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  AnyMessage,
  ChatMessage,
  ToolMessage,
} from "../types.js";
import type { InferenceEngine } from "../model/InferenceEngine.js";
import type { ToolExecutor } from "../tools/ToolExecutor.js";
import { parseToolCalls, hasToolCallIntent } from "../tools/ToolParser.js";
import { config } from "../config.js";

const DEFAULT_MODEL = "smollm";
const MAX_TOOL_ITERATIONS = 5;

/** Clamp max_tokens to avoid WebGPU OOM. */
function clampMaxTokens(value?: number): number {
  const requested = value ?? config.defaultMaxTokens;
  return Math.min(Math.max(1, requested), config.maxTokensCap);
}

function generateCompletionId(): string {
  return `chatcmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 13)}`;
}

function ensureModel(model?: string): string {
  return model ?? DEFAULT_MODEL;
}

/** Convert OpenAI message to simple chat format, optionally appending tool definitions. */
function prepareMessages(
  messages: AnyMessage[],
  toolsPrompt?: string
): AnyMessage[] {
  const out: AnyMessage[] = [];

  for (const m of messages) {
    if (m.role === "tool") {
      out.push(m);
      continue;
    }

    let content = typeof m.content === "string" ? m.content : (m.content ?? "");

    if (m.role === "system" && toolsPrompt) {
      content = content + toolsPrompt;
    }

    out.push({ ...m, content } as ChatMessage);
  }

  return out;
}

/** Single completion turn with optional tool execution loop. */
export async function handleChatCompletion(
  engine: InferenceEngine,
  toolExecutor: ToolExecutor,
  req: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const model = ensureModel(req.model);
  const maxTokens = clampMaxTokens(req.max_tokens);
  const tools = req.tools ?? [];
  const toolChoice = req.tool_choice ?? "auto";
  const forceTools = toolChoice === "required" || (typeof toolChoice === "object" && toolChoice.type === "function");

  const toolsPrompt =
    tools.length > 0
      ? ToolExecutor.formatForPrompt(tools)
      : undefined;

  let messages = prepareMessages(req.messages, toolsPrompt);
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let lastContent = "";
  let iterations = 0;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++;

    const result = await engine.complete(messages, {
      max_new_tokens: maxTokens,
      temperature: req.temperature,
      top_p: req.top_p,
      stop: Array.isArray(req.stop) ? req.stop : req.stop ? [req.stop] : undefined,
    });

    totalPromptTokens += result.promptTokens;
    totalCompletionTokens += result.completionTokens;
    lastContent = result.content;

    const hasTools = tools.length > 0;
    const parsed = hasTools ? parseToolCalls(result.content) : [];

    if (parsed.length === 0) {
      if (forceTools && hasTools && hasToolCallIntent(result.content)) {
        messages.push({
          role: "assistant",
          content: result.content,
        });
        messages.push({
          role: "user",
          content: "Please call a tool with valid JSON format: {\"name\":\"<tool_name>\",\"arguments\":{...}}",
        });
        continue;
      }
      break;
    }

    const results = await toolExecutor.executeAll(parsed);

    messages.push({
      role: "assistant",
      content: result.content,
      tool_calls: parsed.map((p) => ({
        id: p.id,
        type: "function" as const,
        function: { name: p.name, arguments: JSON.stringify(p.arguments) },
      })),
    });

    for (const call of parsed) {
      messages.push({
        role: "tool",
        content: results.get(call.id) ?? "{}",
        tool_call_id: call.id,
      } as ToolMessage);
    }

    if (parsed.length === 0) break;
  }

  const id = generateCompletionId();
  const choice = {
    index: 0,
    message: {
      role: "assistant" as const,
      content: lastContent || null,
    },
    finish_reason: "stop" as const,
  };

  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [choice],
    usage: {
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      total_tokens: totalPromptTokens + totalCompletionTokens,
    },
    system_fingerprint: `llmwebgpu-${model}`,
  };
}
