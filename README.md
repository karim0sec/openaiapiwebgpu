# llmwebgpu

OpenAI-compatible LLM server running locally via WebGPU using Hugging Face transformers.

## Features

- **OpenAI-compatible APIs**: Works with OpenAI client libraries and agents
- **Local execution**: Runs models locally using WebGPU (no API keys, no cloud)
- **Multiple endpoints**:
  - `/v1/chat/completions` - Chat completion
  - `/v1/completions` - Text completion
  - `/v1/responses` - Responses API
  - `/v1/embeddings` - Text embeddings
  - `/v1/models` - List available models

## Requirements

- [Bun](https://bun.sh) runtime
- WebGPU-capable device (GPU with WebGPU support)

## Quick Start

```bash
# Install dependencies
bun install

# Start server with a model
bun run src/index.ts --model HuggingFaceTB/SmolLM-135M-Instruct
```

## Usage

### Running the Server

```bash
bun run src/index.ts --model <model_id>
```

Options:
| Flag | Description | Default |
|------|-------------|---------|
| `--model` | HuggingFace model ID | (required) |
| `--model_alias` | Custom model name | auto-derived |
| `--dtype` | Data type (q4, fp16, etc.) | q4 |
| `--n_ctx` | Context size | 2048 |
| `--host` | Server host | localhost |
| `--port` | Server port | 8080 |
| `--api_key` | API key for auth | none |

### Example Requests

```bash
# Health check
curl http://localhost:8080/health

# Chat completion
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "smollm-135m-instruct",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Responses API
curl -X POST http://localhost:8080/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "smollm-135m-instruct",
    "input": "Hello"
  }'

# Streaming
curl -N -X POST http://localhost:8080/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "smollm-135m-instruct",
    "input": "Hello",
    "stream": true
  }'
```

### Using with OpenAI Python Library

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8080/v1",
    api_key="dummy"  # not required if no --api_key set
)

response = client.chat.completions.create(
    model="smollm-135m-instruct",
    messages=[{"role": "user", "content": "Hello"}]
)

print(response.choices[0].message.content)
```

### Using with OpenAI JavaScript Library

```javascript
import { OpenAI } from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'dummy'
});

const response = await client.responses.create({
  model: 'smollm-135m-instruct',
  input: 'Hello'
});

console.log(response.output[0].content[0].text);
```

## Models

Any text-generation model from Hugging Face should work. Recommended small models:

- `HuggingFaceTB/SmolLM-135M-Instruct` (135M params)
- `HuggingFaceTB/SmolLM-360M-Instruct` (360M params)
- `TinyLlama/TinyLlama-1.1B-Chat-v1.0` (1.1B params)
- `Qwen/Qwen2.5-0.5B-Instruct` (0.5B params)

## Architecture

```
src/
├── index.ts          # Entry point, model loading
├── server.ts         # HTTP server, routing
├── config.ts         # CLI configuration
├── routes/           # API handlers
│   ├── chat.ts       # /v1/chat/completions
│   ├── completions.ts # /v1/completions
│   ├── responses.ts  # /v1/responses
│   ├── embeddings.ts # /v1/embeddings
│   └── models.ts     # /v1/models
└── lib/
    ├── types.ts      # TypeScript types
    ├── errors.ts     # Error classes
    └── pipeline.ts   # Model pipeline
```

## License

MIT
