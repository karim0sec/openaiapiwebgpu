export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
  stop?: string[];
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  logprobs?: boolean | { top_tokens?: number };
  echo?: boolean;
  seed?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  top_k?: number;
  min_p?: number;
  repeat_penalty?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: Partial<ChatMessage>;
  finish_reason: 'stop' | 'length' | 'tool_calls' | null;
}

export interface CompletionRequest {
  model: string;
  prompt: string | string[];
  suffix?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  logprobs?: number | null;
  echo?: boolean;
  stop?: string[];
  seed?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  best_of?: number;
  top_k?: number;
  min_p?: number;
  repeat_penalty?: number;
}

export interface CompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: Usage;
}

export interface CompletionChoice {
  text: string;
  index: number;
  logprobs: Logprobs | null;
  finish_reason: 'stop' | 'length' | null;
}

export interface Logprobs {
  tokens: string[];
  token_logprobs: number[];
  top_logprobs: Record<string, number>[];
  text_offset: number[];
}

export interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
}

export interface EmbeddingResponse {
  object: 'list';
  data: Embedding[];
  usage: Usage;
  model: string;
}

export interface Embedding {
  object: 'embedding';
  embedding: number[];
  index: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelInfo {
  id: string;
  object: 'model';
  owned_by: string;
  permissions: string[];
}

export interface ModelList {
  object: 'list';
  data: ModelInfo[];
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model?: string;
}

export type ResponseInputItem = 
  | string 
  | ResponseInputMessage 
  | ResponseInputText 
  | ResponseInputImage;

export interface ResponseInputMessage {
  type: 'message';
  role: 'system' | 'user' | 'developer' | 'assistant';
  content: string | ResponseInputContent[];
}

export interface ResponseInputText {
  type: 'input_text';
  text: string;
}

export interface ResponseInputImage {
  type: 'input_image';
  image_url?: string;
  file_id?: string;
  detail?: 'low' | 'high' | 'auto';
}

export type ResponseInputContent = ResponseInputText | ResponseInputImage;

export interface ResponsesRequest {
  model: string;
  input?: ResponseInputItem | ResponseInputItem[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  repeat_penalty?: number;
  stop?: string[];
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

export interface ResponsesResponse {
  id: string;
  object: 'response';
  created: number;
  model: string;
  output: ResponseOutputItem[];
  usage: Usage;
}

export type ResponseOutputItem = 
  | ResponseOutputMessage 
  | ResponseOutputReasoning;

export interface ResponseOutputMessage {
  type: 'message';
  id: string;
  role: 'assistant';
  content: ResponseOutputContent[];
}

export interface ResponseOutputContent {
  type: 'output_text';
  text: string;
  annotations?: unknown[];
}

export interface ResponseOutputReasoning {
  type: 'reasoning';
  id: string;
  summary: { type: 'summary_text'; text: string }[];
}

export interface ResponsesChunk {
  id: string;
  object: 'response';
  created: number;
  model: string;
  output: ResponseStreamDelta[];
}

export interface ResponseStreamDelta {
  type: 'message_delta';
  id: string;
  delta: {
    role?: 'assistant';
    content?: string;
  };
  usage?: {
    output_tokens: number;
  };
}
