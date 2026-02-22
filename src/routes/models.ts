/**
 * GET /v1/models - OpenAI-compatible model list.
 */

import type { ModelsListResponse } from "../types.js";
import type { InferenceEngine } from "../model/InferenceEngine.js";

export function handleGetModels(engine: InferenceEngine): ModelsListResponse {
  return {
    object: "list",
    data: [
      {
        id: engine.modelId,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "llmwebgpu",
        meta: engine.isReady
          ? { status: "loaded" }
          : { status: "loading" },
      },
    ],
  };
}
