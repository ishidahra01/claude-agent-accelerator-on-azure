/**
 * Main Azure Resource Analysis Agent
 * Orchestrates analysis using Claude Agent SDK with subagents
 */

import { query, createSdkMcpServer, type Options } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FoundryConfig } from '../config/foundry.js';
import type { AnalysisRequest, AnalysisReport, AzureResource } from '../types/index.js';
import { azureWafSkills } from '../skills/azure-waf.js';
import { withTracing, recordEvent, recordAttribute } from '../observability/tracing.js';
import { evaluateAnalysisReport, logEvaluationResults } from '../observability/evaluation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main Agent for Azure Resource Analysis
 */
export class MainAgent {
  private model: string;
  private agentOptions: Options;

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
          description: 'Explores and researches Azure resources with isolated context (demonstrates SDK context management)',
          prompt: exploreAgentMd,
        },
        // Security Analyzer Subagent
        'security-analyzer': {
          description: 'Performs deep security analysis of Azure resources',
          prompt: securityAnalyzerMd,
        },
        // Cost Optimizer Subagent
        'cost-optimizer': {
          description: 'Identifies Azure cost optimization opportunities',
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
              fullResponse += chunk.text;
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
   * Summarize resources for analysis
   */
  private summarizeResources(resources: AzureResource[]): string {
    const summary = resources.map(r => ({
      name: r.name,
      type: r.type,
      location: r.location,
      properties: r.properties,
      sku: r.sku,
      tags: r.tags,
    }));
    return JSON.stringify(summary, null, 2);
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
