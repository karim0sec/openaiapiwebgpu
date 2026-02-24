import { pipeline, TextGenerationPipeline, PreTrainedTokenizer } from '@huggingface/transformers';
import { config } from '../config.js';

let textGenPipeline: TextGenerationPipeline | null = null;
let tokenizer: PreTrainedTokenizer | null = null;
let modelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

export async function getPipeline(): Promise<TextGenerationPipeline> {
  if (textGenPipeline) {
    return textGenPipeline;
  }

  if (modelLoading) {
    if (!modelLoadPromise) {
      throw new Error('Model is loading');
    }
    await modelLoadPromise;
    return textGenPipeline!;
  }

  modelLoading = true;
  modelLoadPromise = loadModel();

  try {
    await modelLoadPromise;
  } finally {
    modelLoading = false;
    modelLoadPromise = null;
  }

  return textGenPipeline!;
}

async function loadModel(): Promise<void> {
  if (config.verbose) {
    console.log(`Loading model: ${config.model} on WebGPU with dtype: ${config.dtype}`);
  }

  textGenPipeline = await pipeline('text-generation', config.model, {
    device: 'webgpu' ,
    dtype: config.dtype as 'auto' | 'q4' | 'q8' | 'fp32' | 'fp16' | 'int8' | 'uint8' | 'bnb4' | 'q4f16',
  });

  if (config.verbose) {
    console.log('Model loaded successfully');
  }
}

export async function getTokenizer(): Promise<PreTrainedTokenizer> {
  if (!tokenizer) {
    const { PreTrainedTokenizer } = await import('@huggingface/transformers');
    tokenizer = await PreTrainedTokenizer.from_pretrained(config.model);
  }
  return tokenizer;
}

export function isModelLoaded(): boolean {
  return textGenPipeline !== null;
}

export function getModelId(): string {
  return config.model;
}

export function getModelAlias(): string {
  return config.modelAlias;
}

export interface GenerationOptions {
  max_new_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  repetition_penalty?: number;
  do_sample?: boolean;
  seed?: number;
  stop?: string[];
}

export async function generate(
  prompt: string | { role: string; content: string }[],
  options: GenerationOptions = {}
): Promise<{ generated_text: { role: string; content: string }[] }> {
  const pipe = await getPipeline();

  const maxNewTokens = options.max_new_tokens ?? 256;
  const temperature = options.temperature ?? 0.8;
  const topP = options.top_p ?? 0.95;
  const topK = options.top_k ?? 40;
  const minP = options.min_p ?? 0.05;
  const repetitionPenalty = options.repetition_penalty ?? 1.1;
  const doSample = temperature > 0;

  const genOptions: Record<string, unknown> = {
    max_new_tokens: maxNewTokens,
    temperature: temperature,
    top_p: topP,
    top_k: topK,
    min_p: minP,
    repetition_penalty: repetitionPenalty,
    do_sample: doSample,
    return_full_text: false,
  };

  if (options.seed !== undefined && options.seed !== null) {
    genOptions.seed = options.seed;
  }

  const result = await pipe(prompt as any, genOptions) as any;
  return result;
}
