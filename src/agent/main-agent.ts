/**
 * Main Azure Resource Analysis Agent
 * Orchestrates analysis using Claude Agent SDK with subagents
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AnalysisRequest, AnalysisReport, AzureResource } from '../types/index.js';
import { FoundryClient } from '../models/foundry-client.js';
import { withTracing, recordEvent, recordAttribute } from '../observability/tracing.js';
import { evaluateAnalysisReport, logEvaluationResults } from '../observability/evaluation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MainAgent {
  private foundryClient: FoundryClient;
  private claudeMd: string;
  private securityAnalyzerMd: string;
  private costOptimizerMd: string;

  constructor(foundryClient: FoundryClient) {
    this.foundryClient = foundryClient;

    // Load agent instructions
    const claudePath = join(__dirname, '../../.claude/CLAUDE.md');
    const securityPath = join(__dirname, '../../.claude/agents/security-analyzer.md');
    const costPath = join(__dirname, '../../.claude/agents/cost-optimizer.md');

    this.claudeMd = readFileSync(claudePath, 'utf-8');
    this.securityAnalyzerMd = readFileSync(securityPath, 'utf-8');
    this.costOptimizerMd = readFileSync(costPath, 'utf-8');
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
      console.log(`Model: ${this.foundryClient.getModel()}\n`);

      const resourcesSummary = this.summarizeResources(request.resources);

      // Perform analysis based on scope
      const securityFindings = (request.scope === 'security' || request.scope === 'all' || !request.scope)
        ? await this.analyzeSecurityWithTracing(resourcesSummary)
        : [];

      const costOptimizations = (request.scope === 'cost' || request.scope === 'all' || !request.scope)
        ? await this.analyzeCostWithTracing(resourcesSummary)
        : [];

      // Create analysis report
      const report: AnalysisReport = {
        summary: {
          resourcesAnalyzed: request.resources.length,
          securityFindings: securityFindings.length,
          costSavingsOpportunities: costOptimizations.length,
          architectureRecommendations: 0,
        },
        security: securityFindings.length > 0 ? securityFindings : undefined,
        cost: costOptimizations.length > 0 ? costOptimizations : undefined,
      };

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
   * Summarize resources for analysis
   */
  private summarizeResources(resources: AzureResource[]): string {
    const summary = resources.map(r => ({
      name: r.name,
      type: r.type,
      location: r.location,
      properties: r.properties,
    }));
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Analyze security with tracing
   */
  private async analyzeSecurityWithTracing(resourcesSummary: string): Promise<any[]> {
    return withTracing('security-analysis', async () => {
      console.log('Running security analysis...');

      const systemPrompt = `${this.claudeMd}\n\n${this.securityAnalyzerMd}`;
      const userMessage = `Analyze these Azure resources for security issues:\n\n${resourcesSummary}\n\nProvide findings in JSON format with the structure: {category, severity, resource, finding, threat, remediation, effort, compliance, priority}`;

      const response = await this.foundryClient.sendMessage(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
        4096
      );

      recordEvent('security-analysis-completed', {
        'response.stopReason': response.stop_reason,
        'response.usage.inputTokens': response.usage.input_tokens,
        'response.usage.outputTokens': response.usage.output_tokens,
      });

      return this.parseJsonResponse(response.content);
    });
  }

  /**
   * Analyze cost with tracing
   */
  private async analyzeCostWithTracing(resourcesSummary: string): Promise<any[]> {
    return withTracing('cost-analysis', async () => {
      console.log('Running cost optimization analysis...');

      const systemPrompt = `${this.claudeMd}\n\n${this.costOptimizerMd}`;
      const userMessage = `Analyze these Azure resources for cost optimization opportunities:\n\n${resourcesSummary}\n\nProvide findings in JSON format with the structure: {category, resource, currentCost, finding, recommendation, savings, savingsPercentage, effort, risk, priority}`;

      const response = await this.foundryClient.sendMessage(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
        4096
      );

      recordEvent('cost-analysis-completed', {
        'response.stopReason': response.stop_reason,
        'response.usage.inputTokens': response.usage.input_tokens,
        'response.usage.outputTokens': response.usage.output_tokens,
      });

      return this.parseJsonResponse(response.content);
    });
  }

  /**
   * Parse JSON from Claude's response
   */
  private parseJsonResponse(content: any[]): any[] {
    try {
      const textContent = content.find(c => c.type === 'text');
      if (!textContent) return [];

      const text = textContent.text;

      // Try to extract JSON array from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // If no array found, try to extract individual JSON objects
      const objectMatches = text.match(/\{[\s\S]*?\}/g);
      if (objectMatches) {
        return objectMatches.map(m => JSON.parse(m));
      }

      return [];
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      return [];
    }
  }
}
