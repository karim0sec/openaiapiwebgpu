/**
 * OpenAI-compatible API types for llama.server-style endpoints.
 * @see https://platform.openai.com/docs/api-reference
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | null;
  name?: string;
}

export interface ToolCallPart {
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolCallMessage extends ChatMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface ToolMessage extends ChatMessage {
  role: "tool";
  content: string;
  tool_call_id: string;
}

export type AnyMessage = ChatMessage | ToolCallMessage | ToolMessage;

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface ChatCompletionRequest {
  model?: string;
  messages: AnyMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: "none" | "auto" | "required" | { type: "function"; function: { name: string } };
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  seed?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

export interface ChatCompletionChunkDelta {
  role?: "assistant";
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: ChatCompletionChunkDelta;
  finish_reason: string | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  system_fingerprint?: string;
}

export interface ModelInfo {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  meta?: Record<string, unknown>;
}

export interface ModelsListResponse {
  object: "list";
  data: ModelInfo[];
}

export interface CompletionRequest {
  model?: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface CompletionChoice {
  index: number;
  text: string;
  finish_reason: string | null;
}

export interface CompletionResponse {
  id: string;
  object: "text_completion";
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}
