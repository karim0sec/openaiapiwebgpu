import { config } from './config.js';
import { createServer } from './server.js';
import { getPipeline } from './lib/pipeline.js';

async function main() {
  if (!config.model) {
    console.error('Error: --model is required');
    console.log('Usage: bun run src/index.ts --model HuggingFaceTB/SmolLM-135M-Instruct');
    process.exit(1);
  }

  console.log(`Starting WebGPU LLM Server`);
  console.log(`Model: ${config.model}`);
  console.log(`Alias: ${config.modelAlias}`);
  console.log(` dtype: ${config.dtype}`);
  console.log(`Context: ${config.nCtx}`);
  console.log(`Server: http://${config.host}:${config.port}`);
  console.log('');

  console.log('Loading model...');
  try {
    await getPipeline();
    console.log('Model loaded!');
  } catch (error) {
    console.error('Failed to load model:', error);
    process.exit(1);
  }

  const server = await createServer();
  
  console.log(`Server running at http://${server.hostname}:${server.port}`);
  console.log(`API available at http://${server.hostname}:${server.port}/v1`);
  
  if (config.verbose) {
    console.log('\nEndpoints:');
    console.log(`  GET  /health        - Health check`);
    console.log(`  GET  /v1/models     - List models`);
    console.log(`  POST /v1/chat/completions - Chat completion`);
    console.log(`  POST /v1/completions     - Text completion`);
    console.log(`  POST /v1/responses      - Responses API`);
    console.log(`  POST /v1/embeddings     - Text embeddings`);
  }
}

main().catch(console.error);
