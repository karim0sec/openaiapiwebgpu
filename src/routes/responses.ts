import { generate, isModelLoaded, getModelAlias } from '../lib/pipeline.js';
import { BadRequestError, ServiceUnavailableError } from '../lib/errors.js';
import type { ResponsesRequest, ResponsesResponse, ResponsesChunk, ResponseInputItem } from '../lib/types.js';

let requestId = 0;

function generateId(): string {
  return `resp_${(++requestId).toString(36)}${Date.now().toString(36)}`;
}

export async function handleResponses(
  body: ResponsesRequest
): Promise<ResponsesResponse | ((controller: ReadableStreamDefaultController) => void)> {
  if (!isModelLoaded()) {
    throw new ServiceUnavailableError('Model not loaded. Please wait for the model to load.');
  }

  const model = body.model;
  const input = body.input;
  const stream = body.stream ?? false;
  const maxTokens = body.max_tokens ?? 256;
  const temperature = body.temperature ?? 0.8;
  const topP = body.top_p ?? 0.95;
  const topK = body.top_k ?? 40;
  const minP = body.min_p ?? 0.05;
  const repeatPenalty = body.repeat_penalty ?? 1.1;
  const stop = body.stop ?? [];

  if (!input) {
    throw new BadRequestError('input is required');
  }

  const prompt = convertInputToPrompt(input);

  if (stream) {
    return createStreamingResponse(prompt, model, maxTokens, temperature, topP, topK, minP, repeatPenalty, stop);
  }

  return generateCompletion(prompt, model, maxTokens, temperature, topP, topK, minP, repeatPenalty, stop);
}

function extractTextContent(content: string | ResponseInputItem[]): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((c: any) => c.text || '')
      .join('');
  }
  return '';
}

function convertInputToPrompt(input: ResponseInputItem | ResponseInputItem[]): string {
  let prompt = '';
  
  const items = Array.isArray(input) ? input : [input];
  
  for (const item of items) {
    if (typeof item === 'string') {
      prompt += `User: ${item}\n\n`;
    } else if (item && typeof item === 'object') {
      const anyItem = item as any;
      if (anyItem.type === 'input_text') {
        prompt += `User: ${anyItem.text}\n\n`;
      } else if (anyItem.type === 'message') {
        const role = anyItem.role;
        const content = extractTextContent(anyItem.content);
        
        if (role === 'system' || role === 'developer') {
          prompt += `System: ${content}\n\n`;
        } else if (role === 'user') {
          prompt += `User: ${content}\n\n`;
        } else if (role === 'assistant') {
          prompt += `Assistant: ${content}\n\n`;
        }
      }
    }
  }

  prompt += 'Assistant:';
  
  return prompt;
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
  stop: string[]
): Promise<ResponsesResponse> {
  const result = await generate(prompt, {
    max_new_tokens: maxTokens,
    temperature,
    top_p: topP,
    top_k: topK,
    min_p: minP,
    repetition_penalty: repeatPenalty,
    stop,
  });

  let assistantMessage = '';

  if (Array.isArray(result) && result[0]) {
    const genText = result[0].generated_text;
    if (typeof genText === 'string') {
      assistantMessage = genText;
    } else if (Array.isArray(genText)) {
      assistantMessage = genText.map((t: unknown) => typeof t === 'string' ? t : (t as { content?: string }).content || '').join('');
    }
  }

  if (assistantMessage.startsWith(prompt)) {
    assistantMessage = assistantMessage.slice(prompt.length);
  } else {
    const lastAssistantIndex = assistantMessage.lastIndexOf('Assistant:');
    if (lastAssistantIndex !== -1) {
      assistantMessage = assistantMessage.slice(lastAssistantIndex + 'Assistant:'.length);
    }
  }
  assistantMessage = assistantMessage.trim();

  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(assistantMessage.length / 4);

  return {
    id: generateId(),
    object: 'response',
    created: Math.floor(Date.now() / 1000),
    model: getModelAlias(),
    output: [
      {
        type: 'message',
        id: `msg_${Date.now().toString(36)}`,
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text: assistantMessage,
          },
        ],
      },
    ],
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
  stop: string[]
) {
  return async (controller: ReadableStreamDefaultController) => {
    const id = generateId();
    const created = Math.floor(Date.now() / 1000);
    const messageId = `msg_${Date.now().toString(36)}`;
    let buffer = '';
    let tokensGenerated = 0;
    const maxTokensToGenerate = maxTokens;

    try {
      const { getPipeline } = await import('../lib/pipeline.js');
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
      }) as unknown as { 0?: { generated_text: string | string[] } }[];

      const fullText = Array.isArray(result) 
        ? (result[0]?.generated_text ?? '')
        : (result?.generated_text?.[0]?.generated_text ?? '');

      for (let i = 0; i < fullText.length; i++) {
        const currentText = fullText.slice(0, i + 1);
        const newText = currentText.slice(buffer.length);
        buffer = currentText;
        tokensGenerated++;

        if (newText) {
          const chunkResponse: ResponsesChunk = {
            id,
            object: 'response',
            created,
            model: getModelAlias(),
            output: [
              {
                type: 'message_delta',
                id: messageId,
                delta: {
                  role: 'assistant',
                  content: newText,
                },
                usage: {
                  output_tokens: tokensGenerated,
                },
              },
            ],
          };

          const data = `data: ${JSON.stringify(chunkResponse)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));

          for (const stopSeq of stop) {
            if (newText.includes(stopSeq)) {
              const doneChunk: ResponsesChunk = {
                id,
                object: 'response',
                created,
                model: getModelAlias(),
                output: [
                  {
                    type: 'message_delta',
                    id: messageId,
                    delta: {},
                    usage: {
                      output_tokens: tokensGenerated,
                    },
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

        if (tokensGenerated >= maxTokensToGenerate) {
          const doneChunk: ResponsesChunk = {
            id,
            object: 'response',
            created,
            model: getModelAlias(),
            output: [
              {
                type: 'message_delta',
                id: messageId,
                delta: {},
                usage: {
                  output_tokens: tokensGenerated,
                },
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
