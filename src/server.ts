import { handleModels } from './routes/models.js';
import { handleChatCompletion } from './routes/chat.js';
import { handleCompletion } from './routes/completions.js';
import { handleResponses } from './routes/responses.js';
import { handleEmbeddings } from './routes/embeddings.js';
import { handleError, ApiError, UnauthorizedError } from './lib/errors.js';
import { isModelLoaded, getModelAlias } from './lib/pipeline.js';
import { config } from './config.js';
import type { ChatCompletionRequest, CompletionRequest, EmbeddingRequest, ResponsesRequest } from './lib/types.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function getAuthToken(): string | undefined {
  return process.env.API_KEY || config.apiKey;
}

function checkAuth(headers: Headers): boolean {
  const authToken = getAuthToken();
  if (!authToken) {
    return true;
  }

  const authHeader = headers.get('Authorization');
  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace('Bearer ', '');
  return token === authToken;
}

export async function createServer() {
  const server = Bun.serve({
    port: config.port,
    hostname: config.host,

    async fetch(req) {
      const url = new URL(req.url);
      const path = config.rootPath 
        ? url.pathname.replace(config.rootPath, '') 
        : url.pathname;
      const method = req.method;

      if (method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      if (!checkAuth(req.headers)) {
        return new Response(JSON.stringify({
          error: {
            message: 'Invalid API key',
            type: 'invalid_request_error',
            code: 'invalid_api_key',
          },
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      try {
        if (path === '/health') {
          return new Response(JSON.stringify({
            status: 'ok',
            model_loaded: isModelLoaded(),
            model: getModelAlias(),
          }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (path === '/v1/models' && method === 'GET') {
          const models = handleModels();
          return new Response(JSON.stringify(models), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (path === '/v1/chat/completions' && method === 'POST') {
          const body = await req.json() as ChatCompletionRequest;
          const result = await handleChatCompletion(body);
          
          if (!body.stream) {
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const streamFn = result as (controller: ReadableStreamDefaultController) => void;
          
          const stream = new ReadableStream({
            start(controller) {
              streamFn(controller);
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              ...corsHeaders,
            },
          });
        }

        if (path === '/v1/completions' && method === 'POST') {
          const body = await req.json() as CompletionRequest;
          const result = await handleCompletion(body);
          
          if (!body.stream) {
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const streamFn = result as (controller: ReadableStreamDefaultController) => void;
          
          const stream = new ReadableStream({
            start(controller) {
              streamFn(controller);
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              ...corsHeaders,
            },
          });
        }

        if (path === '/v1/embeddings' && method === 'POST') {
          const body = await req.json() as EmbeddingRequest;
          const result = await handleEmbeddings(body);
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (path === '/v1/responses' && method === 'POST') {
          const body = await req.json() as ResponsesRequest;
          const result = await handleResponses(body);
          
          if (!body.stream) {
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
          }

          const streamFn = result as (controller: ReadableStreamDefaultController) => void;
          
          const stream = new ReadableStream({
            start(controller) {
              streamFn(controller);
            },
          });

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              ...corsHeaders,
            },
          });
        }

        return new Response(JSON.stringify({
          error: {
            message: `Not found: ${path}`,
            type: 'invalid_request_error',
          },
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

      } catch (error) {
        const apiError = handleError(error);
        return new Response(JSON.stringify(apiError.toJSON()), {
          status: apiError.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    },
  });

  return server;
}
