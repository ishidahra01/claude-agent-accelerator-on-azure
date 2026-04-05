/**
 * Azure Resource Analysis Agent - Main Entry Point
 * Demonstrates Claude Agent SDK with Microsoft Foundry integration
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MainAgent } from './agent/main-agent.js';
import { loadFoundryConfig } from './config/foundry.js';
import { initializeTracing } from './observability/tracing.js';
import type { AnalysisRequest } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('=================================================');
  console.log('Azure Resource Analysis Agent');
  console.log('Powered by Claude Agent SDK + Microsoft Foundry');
  console.log('=================================================\n');

  // Initialize observability
  initializeTracing();

  const foundryConfig = loadFoundryConfig();

  console.log(`Model: ${foundryConfig.model}`);
  console.log(`Foundry Target: ${foundryConfig.displayTarget}`);
  console.log(`Auth Method: ${foundryConfig.authMethod}\n`);

  // Create main agent with Claude Agent SDK
  const agent = new MainAgent(foundryConfig);

  // Load sample Azure resource export
  const examplePath = join(__dirname, '../examples/sample-azure-export.json');
  const exampleData = JSON.parse(readFileSync(examplePath, 'utf-8'));

  // Create analysis request
  const request: AnalysisRequest = {
    resources: exampleData.resources,
    scope: 'all',
    format: 'json',
  };

  // Run analysis with Claude Agent SDK
  const report = await agent.analyzeResources(request);

  // Display results
  console.log('\n=== ANALYSIS REPORT ===\n');
  console.log(JSON.stringify(report, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(`Resources Analyzed: ${report.summary.resourcesAnalyzed}`);
  console.log(`Security Findings: ${report.summary.securityFindings}`);
  console.log(`Cost Savings Opportunities: ${report.summary.costSavingsOpportunities}`);

  if (report.security && report.security.length > 0) {
    console.log('\n=== TOP SECURITY ISSUES ===');
    report.security
      .slice(0, 3)
      .forEach((finding, i) => {
        console.log(`\n${i + 1}. [${finding.severity}] ${finding.finding}`);
        console.log(`   Resource: ${finding.resource}`);
        console.log(`   Remediation: ${finding.remediation.substring(0, 100)}...`);
      });
  }

  if (report.cost && report.cost.length > 0) {
    console.log('\n=== TOP COST SAVINGS OPPORTUNITIES ===');
    report.cost
      .slice(0, 3)
      .forEach((opt, i) => {
        console.log(`\n${i + 1}. ${opt.recommendation}`);
        console.log(`   Resource: ${opt.resource}`);
        console.log(`   Savings: ${opt.savings} (${opt.savingsPercentage})`);
      });
  }

  console.log('\n=================================================');
  console.log('Analysis Complete!');
  console.log('=================================================\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
