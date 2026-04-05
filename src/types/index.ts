/**
 * Type definitions for Azure Resource Analysis Agent
 */

export interface FoundryConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AgentConfig {
  maxIterations: number;
  enableSubagents: boolean;
  enableTracing: boolean;
  enableEvaluation: boolean;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  properties: Record<string, any>;
  sku?: Record<string, any>;
  tags?: Record<string, string>;
}

export interface AnalysisRequest {
  resources: AzureResource[];
  scope?: 'security' | 'cost' | 'architecture' | 'all';
  format?: 'json' | 'markdown';
}

export interface SecurityFinding {
  category: 'Network Security' | 'IAM' | 'Data Protection' | 'Secrets' | 'Monitoring';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  resource: string;
  finding: string;
  threat: string;
  remediation: string;
  effort: 'Low' | 'Medium' | 'High';
  compliance: string[];
  priority: number;
}

export interface CostOptimization {
  category: 'Rightsizing' | 'Commitment' | 'Waste' | 'Scheduling' | 'Pricing';
  resource: string;
  currentCost: string;
  finding: string;
  recommendation: string;
  savings: string;
  savingsPercentage: string;
  effort: 'Low' | 'Medium' | 'High';
  risk: 'Low' | 'Medium' | 'High';
  priority: number;
}

export interface ArchitectureRecommendation {
  pillar: 'Reliability' | 'Security' | 'Cost Optimization' | 'Operational Excellence' | 'Performance Efficiency';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  finding: string;
  risk: string;
  recommendation: string;
  implementation: string;
  effort: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export interface AnalysisReport {
  summary: {
    resourcesAnalyzed: number;
    securityFindings: number;
    costSavingsOpportunities: number;
    architectureRecommendations: number;
    totalPotentialSavings?: string;
  };
  security?: SecurityFinding[];
  cost?: CostOptimization[];
  architecture?: ArchitectureRecommendation[];
  implementationRoadmap?: RoadmapItem[];
}

export interface RoadmapItem {
  phase: number;
  title: string;
  items: string[];
  estimatedEffort: string;
  estimatedSavings?: string;
}

/**
 * Stream event types for real-time agent execution visibility
 */
export type StreamEvent =
  | { type: 'status'; message: string; timestamp: string }
  | { type: 'tool_start'; toolName: string; toolInput: any; timestamp: string }
  | { type: 'tool_end'; toolName: string; timestamp: string }
  | { type: 'text'; text: string; timestamp: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number; timestamp: string }
  | { type: 'report'; report: AnalysisReport; timestamp: string }
  | { type: 'error'; error: string; timestamp: string };
