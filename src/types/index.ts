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

export interface AgentDescriptor {
  name: string;
  description: string;
}

export interface RuntimeMcpServer {
  name: string;
  status: string;
}

export interface StreamUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  totalCostUsd?: number;
  durationMs?: number;
  numTurns?: number;
}

/**
 * Stream event types for real-time agent execution visibility
 */
export type StreamEvent =
  | {
      type: 'run_started';
      requestId: string;
      resourceCount: number;
      scope: AnalysisRequest['scope'];
      model: string;
      tracing: { enabled: boolean; configured: boolean };
      agents: AgentDescriptor[];
      mcpServers: string[];
      timestamp: string;
    }
  | {
      type: 'runtime_context';
      cwd: string;
      tools: string[];
      mcpServers: RuntimeMcpServer[];
      agents: string[];
      skills: string[];
      model: string;
      permissionMode: string;
      apiKeySource: string;
      timestamp: string;
    }
  | { type: 'status'; message: string; timestamp: string }
  | {
      type: 'task_started';
      taskId: string;
      description: string;
      taskType?: string;
      workflowName?: string;
      prompt?: string;
      toolUseId?: string;
      timestamp: string;
    }
  | {
      type: 'task_progress';
      taskId: string;
      description: string;
      lastToolName?: string;
      summary?: string;
      usage?: { totalTokens: number; toolUses: number; durationMs: number };
      toolUseId?: string;
      timestamp: string;
    }
  | {
      type: 'task_completed';
      taskId: string;
      status: 'completed' | 'failed' | 'stopped';
      summary: string;
      outputFile: string;
      usage?: { totalTokens: number; toolUses: number; durationMs: number };
      toolUseId?: string;
      timestamp: string;
    }
  | {
      type: 'tool_start';
      toolUseId: string;
      toolName: string;
      toolInput: unknown;
      parentToolUseId: string | null;
      timestamp: string;
    }
  | {
      type: 'tool_progress';
      toolUseId: string;
      toolName: string;
      elapsedTimeSeconds: number;
      parentToolUseId: string | null;
      taskId?: string;
      timestamp: string;
    }
  | {
      type: 'tool_end';
      toolUseId: string;
      toolName: string;
      toolOutput?: unknown;
      isError?: boolean;
      parentToolUseId: string | null;
      timestamp: string;
    }
  | {
      type: 'tool_summary';
      summary: string;
      precedingToolUseIds: string[];
      timestamp: string;
    }
  | { type: 'text'; text: string; timestamp: string }
  | { type: 'usage'; usage: StreamUsage; timestamp: string }
  | { type: 'report'; report: AnalysisReport; timestamp: string }
  | { type: 'error'; error: string; timestamp: string }
  | { type: 'done'; timestamp: string };
