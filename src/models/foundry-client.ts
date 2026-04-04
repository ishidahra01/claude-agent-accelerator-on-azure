/**
 * Foundry Claude API Client
 * Handles authentication and API calls to Microsoft Foundry-hosted Claude models
 */

import Anthropic from '@anthropic-ai/sdk';
import type { FoundryConfig } from '../types/index.js';

export class FoundryClient {
  private client: Anthropic;
  private model: string;

  constructor(config: FoundryConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
  }

  /**
   * Send a message to Claude via Foundry
   */
  async sendMessage(
    messages: Anthropic.MessageParam[],
    systemPrompt?: string,
    maxTokens: number = 4096
  ): Promise<Anthropic.Message> {
    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    return await this.client.messages.create(params);
  }

  /**
   * Stream a message from Claude via Foundry
   */
  async streamMessage(
    messages: Anthropic.MessageParam[],
    systemPrompt?: string,
    maxTokens: number = 4096
  ): Promise<AsyncIterable<Anthropic.MessageStreamEvent>> {
    const params: Anthropic.MessageCreateParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    };

    if (systemPrompt) {
      params.system = systemPrompt;
    }

    return await this.client.messages.stream(params);
  }

  /**
   * Get the configured model name
   */
  getModel(): string {
    return this.model;
  }
}

/**
 * Create Foundry client from environment variables
 */
export function createFoundryClientFromEnv(): FoundryClient {
  const apiKey = process.env.FOUNDRY_API_KEY || process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.FOUNDRY_BASE_URL || 'https://api.anthropic.com';
  const model = process.env.FOUNDRY_MODEL || 'claude-sonnet-4-5';

  if (!apiKey) {
    throw new Error('FOUNDRY_API_KEY or ANTHROPIC_API_KEY environment variable is required');
  }

  return new FoundryClient({ apiKey, baseUrl, model });
}
