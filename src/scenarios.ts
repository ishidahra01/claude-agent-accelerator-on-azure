/**
 * Demo Scenarios for Claude Agent SDK Capabilities
 * Run with: tsx src/scenarios.ts <scenario-number>
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

async function runScenario(scenarioNumber: string) {
  console.log('=================================================');
  console.log('Claude Agent SDK - Capability Demonstration');
  console.log('=================================================\n');

  initializeTracing();
  const foundryConfig = loadFoundryConfig();
  const agent = new MainAgent(foundryConfig);

  let dataFile: string;
  let scenarioName: string;
  let description: string;

  switch (scenarioNumber) {
    case '1':
      scenarioName = 'Standard Analysis';
      description = 'Demonstrates basic sub-agent delegation and structured output';
      dataFile = 'sample-azure-export.json';
      break;
    case '2':
      scenarioName = 'Large Dataset Analysis';
      description = 'Demonstrates automatic compaction and context isolation';
      dataFile = 'large-azure-export.json';
      break;
    case '3':
      scenarioName = 'Deep Research Mode';
      description = 'Demonstrates built-in tools (Read, WebSearch, Bash)';
      dataFile = 'sample-azure-export.json';
      break;
    case '4':
      scenarioName = 'Progressive Knowledge Loading';
      description = 'Demonstrates on-demand skill loading';
      dataFile = 'sample-azure-export.json';
      break;
    default:
      console.error('Invalid scenario number. Use 1, 2, 3, or 4');
      process.exit(1);
  }

  console.log(`Scenario ${scenarioNumber}: ${scenarioName}`);
  console.log(`Description: ${description}`);
  console.log(`Data File: examples/${dataFile}`);
  console.log(`Model: ${foundryConfig.model}\n`);
  console.log('=================================================\n');

  const examplePath = join(__dirname, '../examples', dataFile);
  const exampleData = JSON.parse(readFileSync(examplePath, 'utf-8'));

  const request: AnalysisRequest = {
    resources: exampleData.resources,
    scope: 'all',
    format: 'json',
  };

  const startTime = Date.now();
  const report = await agent.analyzeResources(request);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== ANALYSIS REPORT ===\n');
  console.log(JSON.stringify(report, null, 2));

  console.log('\n=== SUMMARY ===');
  console.log(`Resources Analyzed: ${report.summary.resourcesAnalyzed}`);
  console.log(`Security Findings: ${report.summary.securityFindings}`);
  console.log(`Cost Savings Opportunities: ${report.summary.costSavingsOpportunities}`);
  console.log(`Execution Time: ${duration}s`);

  console.log('\n=================================================');
  console.log(`Scenario ${scenarioNumber} Complete!`);
  console.log('=================================================\n');
}

const scenario = process.argv[2] || '1';
runScenario(scenario).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
