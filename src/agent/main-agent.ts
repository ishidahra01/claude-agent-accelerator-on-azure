/**
 * Main Azure Resource Analysis Agent
 * Orchestrates analysis using Claude Agent SDK with subagents
 */

import { query, createSdkMcpServer, type Options } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FoundryConfig } from '../config/foundry.js';
import type { AnalysisRequest, AnalysisReport, AzureResource, StreamEvent } from '../types/index.js';
import { azureWafSkills } from '../skills/azure-waf.js';
import { withTracing, recordEvent, recordAttribute } from '../observability/tracing.js';
import { evaluateAnalysisReport, logEvaluationResults } from '../observability/evaluation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAX_OBJECT_KEYS = 20;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_CHARS = 400;
const MAX_EVENT_TEXT_CHARS = 8000;
const MAX_RESPONSE_BUFFER_CHARS = 262144;

function truncateText(text: string, maxChars = MAX_STRING_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}... [truncated]`;
}

function appendWithLimit(current: string, addition: string, maxChars = MAX_RESPONSE_BUFFER_CHARS): string {
  if (current.length + addition.length <= maxChars) {
    return current + addition;
  }

  return (current + addition).slice(-maxChars);
}

/**
 * Main Agent for Azure Resource Analysis
 */
export class MainAgent {
  private model: string;
  private agentOptions: Options;

  private readonly agentCatalog = [
    {
      name: 'explore-agent',
      description: 'Explores and researches Azure resources with isolated context (demonstrates SDK context management)',
    },
    {
      name: 'security-analyzer',
      description: 'Performs deep security analysis of Azure resources',
    },
    {
      name: 'cost-optimizer',
      description: 'Identifies Azure cost optimization opportunities',
    },
  ] as const;

  private readonly mcpServerCatalog = ['azure-waf', 'ms-learn-docs'] as const;

  constructor(foundryConfig: FoundryConfig) {
    this.model = foundryConfig.model;

    // Load agent instructions
    const claudePath = join(__dirname, '../../.claude/CLAUDE.md');
    const explorePath = join(__dirname, '../../.claude/agents/explore-agent.md');
    const securityPath = join(__dirname, '../../.claude/agents/security-analyzer.md');
    const costPath = join(__dirname, '../../.claude/agents/cost-optimizer.md');

    const claudeMd = readFileSync(claudePath, 'utf-8');
    const exploreAgentMd = readFileSync(explorePath, 'utf-8');
    const securityAnalyzerMd = readFileSync(securityPath, 'utf-8');
    const costOptimizerMd = readFileSync(costPath, 'utf-8');

    // Register Azure WAF skills as an in-process MCP server
    const wafSkillServer = createSdkMcpServer({
      name: 'azure-waf',
      tools: azureWafSkills,
    });

    // Configure agent with subagents and skills
    this.agentOptions = {
      model: this.model,
      systemPrompt: claudeMd,
      mcpServers: {
        'azure-waf': wafSkillServer,
        // MS Learn Doc MCP server for latest Azure documentation
        'ms-learn-docs': {
          command: 'npx',
          args: ['-y', '@microsoft/mcp-server-docs'],
        },
      },
      env: foundryConfig.env,
      agents: {
        // Explore Agent (demonstrates context isolation)
        'explore-agent': {
          description: this.agentCatalog[0].description,
          prompt: exploreAgentMd,
        },
        // Security Analyzer Subagent
        'security-analyzer': {
          description: this.agentCatalog[1].description,
          prompt: securityAnalyzerMd,
        },
        // Cost Optimizer Subagent
        'cost-optimizer': {
          description: this.agentCatalog[2].description,
          prompt: costOptimizerMd,
        },
      },
    };
  }

  /**
   * Analyze Azure resources
   */
  async analyzeResources(request: AnalysisRequest): Promise<AnalysisReport> {
    return withTracing('analyze-resources', async () => {
      recordAttribute('resources.count', request.resources.length);
      recordAttribute('analysis.scope', request.scope || 'all');

      console.log(`\nAnalyzing ${request.resources.length} Azure resources...`);
      console.log(`Scope: ${request.scope || 'all'}`);
      console.log(`Model: ${this.model}\n`);

      const resourcesSummary = this.summarizeResources(request.resources);

      // Build analysis prompt based on scope
      let analysisPrompt = `You are analyzing Azure infrastructure resources using Claude Agent SDK capabilities.\n\n`;
      analysisPrompt += `IMPORTANT: First, delegate to 'explore-agent' subagent to:\n`;
      analysisPrompt += `1. Read and parse the resource configurations\n`;
      analysisPrompt += `2. Search for latest Azure best practices (use WebSearch)\n`;
      analysisPrompt += `3. Return a concise exploration summary\n\n`;
      analysisPrompt += `This demonstrates SDK's context isolation - the explore agent processes large data without polluting your context.\n\n`;
      analysisPrompt += `Resources to analyze:\n${resourcesSummary}\n\n`;

      if (request.scope === 'security' || !request.scope || request.scope === 'all') {
        analysisPrompt += `Delegate security analysis to the 'security-analyzer' subagent. `;
      }

      if (request.scope === 'cost' || !request.scope || request.scope === 'all') {
        analysisPrompt += `Delegate cost optimization analysis to the 'cost-optimizer' subagent. `;
      }

      analysisPrompt += `\n\nProvide a comprehensive JSON report with the following structure:\n`;
      analysisPrompt += `{\n`;
      analysisPrompt += `  "summary": { "resourcesAnalyzed": number, "securityFindings": number, "costSavingsOpportunities": number },\n`;
      analysisPrompt += `  "security": [{ "severity": "Critical|High|Medium|Low", "resource": "...", "finding": "...", "remediation": "..." }],\n`;
      analysisPrompt += `  "cost": [{ "resource": "...", "currentCost": "...", "recommendation": "...", "savings": "...", "savingsPercentage": "..." }]\n`;
      analysisPrompt += `}\n`;

      // Run agent with Claude Agent SDK
      const result = await this.runAgent(analysisPrompt);

      // Parse the analysis report
      const report = this.parseAnalysisReport(result, request.resources.length);

      // Evaluate report if enabled
      if (process.env.ENABLE_EVALUATION === 'true') {
        console.log('\nEvaluating analysis report...');
        const evaluation = await evaluateAnalysisReport(report, request.resources);
        logEvaluationResults(evaluation);
        recordEvent('evaluation-completed', {
          score: evaluation.overallScore,
          passed: evaluation.passed,
        });
      }

      return report;
    });
  }

  /**
   * Analyze Azure resources with streaming events
   * Emits events for sub-agents, tools, and responses
   */
  async analyzeResourcesWithStreaming(
    request: AnalysisRequest,
    onEvent: (event: StreamEvent) => void
  ): Promise<AnalysisReport> {
    return withTracing('analyze-resources-streaming', async () => {
      const requestId = randomUUID();

      recordAttribute('resources.count', request.resources.length);
      recordAttribute('analysis.scope', request.scope || 'all');

      onEvent({
        type: 'run_started',
        requestId,
        resourceCount: request.resources.length,
        scope: request.scope || 'all',
        model: this.model,
        tracing: {
          enabled: process.env.ENABLE_TRACING === 'true',
          configured: Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING),
        },
        agents: [...this.agentCatalog],
        mcpServers: [...this.mcpServerCatalog],
        timestamp: new Date().toISOString(),
      });

      // Send start event
      onEvent({
        type: 'status',
        message: `Analyzing ${request.resources.length} Azure resources...`,
        timestamp: new Date().toISOString(),
      });

      const resourcesSummary = this.summarizeResources(request.resources);

      // Build analysis prompt
      let analysisPrompt = `You are analyzing Azure infrastructure resources using Claude Agent SDK capabilities.\n\n`;
      analysisPrompt += `IMPORTANT: First, delegate to 'explore-agent' subagent to:\n`;
      analysisPrompt += `1. Read and parse the resource configurations\n`;
      analysisPrompt += `2. Search for latest Azure best practices (use WebSearch)\n`;
      analysisPrompt += `3. Return a concise exploration summary\n\n`;
      analysisPrompt += `This demonstrates SDK's context isolation - the explore agent processes large data without polluting your context.\n\n`;
      analysisPrompt += `Resources to analyze:\n${resourcesSummary}\n\n`;

      if (request.scope === 'security' || !request.scope || request.scope === 'all') {
        analysisPrompt += `Delegate security analysis to the 'security-analyzer' subagent. `;
      }

      if (request.scope === 'cost' || !request.scope || request.scope === 'all') {
        analysisPrompt += `Delegate cost optimization analysis to the 'cost-optimizer' subagent. `;
      }

      analysisPrompt += `\n\nProvide a comprehensive JSON report with the following structure:\n`;
      analysisPrompt += `{\n`;
      analysisPrompt += `  "summary": { "resourcesAnalyzed": number, "securityFindings": number, "costSavingsOpportunities": number },\n`;
      analysisPrompt += `  "security": [{ "severity": "Critical|High|Medium|Low", "resource": "...", "finding": "...", "remediation": "..." }],\n`;
      analysisPrompt += `  "cost": [{ "resource": "...", "currentCost": "...", "recommendation": "...", "savings": "...", "savingsPercentage": "..." }]\n`;
      analysisPrompt += `}\n`;

      // Run agent with streaming
      const result = await this.runAgentWithStreaming(analysisPrompt, onEvent);

      // Parse the analysis report
      const report = this.parseAnalysisReport(result, request.resources.length);

      // Send completion event
      onEvent({
        type: 'report',
        report,
        timestamp: new Date().toISOString(),
      });

      return report;
    });
  }

  /**
   * Run agent using Claude Agent SDK query() API
   */
  private async runAgent(prompt: string): Promise<string> {
    let fullResponse = '';

    console.log('\n=== Starting Agent Execution ===\n');

    try {
      const iterator = query({
        prompt,
        options: this.agentOptions,
      });

      for await (const msg of iterator) {
        if (msg.type === 'assistant') {
          for (const chunk of msg.message.content) {
            if (chunk.type === 'text') {
              fullResponse = appendWithLimit(fullResponse, chunk.text);
              // Log streaming output for visibility
              process.stdout.write('.');
            }
            // Handle tool use
            if (chunk.type === 'tool_use') {
              console.log(`\n[Tool Used: ${chunk.name}]`);
            }
          }

          // Log token usage
          if (msg.message.usage) {
            recordEvent('agent-response', {
              'usage.inputTokens': msg.message.usage.input_tokens,
              'usage.outputTokens': msg.message.usage.output_tokens,
            });
          }
        }
      }

      console.log('\n\n=== Agent Execution Complete ===\n');

    } catch (error) {
      console.error('Agent execution error:', error);
      throw error;
    }

    return fullResponse;
  }

  /**
   * Run agent with streaming events
   */
  private async runAgentWithStreaming(
    prompt: string,
    onEvent: (event: StreamEvent) => void
  ): Promise<string> {
    let fullResponse = '';
    const assistantTextLengths = new Map<string, number>();
    const toolCalls = new Map<string, { toolName: string; parentToolUseId: string | null }>();

    try {
      const iterator = query({
        prompt,
        options: this.agentOptions,
      });

      for await (const msg of iterator) {
        if (msg.type === 'system') {
          if (msg.subtype === 'init') {
            onEvent({
              type: 'runtime_context',
              cwd: msg.cwd,
              tools: msg.tools,
              mcpServers: msg.mcp_servers,
              agents: msg.agents || [],
              skills: msg.skills,
              model: msg.model,
              permissionMode: msg.permissionMode,
              apiKeySource: msg.apiKeySource,
              timestamp: new Date().toISOString(),
            });
          }

          if (msg.subtype === 'status' && msg.status) {
            onEvent({
              type: 'status',
              message: `Runtime status: ${msg.status}`,
              timestamp: new Date().toISOString(),
            });
          }

          if (msg.subtype === 'task_started') {
            onEvent({
              type: 'task_started',
              taskId: msg.task_id,
              description: msg.description,
              taskType: msg.task_type,
              workflowName: msg.workflow_name,
              prompt: msg.prompt ? truncateText(msg.prompt, MAX_EVENT_TEXT_CHARS) : undefined,
              toolUseId: msg.tool_use_id,
              timestamp: new Date().toISOString(),
            });
          }

          if (msg.subtype === 'task_progress') {
            onEvent({
              type: 'task_progress',
              taskId: msg.task_id,
              description: msg.description,
              lastToolName: msg.last_tool_name,
              summary: msg.summary,
              usage: {
                totalTokens: msg.usage.total_tokens,
                toolUses: msg.usage.tool_uses,
                durationMs: msg.usage.duration_ms,
              },
              toolUseId: msg.tool_use_id,
              timestamp: new Date().toISOString(),
            });
          }

          if (msg.subtype === 'task_notification') {
            onEvent({
              type: 'task_completed',
              taskId: msg.task_id,
              status: msg.status,
              summary: msg.summary,
              outputFile: msg.output_file,
              usage: msg.usage
                ? {
                    totalTokens: msg.usage.total_tokens,
                    toolUses: msg.usage.tool_uses,
                    durationMs: msg.usage.duration_ms,
                  }
                : undefined,
              toolUseId: msg.tool_use_id,
              timestamp: new Date().toISOString(),
            });
          }
        }

        if (msg.type === 'tool_progress') {
          const trackedTool = toolCalls.get(msg.tool_use_id);
          onEvent({
            type: 'tool_progress',
            toolUseId: msg.tool_use_id,
            toolName: msg.tool_name,
            elapsedTimeSeconds: msg.elapsed_time_seconds,
            parentToolUseId: trackedTool?.parentToolUseId ?? msg.parent_tool_use_id,
            taskId: msg.task_id,
            timestamp: new Date().toISOString(),
          });
        }

        if (msg.type === 'tool_use_summary') {
          onEvent({
            type: 'tool_summary',
            summary: msg.summary,
            precedingToolUseIds: msg.preceding_tool_use_ids,
            timestamp: new Date().toISOString(),
          });
        }

        if (msg.type === 'user' && msg.parent_tool_use_id && typeof msg.tool_use_result !== 'undefined') {
          const trackedTool = toolCalls.get(msg.parent_tool_use_id);
          onEvent({
            type: 'tool_end',
            toolUseId: msg.parent_tool_use_id,
            toolName: trackedTool?.toolName || 'tool',
            toolOutput: this.stringifyPreview(msg.tool_use_result),
            isError: this.isToolErrorResult(msg.tool_use_result),
            parentToolUseId: trackedTool?.parentToolUseId ?? null,
            timestamp: new Date().toISOString(),
          });
        }

        // Handle assistant messages
        if (msg.type === 'assistant') {
          const textContent = msg.message.content
            .filter((chunk) => chunk.type === 'text')
            .map((chunk) => chunk.text)
            .join('');

          const seenLength = assistantTextLengths.get(msg.uuid) || 0;
          const nextLength = textContent.length;

          if (nextLength > seenLength) {
            const delta = textContent.slice(seenLength);
            fullResponse = appendWithLimit(fullResponse, delta);
            onEvent({
              type: 'text',
              text: delta,
              timestamp: new Date().toISOString(),
            });
            assistantTextLengths.set(msg.uuid, nextLength);
          }

          for (const chunk of msg.message.content) {
            // Handle tool use
            if (chunk.type === 'tool_use' || chunk.type === 'server_tool_use' || chunk.type === 'mcp_tool_use') {
              if (toolCalls.has(chunk.id)) {
                continue;
              }

              toolCalls.set(chunk.id, {
                toolName: chunk.name,
                parentToolUseId: msg.parent_tool_use_id,
              });

              onEvent({
                type: 'tool_start',
                toolUseId: chunk.id,
                toolName: chunk.name,
                toolInput: this.stringifyPreview(chunk.input),
                parentToolUseId: msg.parent_tool_use_id,
                timestamp: new Date().toISOString(),
              });
            }
          }

          // Log token usage
          if (msg.message.usage) {
            onEvent({
              type: 'usage',
              usage: {
                inputTokens: msg.message.usage.input_tokens,
                outputTokens: msg.message.usage.output_tokens,
                cacheCreationInputTokens: msg.message.usage.cache_creation_input_tokens ?? undefined,
                cacheReadInputTokens: msg.message.usage.cache_read_input_tokens ?? undefined,
              },
              timestamp: new Date().toISOString(),
            });

            recordEvent('agent-response', {
              'usage.inputTokens': msg.message.usage.input_tokens,
              'usage.outputTokens': msg.message.usage.output_tokens,
            });
          }
        }

        if (msg.type === 'result') {
          onEvent({
            type: 'usage',
            usage: {
              inputTokens: msg.usage.input_tokens,
              outputTokens: msg.usage.output_tokens,
              cacheCreationInputTokens: msg.usage.cache_creation_input_tokens,
              cacheReadInputTokens: msg.usage.cache_read_input_tokens,
              totalCostUsd: msg.total_cost_usd,
              durationMs: msg.duration_ms,
              numTurns: msg.num_turns,
            },
            timestamp: new Date().toISOString(),
          });

          if (msg.subtype !== 'success' && msg.errors.length > 0) {
            onEvent({
              type: 'error',
              error: msg.errors.join('\n'),
              timestamp: new Date().toISOString(),
            });
          }

          onEvent({
            type: 'status',
            message: `Execution finished in ${(msg.duration_ms / 1000).toFixed(1)}s across ${msg.num_turns} turn(s).`,
            timestamp: new Date().toISOString(),
          });
        }
      }

    } catch (error) {
      onEvent({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }

    return fullResponse;
  }

  private isToolErrorResult(toolUseResult: unknown): boolean {
    if (!toolUseResult || typeof toolUseResult !== 'object') {
      return false;
    }

    if ('is_error' in toolUseResult && typeof toolUseResult.is_error === 'boolean') {
      return toolUseResult.is_error;
    }

    if ('isError' in toolUseResult && typeof toolUseResult.isError === 'boolean') {
      return toolUseResult.isError;
    }

    return false;
  }

  /**
   * Summarize resources for analysis
   */
  private summarizeResources(resources: AzureResource[]): string {
    const summary = resources.map(r => ({
      name: r.name,
      type: r.type,
      location: r.location,
      properties: this.summarizeValue(r.properties),
      sku: this.summarizeValue(r.sku),
      tags: this.summarizeValue(r.tags),
    }));
    return JSON.stringify(summary, null, 2);
  }

  private summarizeValue(value: unknown, depth = 0): unknown {
    if (value === null || typeof value === 'undefined') {
      return value;
    }

    if (typeof value === 'string') {
      return truncateText(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (depth >= 3) {
      if (Array.isArray(value)) {
        return `[Array(${value.length})]`;
      }

      return '[Object]';
    }

    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => this.summarizeValue(item, depth + 1));

      if (value.length > MAX_ARRAY_ITEMS) {
        items.push(`[+${value.length - MAX_ARRAY_ITEMS} more items]`);
      }

      return items;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value);
      const summarized = Object.fromEntries(
        entries
          .slice(0, MAX_OBJECT_KEYS)
          .map(([key, nestedValue]) => [key, this.summarizeValue(nestedValue, depth + 1)])
      );

      if (entries.length > MAX_OBJECT_KEYS) {
        return {
          ...summarized,
          __truncatedKeys: entries.length - MAX_OBJECT_KEYS,
        };
      }

      return summarized;
    }

    return String(value);
  }

  private stringifyPreview(value: unknown): string {
    if (typeof value === 'string') {
      return truncateText(value, MAX_EVENT_TEXT_CHARS);
    }

    try {
      return truncateText(JSON.stringify(this.summarizeValue(value), null, 2), MAX_EVENT_TEXT_CHARS);
    } catch {
      return truncateText(String(value), MAX_EVENT_TEXT_CHARS);
    }
  }

  /**
   * Parse analysis report from agent response
   */
  private parseAnalysisReport(response: string, resourceCount: number): AnalysisReport {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*"summary"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      // Fallback: try to find individual arrays
      const securityMatch = response.match(/"security":\s*\[([\s\S]*?)\]/);
      const costMatch = response.match(/"cost":\s*\[([\s\S]*?)\]/);

      const report: AnalysisReport = {
        summary: {
          resourcesAnalyzed: resourceCount,
          securityFindings: 0,
          costSavingsOpportunities: 0,
          architectureRecommendations: 0,
        },
      };

      if (securityMatch) {
        try {
          const security = JSON.parse(`[${securityMatch[1]}]`);
          report.security = security;
          report.summary.securityFindings = security.length;
        } catch (e) {
          console.warn('Failed to parse security findings');
        }
      }

      if (costMatch) {
        try {
          const cost = JSON.parse(`[${costMatch[1]}]`);
          report.cost = cost;
          report.summary.costSavingsOpportunities = cost.length;
        } catch (e) {
          console.warn('Failed to parse cost findings');
        }
      }

      return report;
    } catch (error) {
      console.error('Failed to parse analysis report:', error);

      // Return empty report as fallback
      return {
        summary: {
          resourcesAnalyzed: resourceCount,
          securityFindings: 0,
          costSavingsOpportunities: 0,
          architectureRecommendations: 0,
        },
      };
    }
  }
}
