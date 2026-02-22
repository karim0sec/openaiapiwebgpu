/**
 * HTTP server exposing OpenAI-compatible API (llama.server style).
 */

import type { InferenceEngine } from "./model/InferenceEngine.js";
import type { ToolExecutor } from "./tools/ToolExecutor.js";
import { handleGetModels } from "./routes/models.js";
import { handleChatCompletion } from "./routes/chat.js";
import { handleCompletion } from "./routes/completions.js";
import type { ChatCompletionRequest, CompletionRequest } from "./types.js";

export interface ServerConfig {
  port: number;
  host?: string;
}

export class ApiServer {
  constructor(
    private readonly engine: InferenceEngine,
    private readonly toolExecutor: ToolExecutor,
    private readonly config: ServerConfig
  ) {}

  /** Return proper error response without crashing. Model OOM → 503, bad request → 400. */
  private errorResponse(err: unknown): Response {
    const msg = err instanceof Error ? err.message : String(err);
    const isModelError = /memory|OOM|buffer|WebGPU|Vulkan|device_memory|download/i.test(msg);
    const status = isModelError ? 503 : 400;
    const type = isModelError ? "model_error" : "invalid_request_error";
    console.error(`[ApiServer] ${type}:`, msg);
    return Response.json(
      { error: { message: msg, type } },
      { status }
    );
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    console.log(`[ApiServer] ${method} ${path}`);

    if (path === "/v1/health" || path === "/health") {
      return Response.json({ status: "ok", model: this.engine.modelId });
    }

    if (method === "GET" && path === "/v1/models") {
      const body = handleGetModels(this.engine);
      return Response.json(body);
    }

    if (method === "POST" && path === "/v1/completions") {
      try {
        const body = (await req.json()) as CompletionRequest;
        const response = await handleCompletion(this.engine, body);
        return Response.json(response);
      } catch (err) {
        return this.errorResponse(err);
      }
    }

    if (method === "POST" && path === "/v1/chat/completions") {
      try {
        const body = (await req.json()) as ChatCompletionRequest;
        const stream = body.stream === true;

        if (stream) {
          return await this.handleStreamingChat(body);
        }

        const response = await handleChatCompletion(
          this.engine,
          this.toolExecutor,
          body
        );
        return Response.json(response);
      } catch (err) {
        return this.errorResponse(err);
      }
    }

    return new Response(
      JSON.stringify({
        error: {
          message: `Not found: ${method} ${path}`,
          type: "invalid_request_error",
        },
      }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  /** Streaming: for now, buffer and send single chunk. Full SSE can be added later. */
  private async handleStreamingChat(body: ChatCompletionRequest): Promise<Response> {
    const nonStreamBody = { ...body, stream: false };
    let response;
    try {
      response = await handleChatCompletion(
        this.engine,
        this.toolExecutor,
        nonStreamBody
      );
    } catch (err) {
      return this.errorResponse(err);
    }

    const chunk = {
      id: response.id,
      object: "chat.completion.chunk" as const,
      created: response.created,
      model: response.model,
      choices: [
        {
          index: 0,
          delta: { role: "assistant" as const, content: response.choices[0].message.content },
          finish_reason: "stop",
        },
      ],
      system_fingerprint: response.system_fingerprint,
    };

    const encoder = new TextEncoder();
    const data = `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`;

    return new Response(encoder.encode(data), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  listen(): void {
    const host = this.config.host ?? "0.0.0.0";
    const port = this.config.port;

    const server = Bun.serve({
      host,
      port,
      fetch: (req) => this.handleRequest(req),
    });

    console.log(`[ApiServer] OpenAI-compatible API: http://${host}:${port}`);
    console.log(`[ApiServer] GET  /v1/models`);
    console.log(`[ApiServer] POST /v1/completions`);
    console.log(`[ApiServer] POST /v1/chat/completions`);
    console.log(`[ApiServer] GET  /v1/health`);
  }
}
