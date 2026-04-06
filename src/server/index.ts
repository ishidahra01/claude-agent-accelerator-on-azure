/**
 * API Server for Azure Resource Analysis Agent
 * Provides REST and SSE endpoints for chat UI integration
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { MainAgent } from '../agent/main-agent.js';
import { loadFoundryConfig } from '../config/foundry.js';
import { initializeTracing } from '../observability/tracing.js';
import type { AnalysisRequest } from '../types/index.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Enable CORS for frontend access
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
});

// Initialize observability
initializeTracing();

// Load Foundry configuration
const foundryConfig = loadFoundryConfig();
const agent = new MainAgent(foundryConfig);

/**
 * Health check endpoint
 */
fastify.get('/health', async () => {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    model: foundryConfig.model,
    foundryTarget: foundryConfig.displayTarget,
  };
});

/**
 * Get available models
 */
fastify.get('/api/models', async () => {
  return {
    models: [
      {
        id: foundryConfig.model,
        name: 'Claude Sonnet 4.5',
        provider: 'Microsoft Foundry',
      },
    ],
    default: foundryConfig.model,
  };
});

/**
 * Analyze Azure resources (JSON response)
 */
fastify.post<{
  Body: AnalysisRequest;
}>('/api/analyze', async (request, reply) => {
  const { resources, scope = 'all', format = 'json' } = request.body;

  if (!resources || !Array.isArray(resources)) {
    return reply.code(400).send({
      error: 'Invalid request: resources array is required',
    });
  }

  try {
    const report = await agent.analyzeResources({ resources, scope, format });
    return report;
  } catch (error) {
    fastify.log.error({ err: error }, 'Analysis error');
    return reply.code(500).send({
      error: 'Analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Analyze Azure resources with SSE streaming
 * Streams agent events (sub-agents, tools, responses) in real-time
 */
fastify.post<{
  Body: AnalysisRequest;
}>('/api/analyze/stream', async (request, reply) => {
  const { resources, scope = 'all', format = 'json' } = request.body;

  if (!resources || !Array.isArray(resources)) {
    return reply.code(400).send({
      error: 'Invalid request: resources array is required',
    });
  }

  // Set up SSE headers
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  try {
    // Stream analysis with events
    await agent.analyzeResourcesWithStreaming(
      { resources, scope, format },
      (event) => {
        // Send SSE event
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    );

    // Send completion event
    reply.raw.write(`data: ${JSON.stringify({
      type: 'done',
      timestamp: new Date().toISOString(),
    })}\n\n`);
    reply.raw.end();
  } catch (error) {
    fastify.log.error({ err: error }, 'Streaming analysis error');

    // Send error event
    reply.raw.write(`data: ${JSON.stringify({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    })}\n\n`);
    reply.raw.end();
  }
});

/**
 * Start server
 */
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    console.log('=================================================');
    console.log('Azure Resource Analysis Agent - API Server');
    console.log('Powered by Claude Agent SDK + Microsoft Foundry');
    console.log('=================================================');
    console.log(`Server running at: http://${host}:${port}`);
    console.log(`Model: ${foundryConfig.model}`);
    console.log(`Foundry Target: ${foundryConfig.displayTarget}`);
    console.log('=================================================\n');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
