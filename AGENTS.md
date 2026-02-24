# AGENTS.md - Developer Guide for llmwebgpu

## Project Overview

Bun/TypeScript server providing OpenAI-compatible APIs (Chat Completions, Completions, Responses, Embeddings) running local LLMs via WebGPU using Hugging Face transformers.

## Build & Run Commands

```bash
# Install dependencies
bun install

# Run development server (requires --model flag)
bun run src/index.ts --model HuggingFaceTB/SmolLM-135M-Instruct

# TypeScript check
npx tsc --noEmit --skipLibCheck --module ESNext --moduleResolution bundler --target ESNext src/*.ts src/**/*.ts
```

## Testing

No formal tests. To test manually:
```bash
bun run src/index.ts --model HuggingFaceTB/SmolLM-135M-Instruct &
sleep 35

# Test endpoints
curl http://localhost:8080/health
curl -X POST http://localhost:8080/v1/responses -H "Content-Type: application/json" -d '{"model": "default", "input": "Hello"}'
curl -N -X POST http://localhost:8080/v1/responses -H "Content-Type: application/json" -d '{"model": "default", "input": "Hi", "stream": true}'
```

## Code Style

### TypeScript
- `strict: true`, `verbatimModuleSyntax: true`
- Must use `.js` extension in imports

### Imports
```typescript
// Correct
import { handleChatCompletion } from './routes/chat.js';
import { generate } from '../lib/pipeline.js';
import type { ChatCompletionRequest } from './lib/types.js';
```

### Naming
| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `chat-completion.ts` |
| Interfaces | PascalCase | `ChatCompletionRequest` |
| Functions | camelCase | `handleChatCompletion` |
| API Fields | snake_case | `max_tokens` |

### Error Handling
Use custom errors from `src/lib/errors.ts`:
```typescript
import { BadRequestError, ServiceUnavailableError, handleError } from './lib/errors.js';

if (!isModelLoaded()) {
  throw new ServiceUnavailableError('Model not loaded.');
}
if (!input) {
  throw new BadRequestError('input is required');
}
```

### Route Handler Pattern
```typescript
import { generate, isModelLoaded, getModelAlias } from '../lib/pipeline.js';
import { BadRequestError, ServiceUnavailableError } from '../lib/errors.js';
import type { MyRequest, MyResponse } from '../lib/types.js';

let requestId = 0;
function generateId(): string {
  return `prefix-${(++requestId).toString(36)}`;
}

export async function handleMyEndpoint(
  body: MyRequest
): Promise<MyResponse | ((controller: ReadableStreamDefaultController) => void)> {
  if (!isModelLoaded()) {
    throw new ServiceUnavailableError('Model not loaded.');
  }

  const stream = body.stream ?? false;
  const maxTokens = body.max_tokens ?? 256;

  if (!body.input) {
    throw new BadRequestError('input is required');
  }

  const prompt = convertToPrompt(body.input);

  if (stream) {
    return createStreamingResponse(prompt, maxTokens);
  }

  return generateCompletion(prompt, maxTokens);
}

async function generateCompletion(prompt: string, maxTokens: number): Promise<MyResponse> {
  const result = await generate(prompt, { max_new_tokens: maxTokens });
  return { id: generateId(), output: [...], usage: {...} };
}

function createStreamingResponse(prompt: string, maxTokens: number) {
  return async (controller: ReadableStreamDefaultController) => {
    try {
      const result = await generate(prompt, { max_new_tokens: maxTokens });
      // stream chunks
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
      controller.close();
    } catch (error) {
      controller.error(error);
    }
  };
}
```

### Response Format (OpenAI compatible)
```typescript
// Non-streaming
{
  id: 'resp_abc123',
  object: 'response',
  created: 1234567890,
  model: 'smollm-135m-instruct',
  output: [{ type: 'message', id: 'msg_abc123', role: 'assistant', content: [{ type: 'output_text', text: 'Hello' }] }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
}

// Streaming chunk
{ id: 'resp_abc123', object: 'response', output: [{ type: 'message_delta', delta: { content: 'H' }, usage: { output_tokens: 1 } }] }
data: [DONE]
```

### Constants & Null Handling
```typescript
const MAX_TOKENS_DEFAULT = 256;
const value = obj?.property ?? 'default';
```

## Project Structure
```
src/
├── index.ts          # Entry point, loads model
├── server.ts         # HTTP server, routes
├── config.ts         # CLI args
├── routes/           # API handlers
│   ├── chat.ts, completions.ts, responses.ts, embeddings.ts, models.ts
└── lib/
    ├── types.ts      # Interfaces
    ├── errors.ts     # Error classes
    └── pipeline.ts   # Model loading
```

## Adding a New Endpoint
1. Add types to `src/lib/types.ts`
2. Create handler in `src/routes/<name>.ts`
3. Register route in `src/server.ts`
4. Add endpoint info in `src/index.ts`
