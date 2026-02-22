/**
 * Executes tool calls and returns results for the assistant.
 */

import type { OpenAITool } from "../types.js";
import type { ParsedToolCall } from "./ToolParser.js";

export type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown> | unknown;

export class ToolExecutor {
  private handlers: Map<string, ToolHandler> = new Map();

  /** Register a handler for a tool name. */
  register(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  /** Check if a tool is available. */
  has(name: string): boolean {
    return this.handlers.has(name);
  }

  /** Execute a tool call. Returns string result for the model. */
  async execute(call: ParsedToolCall): Promise<string> {
    const handler = this.handlers.get(call.name);
    if (!handler) {
      return JSON.stringify({ error: `Unknown tool: ${call.name}` });
    }

    try {
      const result = await Promise.resolve(handler(call.name, call.arguments));
      return typeof result === "string" ? result : JSON.stringify(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: msg });
    }
  }

  /** Execute multiple tool calls in sequence. */
  async executeAll(calls: ParsedToolCall[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    for (const call of calls) {
      results.set(call.id, await this.execute(call));
    }
    return results;
  }

  /** Build tool definitions for system prompt when model doesn't support native tools. */
  static formatForPrompt(tools: OpenAITool[]): string {
    if (tools.length === 0) return "";

    const lines = tools.map((t) => {
      const name = t.function.name;
      const desc = t.function.description ?? "No description.";
      const params = t.function.parameters
        ? JSON.stringify(t.function.parameters)
        : "{}";
      return `- ${name}: ${desc} (parameters: ${params})`;
    });

    return `\n\nAvailable tools (respond with JSON: {"name":"<tool>","arguments":{...}}):\n${lines.join("\n")}`;
  }
}
