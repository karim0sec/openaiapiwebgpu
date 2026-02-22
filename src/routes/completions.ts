/**
 * POST /v1/completions - OpenAI-compatible text completion (prompt-based).
 */

import type { CompletionRequest, CompletionResponse } from "../types.js";
import type { InferenceEngine } from "../model/InferenceEngine.js";
import { config } from "../config.js";

const DEFAULT_MODEL = "smollm";

function clampMaxTokens(value?: number): number {
  const requested = value ?? config.defaultMaxTokens;
  return Math.min(Math.max(1, requested), config.maxTokensCap);
}

function generateId(): string {
  return `cmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function handleCompletion(
  engine: InferenceEngine,
  req: CompletionRequest
): Promise<CompletionResponse> {
  const model = req.model ?? DEFAULT_MODEL;
  const maxTokens = clampMaxTokens(req.max_tokens);

  const messages = [{ role: "user" as const, content: req.prompt }];
  const result = await engine.complete(messages, {
    max_new_tokens: maxTokens,
    temperature: req.temperature,
    stop: Array.isArray(req.stop) ? req.stop : req.stop ? [req.stop] : undefined,
  });

  return {
    id: generateId(),
    object: "text_completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        text: result.content,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      total_tokens: result.promptTokens + result.completionTokens,
    },
  };
}
