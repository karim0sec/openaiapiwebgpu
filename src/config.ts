/**
 * Server configuration. WebGPU only. Override via environment variables.
 *
 * "Invalid Buffer" / "Failed to download data from buffer" errors are usually
 * GPU OOM. Use ORT_FREE_DIMENSION_SEQUENCE=256 (or 128) to cap memory, or
 * ORT_LOW_MEMORY=1 for a conservative default.
 */

export const config = {
  modelId: process.env.MODEL_ID ?? "HuggingFaceTB/SmolLM-135M-Instruct",
  port: parseInt(process.env.PORT ?? "8080", 10),
  host: process.env.HOST ?? "0.0.0.0",
  device: "webgpu" as const,
  dtype: process.env.DTYPE ?? "q4",
  maxTokensCap: parseInt(process.env.MAX_TOKENS_CAP ?? "2048", 10),
  defaultMaxTokens: parseInt(process.env.DEFAULT_MAX_TOKENS ?? "256", 10),
  /** Build ONNX Runtime session_options for memory handling (OOM mitigation). */
  getSessionOptions(): Record<string, unknown> {
    if (process.env.ORT_SESSION_OPTIONS_DISABLE === "1") return {};
    const opts: Record<string, unknown> = {
      enableCpuMemArena: false,
      enableMemPattern: false,
      extra: {
        session: { disable_prepacking: "1" },
        memory: { enable_memory_arena_shrinkage: "1" },
      },
    };
    let seqLen = process.env.ORT_FREE_DIMENSION_SEQUENCE;
    if (!seqLen && process.env.ORT_LOW_MEMORY === "1") {
      seqLen = "256";
    }
    if (seqLen) {
      opts.freeDimensionOverrides = {
        sequence_length: parseInt(seqLen, 10),
        total_sequence_length: parseInt(seqLen, 10),
      };
    }
    return opts;
  },
};
