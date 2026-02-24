import { generate, getPipeline, isModelLoaded, getModelAlias } from '../lib/pipeline.js';
import { BadRequestError, ServiceUnavailableError } from '../lib/errors.js';
import type { CompletionRequest, CompletionResponse, CompletionChoice } from '../lib/types.js';

let requestId = 0;

function generateId(): string {
  return `cmpl-${(++requestId).toString(36)}`;
}

export async function handleCompletion(
  body: CompletionRequest
): Promise<CompletionResponse | ((controller: ReadableStreamDefaultController) => void)> {
  if (!isModelLoaded()) {
    throw new ServiceUnavailableError('Model not loaded. Please wait for the model to load.');
  }

  const model = body.model;
  const prompt = body.prompt;
  const stream = body.stream ?? false;
  const maxTokens = body.max_tokens ?? 256;
  const temperature = body.temperature ?? 0.8;
  const topP = body.top_p ?? 0.95;
  const topK = body.top_k ?? 40;
  const minP = body.min_p ?? 0.05;
  const repeatPenalty = body.repeat_penalty ?? 1.1;
  const stop = body.stop ?? [];
  const echo = body.echo ?? false;

  if (!prompt) {
    throw new BadRequestError('prompt is required');
  }

  const promptStr = Array.isArray(prompt) ? prompt.join('') : prompt;

  if (stream) {
    return createStreamingResponse(promptStr, model, maxTokens, temperature, topP, topK, minP, repeatPenalty, stop, echo);
  }

  return generateCompletion(promptStr, model, maxTokens, temperature, topP, topK, minP, repeatPenalty, stop, echo);
}

async function generateCompletion(
  prompt: string,
  model: string,
  maxTokens: number,
  temperature: number,
  topP: number,
  topK: number,
  minP: number,
  repeatPenalty: number,
  stop: string[],
  echo: boolean
): Promise<CompletionResponse> {
  const result = await generate(prompt, {
    max_new_tokens: maxTokens,
    temperature,
    top_p: topP,
    top_k: topK,
    min_p: minP,
    repetition_penalty: repeatPenalty,
    stop,
  });

  let generatedText = '';

  if (Array.isArray(result) && result[0]) {
    const genText = result[0].generated_text;
    if (typeof genText === 'string') {
      generatedText = genText;
    } else if (Array.isArray(genText)) {
      generatedText = genText.map((t: any) => typeof t === 'string' ? t : t.content || '').join('');
    }
  }

  const fullText = echo ? prompt + generatedText : generatedText;

  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(generatedText.length / 4);

  const choice: CompletionChoice = {
    text: fullText,
    index: 0,
    logprobs: null,
    finish_reason: 'stop',
  };

  return {
    id: generateId(),
    object: 'text_completion',
    created: Math.floor(Date.now() / 1000),
    model: getModelAlias(),
    choices: [choice],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

function createStreamingResponse(
  prompt: string,
  model: string,
  maxTokens: number,
  temperature: number,
  topP: number,
  topK: number,
  minP: number,
  repeatPenalty: number,
  stop: string[],
  echo: boolean
) {
  return async (controller: ReadableStreamDefaultController) => {
    const id = generateId();
    const created = Math.floor(Date.now() / 1000);
    let buffer = '';
    let promptSent = false;

    try {
      const pipe = await getPipeline();
      
      const result = await pipe(prompt, {
        max_new_tokens: maxTokens,
        temperature,
        top_p: topP,
        top_k: topK,
        min_p: minP,
        repetition_penalty: repeatPenalty,
        do_sample: temperature > 0,
        return_full_text: false,
      }) as any;

      const fullText = Array.isArray(result) 
        ? result[0]?.generated_text 
        : result?.generated_text?.[0]?.generated_text ?? '';

      const textToStream = echo ? prompt + fullText : fullText;

      for (let i = 0; i < textToStream.length; i++) {
        const currentText = textToStream.slice(0, i + 1);
        const newText = currentText.slice(buffer.length);
        buffer = currentText;

        if (!promptSent && echo) {
          const promptEndIndex = prompt.length;
          if (i >= promptEndIndex) {
            promptSent = true;
          }
          continue;
        }

        if (newText) {
          const chunkResponse = {
            id,
            object: 'text_completion',
            created,
            model: getModelAlias(),
            choices: [
              {
                text: newText,
                index: 0,
                logprobs: null,
                finish_reason: null,
              },
            ],
          };

          const data = `data: ${JSON.stringify(chunkResponse)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));

          for (const stopSeq of stop) {
            if (newText.includes(stopSeq)) {
              const doneChunk = {
                id,
                object: 'text_completion',
                created,
                model: getModelAlias(),
                choices: [
                  {
                    text: '',
                    index: 0,
                    logprobs: null,
                    finish_reason: 'stop',
                  },
                ],
              };
              const doneData = `data: ${JSON.stringify(doneChunk)}\n\n`;
              controller.enqueue(new TextEncoder().encode(doneData));
              controller.close();
              return;
            }
          }
        }

        if (i >= maxTokens - 1) {
          const doneChunk = {
            id,
            object: 'text_completion',
            created,
            model: getModelAlias(),
            choices: [
              {
                text: '',
                index: 0,
                logprobs: null,
                finish_reason: 'length',
              },
            ],
          };
          const doneData = `data: ${JSON.stringify(doneChunk)}\n\n`;
          controller.enqueue(new TextEncoder().encode(doneData));
          break;
        }
      }

      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    } catch (error) {
      controller.error(error);
    }
  };
}
