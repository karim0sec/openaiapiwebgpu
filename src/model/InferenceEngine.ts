/**
 * WebGPU-backed LLM inference engine using @huggingface/transformers.
 * Wraps the pipeline for chat completion with OpenAI-compatible message format.
 * Uses ONNX Runtime session_options for memory handling (arena shrinkage, etc.).
 */

import { pipeline, type TextGenerationPipeline } from "@huggingface/transformers";
import type { AnyMessage } from "../types.js";

export interface InferenceConfig {
  modelId: string;
  device?: "webgpu";
  dtype?: string;
  sessionOptions?: Record<string, unknown>;
}

export interface GenerationOptions {
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  do_sample?: boolean;
  stop?: string[];
}

export interface CompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export class InferenceEngine {
  private pipeline: TextGenerationPipeline | null = null;
  private readonly config: InferenceConfig;

  constructor(config: InferenceConfig) {
    this.config = config;
  }

  get isReady(): boolean {
    return this.pipeline !== null;
  }

  get modelId(): string {
    return this.config.modelId;
  }

  /** Load model onto WebGPU. Call once before first inference. */
  async load(): Promise<void> {
    if (this.pipeline) return;

    console.log(`[InferenceEngine] Loading model ${this.config.modelId} on WebGPU...`);
    const pipelineOpts: Record<string, unknown> = {
      device: this.config.device ?? "webgpu",
      dtype: this.config.dtype ?? "q4",
    };
    if (this.config.sessionOptions && Object.keys(this.config.sessionOptions).length > 0) {
      pipelineOpts.session_options = this.config.sessionOptions;
    }
    this.pipeline = await pipeline("text-generation", this.config.modelId, pipelineOpts);
    console.log("[InferenceEngine] Model loaded.");
  }

  /** Convert OpenAI messages to HuggingFace Message format. */
  private toHfMessages(messages: AnyMessage[]): Array<{ role: string; content: string }> {
    const hf: Array<{ role: string; content: string }> = [];

    for (const m of messages) {
      let content = typeof m.content === "string" ? m.content : (m.content ?? "");
      let role = m.role;

      if (m.role === "tool") {
        role = "user";
        content = `[Tool result]\n${content}`;
      }
      if (content) hf.push({ role, content });
    }

    return hf;
  }

  /** Count tokens using tokenizer (approximate). */
  private countTokens(text: string): number {
    if (!this.pipeline?.tokenizer) return 0;
    try {
      const enc = this.pipeline.tokenizer.encode(text, { add_special_tokens: false });
      return Array.isArray(enc) ? enc.length : (enc as { length: number }).length;
    } catch {
      return Math.ceil(text.length / 4); // Fallback heuristic
    }
  }

  /**
   * Run chat completion. Returns assistant text and token counts.
   */
  async complete(
    messages: AnyMessage[],
    opts: GenerationOptions = {}
  ): Promise<CompletionResult> {
    if (!this.pipeline) throw new Error("Model not loaded. Call load() first.");

    const hfMessages = this.toHfMessages(messages);
    if (hfMessages.length === 0) throw new Error("No valid messages to complete.");

    const maxNewTokens = opts.max_new_tokens ?? 256;
    const genOpts: Record<string, unknown> = {
      max_new_tokens: maxNewTokens,
      do_sample: opts.do_sample ?? (opts.temperature != null && opts.temperature > 0),
      temperature: opts.temperature ?? 0.7,
      top_p: opts.top_p,
    };
    if (opts.stop?.length) genOpts.stop_strings = opts.stop;

    const output = await this.pipeline(hfMessages, genOpts);
    const generated = output[0]?.generated_text;

    let assistantContent = "";
    if (Array.isArray(generated)) {
      const last = generated.at(-1);
      assistantContent = last?.content ?? "";
    } else if (typeof generated === "string") {
      assistantContent = generated;
    }

    const promptText = hfMessages.map((m) => m.content).join("\n");
    const promptTokens = this.countTokens(promptText);
    const completionTokens = this.countTokens(assistantContent);

    return {
      content: assistantContent,
      promptTokens,
      completionTokens,
    };
  }

  /** Release model resources. */
  async dispose(): Promise<void> {
    if (this.pipeline && typeof (this.pipeline as { dispose?: () => void }).dispose === "function") {
      (this.pipeline as { dispose: () => void }).dispose();
    }
    this.pipeline = null;
  }
}
