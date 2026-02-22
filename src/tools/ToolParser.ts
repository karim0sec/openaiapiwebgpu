/**
 * Parses tool calls from model output.
 * Supports OpenAI-style JSON tool call format for models that emit it.
 */

export interface ParsedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

const TOOL_CALL_REGEX = /(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;
const FUNCTION_NAME_REGEX = /"name"\s*:\s*"([^"]+)"/;
const FUNCTION_ARGS_REGEX = /"arguments"\s*:\s*(\{.*\}|"[^"]*")/;

/** Generate a unique tool call ID. */
export function generateToolCallId(): string {
  return `call_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract tool calls from assistant text.
 * Looks for JSON-like structures with "name" and "arguments" keys.
 */
export function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  const seen = new Set<string>();

  // Try to find JSON objects that look like tool calls
  const jsonCandidates = text.match(TOOL_CALL_REGEX) ?? [];

  for (const candidate of jsonCandidates) {
    try {
      const nameMatch = candidate.match(FUNCTION_NAME_REGEX);
      const argsMatch = candidate.match(FUNCTION_ARGS_REGEX);
      if (!nameMatch || !argsMatch) continue;

      const name = nameMatch[1];
      if (seen.has(name)) continue;

      let args: Record<string, unknown> = {};
      const argsStr = argsMatch[1];
      if (argsStr.startsWith("{")) {
        args = JSON.parse(argsStr) as Record<string, unknown>;
      } else if (argsStr.startsWith('"')) {
        try {
          const parsed = JSON.parse(argsStr) as string;
          args = typeof parsed === "string" ? (JSON.parse(parsed) as Record<string, unknown>) : { raw: parsed };
        } catch {
          args = { raw: argsStr };
        }
      }

      calls.push({
        id: generateToolCallId(),
        name,
        arguments: args,
      });
      seen.add(name);
    } catch {
      // Skip malformed JSON
    }
  }

  return calls;
}

/**
 * Check if the model output looks like it's trying to call a tool.
 */
export function hasToolCallIntent(text: string): boolean {
  return /"name"\s*:\s*"[^"]+"\s*,\s*"arguments"/.test(text) || /tool_call|function_call/.test(text.toLowerCase());
}
