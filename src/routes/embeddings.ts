import { pipeline, FeatureExtractionPipeline } from '@huggingface/transformers';
import { BadRequestError } from '../lib/errors.js';
import type { EmbeddingRequest, EmbeddingResponse, Embedding } from '../lib/types.js';
import { config } from '../config.js';

let embeddingPipeline: FeatureExtractionPipeline | null = null;

async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  embeddingPipeline = await pipeline('feature-extraction', config.model, {
    device: 'webgpu',
    dtype: config.dtype as 'auto' | 'q4' | 'q8' | 'fp32' | 'fp16' | 'int8' | 'uint8' | 'bnb4' | 'q4f16',
  });

  return embeddingPipeline;
}

export async function handleEmbeddings(
  body: EmbeddingRequest
): Promise<EmbeddingResponse> {
  const model = body.model;
  const input = body.input;
  const encodingFormat = body.encoding_format ?? 'float';

  if (!input) {
    throw new BadRequestError('input is required');
  }

  const inputs = Array.isArray(input) ? input : [input];

  const pipe = await getEmbeddingPipeline();

  const embeddings: Embedding[] = await Promise.all(
    inputs.map(async (text, index) => {
      const output = await pipe(text, {
        pooling: 'mean',
        normalize: true,
      }) as any;

      const embeddingArray = Array.isArray(output) 
        ? output.flatMap((item: any) => Array.isArray(item) ? item : [item])
        : Array.from(output.data);

      return {
        object: 'embedding',
        embedding: embeddingArray,
        index,
      };
    })
  );

  const totalTokens = inputs.reduce((sum, text) => sum + Math.ceil(text.length / 4), 0);

  return {
    object: 'list',
    data: embeddings,
    usage: {
      prompt_tokens: totalTokens,
      completion_tokens: 0,
      total_tokens: totalTokens,
    },
    model: model,
  };
}
