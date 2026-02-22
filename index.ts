/**
 * LLM WebGPU API Server
 *
 * OpenAI-compatible API (llama.server style) without browser.
 * Uses @huggingface/transformers with WebGPU for local inference.
 *
 * Endpoints:
 *   GET  /v1/models            - List models
 *   POST /v1/completions        - Text completion (prompt-based)
 *   POST /v1/chat/completions   - Chat completion (tool calling supported)
 *   GET  /v1/health             - Health check
 *
 * Env: MODEL_ID, PORT, HOST, DTYPE
 *       ORT_FREE_DIMENSION_SEQUENCE - cap sequence len (e.g. 256) for low VRAM
 *       ORT_LOW_MEMORY=1 - use conservative sequence cap 256 (for "Invalid Buffer" OOM errors)
 *       ORT_SESSION_OPTIONS_DISABLE=1 - skip ONNX session options if they cause issues
 */

import { InferenceEngine } from "./src/model/InferenceEngine.js";
import { ToolExecutor } from "./src/tools/ToolExecutor.js";
import { ApiServer } from "./src/server.js";
import { config } from "./src/config.js";

async function main() {
  const engine = new InferenceEngine({
    modelId: config.modelId,
    device: config.device,
    dtype: config.dtype,
    sessionOptions: config.getSessionOptions(),
  });

  const toolExecutor = new ToolExecutor();
  toolExecutor.register("get_weather", (_, args) => {
    const loc = (args.location as string) ?? "unknown";
    return { location: loc, temp: 72, unit: "fahrenheit" };
  });
  toolExecutor.register("get_joke", () => ({
    joke: "Why did the developer quit? Because they didn't get arrays.",
  }));

  await engine.load();

  const server = new ApiServer(engine, toolExecutor, {
    port: config.port,
    host: config.host,
  });
  server.listen();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
