'use client';

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type AnalysisReport = {
  summary: {
    resourcesAnalyzed: number;
    securityFindings: number;
    costSavingsOpportunities: number;
    architectureRecommendations: number;
    totalPotentialSavings?: string;
  };
  security?: Array<Record<string, unknown>>;
  cost?: Array<Record<string, unknown>>;
  architecture?: Array<Record<string, unknown>>;
  implementationRoadmap?: Array<Record<string, unknown>>;
};

type StreamUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  totalCostUsd?: number;
  durationMs?: number;
  numTurns?: number;
};

type RuntimeContext = {
  cwd: string;
  tools: string[];
  mcpServers: Array<{ name: string; status: string }>;
  agents: string[];
  skills: string[];
  model: string;
  permissionMode: string;
  apiKeySource: string;
};

type RunMeta = {
  requestId: string;
  resourceCount: number;
  scope?: 'security' | 'cost' | 'architecture' | 'all';
  model: string;
  tracing: { enabled: boolean; configured: boolean };
  agents: Array<{ name: string; description: string }>;
  mcpServers: string[];
};

type FrontendEvent =
  | {
      type: 'run_started';
      requestId: string;
      resourceCount: number;
      scope?: 'security' | 'cost' | 'architecture' | 'all';
      model: string;
      tracing: { enabled: boolean; configured: boolean };
      agents: Array<{ name: string; description: string }>;
      mcpServers: string[];
      timestamp: string;
    }
  | {
      type: 'runtime_context';
      cwd: string;
      tools: string[];
      mcpServers: Array<{ name: string; status: string }>;
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

type Message = {
  id: string;
  type: 'user' | 'assistant' | 'status' | 'error';
  title: string;
  content: string;
  timestamp: string;
};

type ExecutionStep = {
  id: string;
  type: 'reasoning' | 'task' | 'tool' | 'status' | 'error' | 'user';
  title: string;
  content?: string;
  status: 'running' | 'completed' | 'error' | 'failed';
  timestamp: string;
  metadata?: {
    toolName?: string;
    toolUseId?: string;
    taskId?: string;
    taskDescription?: string;
    agentName?: string;
    input?: PayloadPreview;
    output?: PayloadPreview;
    elapsedTime?: number;
  };
};

type PayloadPreview = {
  text: string;
  truncated: boolean;
};

type TabId = 'conversation' | 'agents' | 'tools' | 'trace' | 'report';

type ToolExecution = {
  toolUseId: string;
  toolName: string;
  toolInput?: PayloadPreview;
  toolOutput?: PayloadPreview;
  parentToolUseId: string | null;
  taskId?: string;
  status: 'running' | 'completed' | 'error';
  startedAt: string;
  endedAt?: string;
  elapsedTimeSeconds?: number;
  isError?: boolean;
};

type TaskExecution = {
  taskId: string;
  description: string;
  taskType?: string;
  workflowName?: string;
  prompt?: string;
  toolUseId?: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startedAt: string;
  endedAt?: string;
  summary?: string;
  outputFile?: string;
  usage?: { totalTokens: number; toolUses: number; durationMs: number };
  lastToolName?: string;
};

type TraceRow = {
  id: string;
  label: string;
  kind: 'run' | 'task' | 'tool';
  startMs: number;
  durationMs: number;
  meta: string;
  status: 'running' | 'completed' | 'error' | 'failed' | 'stopped';
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
const MAX_EVENT_HISTORY = 400;
const MAX_PAYLOAD_PREVIEW_CHARS = 16000;

const tabs: Array<{ id: TabId; label: string; hint: string }> = [
  { id: 'conversation', label: 'Execution Flow', hint: '実行フロー' },
  { id: 'agents', label: 'Agents', hint: 'エージェント' },
  { id: 'tools', label: 'Tools', hint: 'ツール詳細' },
  { id: 'trace', label: 'Timeline', hint: 'タイムライン' },
  { id: 'report', label: 'Report', hint: '分析結果' },
];

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(text: string, max = 140) {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}…`;
}

function createPayloadPreview(value: unknown, maxChars = MAX_PAYLOAD_PREVIEW_CHARS): PayloadPreview {
  const text = formatJson(value);

  if (text.length <= maxChars) {
    return {
      text,
      truncated: false,
    };
  }

  return {
    text: `${text.slice(0, maxChars)}\n\n... truncated in UI ...`,
    truncated: true,
  };
}

function sanitizeEvent(event: FrontendEvent): FrontendEvent {
  if (event.type === 'tool_start') {
    return {
      ...event,
      toolInput: createPayloadPreview(event.toolInput),
    };
  }

  if (event.type === 'tool_end') {
    return {
      ...event,
      toolOutput: typeof event.toolOutput === 'undefined' ? undefined : createPayloadPreview(event.toolOutput),
    };
  }

  return event;
}

function getRelativeDuration(startedAt: string, endedAt?: string) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const durationMs = Math.max(0, end - start);

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}

function inferAgentLane(description: string) {
  const lower = description.toLowerCase();

  if (lower.includes('explore')) {
    return 'explore-agent';
  }

  if (lower.includes('security')) {
    return 'security-analyzer';
  }

  if (lower.includes('cost')) {
    return 'cost-optimizer';
  }

  return 'main-agent';
}

function buildToolExecutions(events: FrontendEvent[]) {
  const tools = new Map<string, ToolExecution>();

  for (const event of events) {
    if (event.type === 'tool_start') {
      tools.set(event.toolUseId, {
        toolUseId: event.toolUseId,
        toolName: event.toolName,
        toolInput: createPayloadPreview(event.toolInput),
        parentToolUseId: event.parentToolUseId,
        status: 'running',
        startedAt: event.timestamp,
      });
    }

    if (event.type === 'tool_progress') {
      const current = tools.get(event.toolUseId);
      if (!current) {
        continue;
      }

      tools.set(event.toolUseId, {
        ...current,
        taskId: event.taskId ?? current.taskId,
        elapsedTimeSeconds: event.elapsedTimeSeconds,
      });
    }

    if (event.type === 'tool_end') {
      const current = tools.get(event.toolUseId);
      tools.set(event.toolUseId, {
        toolUseId: event.toolUseId,
        toolName: event.toolName,
        toolInput: current?.toolInput,
        toolOutput: event.toolOutput ? createPayloadPreview(event.toolOutput) : undefined,
        parentToolUseId: event.parentToolUseId,
        taskId: current?.taskId,
        status: event.isError ? 'error' : 'completed',
        startedAt: current?.startedAt ?? event.timestamp,
        endedAt: event.timestamp,
        elapsedTimeSeconds: current?.elapsedTimeSeconds,
        isError: event.isError,
      });
    }
  }

  return Array.from(tools.values()).sort(
    (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
  );
}

function buildTaskExecutions(events: FrontendEvent[]) {
  const tasks = new Map<string, TaskExecution>();

  for (const event of events) {
    if (event.type === 'task_started') {
      tasks.set(event.taskId, {
        taskId: event.taskId,
        description: event.description,
        taskType: event.taskType,
        workflowName: event.workflowName,
        prompt: event.prompt,
        toolUseId: event.toolUseId,
        status: 'running',
        startedAt: event.timestamp,
      });
    }

    if (event.type === 'task_progress') {
      const current = tasks.get(event.taskId);
      if (!current) {
        continue;
      }

      tasks.set(event.taskId, {
        ...current,
        description: event.description,
        summary: event.summary ?? current.summary,
        lastToolName: event.lastToolName ?? current.lastToolName,
        usage: event.usage ?? current.usage,
      });
    }

    if (event.type === 'task_completed') {
      const current = tasks.get(event.taskId);
      tasks.set(event.taskId, {
        taskId: event.taskId,
        description: current?.description ?? event.summary,
        taskType: current?.taskType,
        workflowName: current?.workflowName,
        prompt: current?.prompt,
        toolUseId: event.toolUseId ?? current?.toolUseId,
        status: event.status,
        startedAt: current?.startedAt ?? event.timestamp,
        endedAt: event.timestamp,
        summary: event.summary,
        outputFile: event.outputFile,
        usage: event.usage ?? current?.usage,
        lastToolName: current?.lastToolName,
      });
    }
  }

  return Array.from(tasks.values()).sort(
    (left, right) => new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
  );
}

function buildTraceRows(
  events: FrontendEvent[],
  tools: ToolExecution[],
  tasks: TaskExecution[]
) {
  if (events.length === 0) {
    return { rows: [] as TraceRow[], totalMs: 0 };
  }

  const runStart = new Date(events[0].timestamp).getTime();
  const runEnd = new Date(events[events.length - 1].timestamp).getTime();
  const totalMs = Math.max(1, runEnd - runStart);

  const rows: TraceRow[] = [
    {
      id: 'run',
      label: 'Main run',
      kind: 'run',
      startMs: 0,
      durationMs: totalMs,
      meta: `${(totalMs / 1000).toFixed(1)} s`,
      status: 'completed',
    },
  ];

  for (const task of tasks) {
    const startMs = new Date(task.startedAt).getTime() - runStart;
    const endMs = (task.endedAt ? new Date(task.endedAt).getTime() : runEnd) - runStart;
    rows.push({
      id: task.taskId,
      label: task.description,
      kind: 'task',
      startMs,
      durationMs: Math.max(60, endMs - startMs),
      meta: task.lastToolName ? `last tool: ${task.lastToolName}` : task.status,
      status: task.status,
    });
  }

  for (const tool of tools) {
    const startMs = new Date(tool.startedAt).getTime() - runStart;
    const endMs = (tool.endedAt ? new Date(tool.endedAt).getTime() : runEnd) - runStart;
    rows.push({
      id: tool.toolUseId,
      label: tool.toolName,
      kind: 'tool',
      startMs,
      durationMs: Math.max(30, endMs - startMs),
      meta: tool.taskId ? `task ${tool.taskId.slice(0, 6)}` : tool.status,
      status: tool.status,
    });
  }

  return {
    rows: rows.sort((left, right) => left.startMs - right.startMs),
    totalMs,
  };
}

function ExecutionStepCard({ step }: { step: ExecutionStep }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStepIcon = () => {
    switch (step.type) {
      case 'user':
        return '👤';
      case 'reasoning':
        return '🤔';
      case 'task':
        return '🤖';
      case 'tool':
        return '🔧';
      case 'status':
        return 'ℹ️';
      case 'error':
        return '❌';
      default:
        return '•';
    }
  };

  const getStatusIcon = () => {
    if (step.status === 'running') {
      return (
        <svg className="h-4 w-4 animate-spin text-sky-600" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      );
    }
    if (step.status === 'completed') {
      return <span className="text-emerald-600">✓</span>;
    }
    if (step.status === 'error' || step.status === 'failed') {
      return <span className="text-rose-600">✗</span>;
    }
    return null;
  };

  const getStepColor = () => {
    switch (step.type) {
      case 'user':
        return 'bg-slate-950 text-white border-slate-950';
      case 'reasoning':
        return 'bg-white border-slate-200 text-slate-900';
      case 'task':
        const agentName = step.metadata?.agentName || 'main-agent';
        if (agentName === 'explore-agent') return 'bg-sky-50 border-sky-200 text-sky-900';
        if (agentName === 'security-analyzer') return 'bg-amber-50 border-amber-200 text-amber-900';
        if (agentName === 'cost-optimizer') return 'bg-emerald-50 border-emerald-200 text-emerald-900';
        return 'bg-slate-50 border-slate-200 text-slate-900';
      case 'tool':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'error':
        return 'bg-rose-50 border-rose-200 text-rose-900';
      default:
        return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const hasExpandableContent = step.type === 'tool' || step.type === 'task';

  return (
    <div className={`rounded-2xl border px-4 py-3 ${getStepColor()}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{getStepIcon()}</span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{step.title}</span>
              {getStatusIcon()}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-60">{formatTimestamp(step.timestamp)}</span>
              {hasExpandableContent && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-medium opacity-60 hover:opacity-100"
                >
                  {isExpanded ? '▼' : '▶'}
                </button>
              )}
            </div>
          </div>

          {step.content && !hasExpandableContent && (
            <div className="mt-2 text-sm leading-6 whitespace-pre-wrap">{step.content}</div>
          )}

          {hasExpandableContent && isExpanded && (
            <div className="mt-3 space-y-2">
              {step.metadata?.input && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Input</div>
                  <pre className="mt-1 overflow-auto rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">
                    {step.metadata.input.text}
                  </pre>
                  {step.metadata.input.truncated && (
                    <div className="mt-1 text-xs text-amber-600">⚠ Content truncated</div>
                  )}
                </div>
              )}
              {step.metadata?.output && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Output</div>
                  <pre className="mt-1 overflow-auto rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-100">
                    {step.metadata.output.text}
                  </pre>
                  {step.metadata.output.truncated && (
                    <div className="mt-1 text-xs text-amber-600">⚠ Content truncated</div>
                  )}
                </div>
              )}
              {step.content && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-60">Summary</div>
                  <div className="mt-1 text-sm">{step.content}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [resources, setResources] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [events, setEvents] = useState<FrontendEvent[]>([]);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null);
  const [runtimeContext, setRuntimeContext] = useState<RuntimeContext | null>(null);
  const [usage, setUsage] = useState<StreamUsage | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('conversation');
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const deferredEvents = useDeferredValue(events);

  const toolExecutions = useMemo(() => buildToolExecutions(deferredEvents), [deferredEvents]);
  const taskExecutions = useMemo(() => buildTaskExecutions(deferredEvents), [deferredEvents]);
  const trace = useMemo(
    () => buildTraceRows(deferredEvents, toolExecutions, taskExecutions),
    [deferredEvents, toolExecutions, taskExecutions]
  );
  const selectedTool = useMemo(
    () => toolExecutions.find((tool) => tool.toolUseId === selectedToolId) ?? toolExecutions[0] ?? null,
    [selectedToolId, toolExecutions]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedToolId && toolExecutions[0]) {
      setSelectedToolId(toolExecutions[0].toolUseId);
    }
  }, [selectedToolId, toolExecutions]);

  function addMessage(next: Omit<Message, 'id'>) {
    setMessages((previous) => [
      ...previous,
      {
        ...next,
        id: crypto.randomUUID(),
      },
    ]);
  }

  function appendAssistantText(chunk: string, timestamp: string) {
    setMessages((previous) => {
      const next = [...previous];
      for (let index = next.length - 1; index >= 0; index -= 1) {
        if (next[index].type === 'assistant') {
          next[index] = {
            ...next[index],
            content: next[index].content + chunk,
            timestamp,
          };
          return next;
        }
      }

      return [
        ...previous,
        {
          id: crypto.randomUUID(),
          type: 'assistant',
          title: 'GitHub Copilot',
          content: chunk,
          timestamp,
        },
      ];
    });
  }

  function resetRunState() {
    setEvents([]);
    setReport(null);
    setRunMeta(null);
    setRuntimeContext(null);
    setUsage(null);
    setSelectedToolId(null);
    setRequestError(null);
    setExecutionSteps([]);
  }

  function addExecutionStep(step: Omit<ExecutionStep, 'id'>) {
    setExecutionSteps((previous) => [
      ...previous,
      {
        ...step,
        id: crypto.randomUUID(),
      },
    ]);
  }

  function updateExecutionStep(id: string, updates: Partial<ExecutionStep>) {
    setExecutionSteps((previous) =>
      previous.map((step) => (step.id === id ? { ...step, ...updates } : step))
    );
  }

  function findExecutionStep(predicate: (step: ExecutionStep) => boolean) {
    return executionSteps.find(predicate);
  }


  function handleEvent(event: FrontendEvent) {
    const sanitizedEvent = sanitizeEvent(event);

    setEvents((previous) => {
      const next = [...previous, sanitizedEvent];
      if (next.length <= MAX_EVENT_HISTORY) {
        return next;
      }

      return next.slice(next.length - MAX_EVENT_HISTORY);
    });

    if (event.type === 'run_started') {
      setRunMeta({
        requestId: event.requestId,
        resourceCount: event.resourceCount,
        scope: event.scope,
        model: event.model,
        tracing: event.tracing,
        agents: event.agents,
        mcpServers: event.mcpServers,
      });
      addMessage({
        type: 'status',
        title: 'Run Started',
        content: `Request ${event.requestId.slice(0, 8)} started with ${event.resourceCount} resources.`,
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'runtime_context') {
      setRuntimeContext({
        cwd: event.cwd,
        tools: event.tools,
        mcpServers: event.mcpServers,
        agents: event.agents,
        skills: event.skills,
        model: event.model,
        permissionMode: event.permissionMode,
        apiKeySource: event.apiKeySource,
      });
      return;
    }

    if (event.type === 'status') {
      addMessage({
        type: 'status',
        title: 'Status',
        content: event.message,
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'task_started') {
      const agentName = inferAgentLane(event.description);
      addExecutionStep({
        type: 'task',
        title: event.description,
        status: 'running',
        timestamp: event.timestamp,
        metadata: {
          taskId: event.taskId,
          taskDescription: event.description,
          agentName,
        },
      });
      addMessage({
        type: 'status',
        title: 'Task',
        content: `Started: ${event.description}`,
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'task_progress') {
      const step = findExecutionStep(s => s.metadata?.taskId === event.taskId);
      if (step) {
        updateExecutionStep(step.id, {
          title: event.description,
          metadata: {
            ...step.metadata,
            taskDescription: event.description,
          },
        });
      }
      return;
    }

    if (event.type === 'task_completed') {
      const step = findExecutionStep(s => s.metadata?.taskId === event.taskId);
      if (step) {
        updateExecutionStep(step.id, {
          status: event.status === 'failed' ? 'failed' : 'completed',
          content: event.summary,
        });
      }
      addMessage({
        type: event.status === 'failed' ? 'error' : 'status',
        title: 'Task Result',
        content: `${event.status.toUpperCase()}: ${event.summary}`,
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'tool_start') {
      const sanitizedInput = createPayloadPreview(event.toolInput);
      addExecutionStep({
        type: 'tool',
        title: event.toolName,
        status: 'running',
        timestamp: event.timestamp,
        metadata: {
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          input: sanitizedInput,
        },
      });
      return;
    }

    if (event.type === 'tool_end') {
      const step = findExecutionStep(s => s.metadata?.toolUseId === event.toolUseId);
      if (step) {
        const sanitizedOutput = event.toolOutput ? createPayloadPreview(event.toolOutput) : undefined;
        updateExecutionStep(step.id, {
          status: event.isError ? 'error' : 'completed',
          metadata: {
            ...step.metadata,
            output: sanitizedOutput,
          },
        });
      }
      return;
    }

    if (event.type === 'text') {
      // Check if we have an existing reasoning step that's still being built
      const lastStep = executionSteps[executionSteps.length - 1];
      if (lastStep && lastStep.type === 'reasoning' && lastStep.status === 'running') {
        updateExecutionStep(lastStep.id, {
          content: (lastStep.content || '') + event.text,
        });
      } else {
        // Create a new reasoning step
        addExecutionStep({
          type: 'reasoning',
          title: 'Thinking',
          content: event.text,
          status: 'running',
          timestamp: event.timestamp,
        });
      }
      appendAssistantText(event.text, event.timestamp);
      return;
    }

    if (event.type === 'usage') {
      setUsage(event.usage);
      return;
    }

    if (event.type === 'report') {
      setReport(event.report);
      setActiveTab('report');
      addMessage({
        type: 'status',
        title: 'Report Ready',
        content: 'Final analysis report is available.',
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'error') {
      setRequestError(event.error);
      addMessage({
        type: 'error',
        title: 'Execution Error',
        content: event.error,
        timestamp: event.timestamp,
      });
      return;
    }

    if (event.type === 'done') {
      // Mark any running reasoning steps as completed
      const lastStep = executionSteps[executionSteps.length - 1];
      if (lastStep && lastStep.type === 'reasoning' && lastStep.status === 'running') {
        updateExecutionStep(lastStep.id, { status: 'completed' });
      }
      addMessage({
        type: 'status',
        title: 'Run Complete',
        content: 'Streaming finished.',
        timestamp: event.timestamp,
      });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!resources.trim() || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    resetRunState();
    setMessages([]);
    setActiveTab('conversation');

    const userRequestTimestamp = new Date().toISOString();

    addMessage({
      type: 'user',
      title: 'User Request',
      content: 'Azure resource analysis with execution visibility and tracing view',
      timestamp: userRequestTimestamp,
    });

    addExecutionStep({
      type: 'user',
      title: 'User Request',
      content: 'Azure resource analysis with execution visibility and tracing view',
      status: 'completed',
      timestamp: userRequestTimestamp,
    });

    addMessage({
      type: 'assistant',
      title: 'GitHub Copilot',
      content: '',
      timestamp: new Date().toISOString(),
    });

    try {
      let resourcesData: unknown;

      try {
        resourcesData = JSON.parse(resources);
      } catch {
        addMessage({
          type: 'error',
          title: 'Input Error',
          content: 'Invalid JSON format. Please provide valid Azure resource data.',
          timestamp: new Date().toISOString(),
        });
        setIsAnalyzing(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/analyze/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resources: Array.isArray(resourcesData)
            ? resourcesData
            : typeof resourcesData === 'object' && resourcesData !== null && 'resources' in resourcesData
              ? (resourcesData as { resources?: unknown[] }).resources || []
              : [],
          scope: 'all',
          format: 'json',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) {
            continue;
          }

          try {
            const parsed = JSON.parse(line.slice(6)) as FrontendEvent;
            handleEvent(parsed);
          } catch (error) {
            console.error('Failed to parse event', error);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setRequestError(message);
      addMessage({
        type: 'error',
        title: 'Request Error',
        content: `Failed to analyze: ${message}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function loadSampleData() {
    try {
      const response = await fetch('/sample-azure-export.json');
      const data = await response.json();
      startTransition(() => {
        setResources(JSON.stringify(data, null, 2));
      });
    } catch {
      addMessage({
        type: 'error',
        title: 'Sample Load Error',
        content: 'Failed to load sample data.',
        timestamp: new Date().toISOString(),
      });
    }
  }

  const resourceCount = useMemo(() => {
    try {
      const parsed = JSON.parse(resources) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.length;
      }

      if (parsed && typeof parsed === 'object' && 'resources' in parsed) {
        const value = (parsed as { resources?: unknown[] }).resources;
        return Array.isArray(value) ? value.length : 0;
      }

      return 0;
    } catch {
      return 0;
    }
  }, [resources]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(39,109,241,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(247,180,32,0.16),_transparent_26%),linear-gradient(180deg,_#f7f3ea_0%,_#fbfaf6_48%,_#eef4ff_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 lg:px-6 lg:py-6">
        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="glass-panel flex flex-col gap-4 rounded-[28px] p-5 shadow-[0_24px_80px_rgba(66,84,120,0.12)]">
            <div className="space-y-3">
              <div className="inline-flex rounded-full border border-white/60 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
                Agent Operations
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                  Azure Resource Analyzer
                </h1>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Resources</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{resourceCount}</div>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {isAnalyzing ? 'Running' : 'Ready'}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/72 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Resource Input</h2>
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-200"
                >
                  Sample
                </button>
              </div>
              <textarea
                value={resources}
                onChange={(next) => setResources(next.target.value)}
                placeholder='{"resources": [...]}'
                className="min-h-[360px] w-full rounded-[20px] border border-slate-200 bg-slate-950/95 p-4 font-mono text-xs leading-6 text-slate-100 shadow-inner outline-none ring-0 placeholder:text-slate-500"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <button
                type="submit"
                disabled={!resources.trim() || isAnalyzing}
                className="w-full rounded-[20px] bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isAnalyzing ? 'Analyzing…' : 'Run Analysis'}
              </button>
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={() => {
                  startTransition(() => {
                    setResources('');
                    setMessages([]);
                    resetRunState();
                  });
                }}
                className="w-full rounded-[20px] border border-slate-300 bg-white/80 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </form>

            <div className="rounded-[24px] border border-slate-200/80 bg-gradient-to-br from-white to-sky-50 p-4">
              <div className="text-sm font-semibold text-slate-900">Execution Stats</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-4">
                  <span>Tools</span>
                  <span className="font-medium text-slate-900">{toolExecutions.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Tasks</span>
                  <span className="font-medium text-slate-900">{taskExecutions.length}</span>
                </div>
              </div>
            </div>
          </aside>

          <section className="glass-panel flex min-h-[calc(100vh-2rem)] flex-col rounded-[32px] p-4 shadow-[0_24px_80px_rgba(66,84,120,0.12)] lg:p-5">
            <header className="rounded-[28px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(237,244,255,0.92))] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      Agent Execution Monitor
                    </h2>
                    {isAnalyzing && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                        Running
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[380px]">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Input</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{usage?.inputTokens ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Output</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{usage?.outputTokens ?? 0}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white/78 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Duration</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">
                      {usage?.durationMs ? `${(usage.durationMs / 1000).toFixed(1)}s` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 px-1 pb-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl px-4 py-3 text-left transition ${
                    activeTab === tab.id
                      ? 'bg-slate-950 text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)]'
                      : 'bg-white/70 text-slate-700 hover:bg-white'
                  }`}
                >
                  <div className="text-sm font-semibold">{tab.label}</div>
                  <div className={`text-xs ${activeTab === tab.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {tab.hint}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/70 bg-white/70 p-4">
              {activeTab === 'conversation' && (
                <div className="flex h-full flex-col overflow-hidden">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Execution Flow</div>
                      <div className="text-xs text-slate-500">タスク、ツール、推論を時系列で表示</div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {executionSteps.length} step{executionSteps.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 overflow-auto pr-1">
                    {executionSteps.length === 0 && (
                      <div className="grid h-full place-items-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-slate-500">
                        実行するとここに実行フローが表示されます
                      </div>
                    )}

                    {executionSteps.map((step) => (
                      <ExecutionStepCard key={step.id} step={step} />
                    ))}

                    <div ref={messagesEndRef} />
                  </div>
                </div>
              )}

              {activeTab === 'agents' && (
                <div className="grid h-full gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
                  <div className="space-y-4 overflow-auto pr-1">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Agent topology</div>
                      <div className="mt-3 space-y-3">
                        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Main Agent</div>
                          <div className="mt-2 text-lg font-semibold">Azure Resource Analysis Agent</div>
                          <div className="mt-1 text-sm text-slate-300">
                            Orchestrates exploration, security, and cost analysis.
                          </div>
                        </div>
                        {(runMeta?.agents ?? []).map((agent) => (
                          <div
                            key={agent.name}
                            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                          >
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              {agent.name}
                            </div>
                            <div className="mt-2 text-base font-semibold text-slate-900">
                              {agent.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Runtime context</div>
                      <dl className="mt-3 space-y-2 text-sm text-slate-600">
                        <div className="flex justify-between gap-4">
                          <dt>Model</dt>
                          <dd className="font-medium text-slate-900">{runtimeContext?.model ?? 'Waiting'}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Permission</dt>
                          <dd className="font-medium text-slate-900">
                            {runtimeContext?.permissionMode ?? 'Waiting'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>API key source</dt>
                          <dd className="font-medium text-slate-900">
                            {runtimeContext?.apiKeySource ?? 'Waiting'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="overflow-auto pr-1">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Task timeline</div>
                          <div className="text-xs text-slate-500">
                            SDK が通知した task started / progress / completed を表示
                          </div>
                        </div>
                        <div className="text-xs text-slate-500">{taskExecutions.length} tasks</div>
                      </div>

                      <div className="space-y-3">
                        {taskExecutions.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                            まだ task イベントは届いていません。
                          </div>
                        )}

                        {taskExecutions.map((task) => (
                          <div key={task.taskId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                  {inferAgentLane(task.description)}
                                </div>
                                <div className="mt-1 text-base font-semibold text-slate-900">
                                  {task.description}
                                </div>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  task.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : task.status === 'failed'
                                      ? 'bg-rose-100 text-rose-700'
                                      : task.status === 'stopped'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-sky-100 text-sky-700'
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Started</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {formatTimestamp(task.startedAt)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Duration</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {getRelativeDuration(task.startedAt, task.endedAt)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Last tool</div>
                                <div className="mt-1 font-medium text-slate-900">
                                  {task.lastToolName ?? 'n/a'}
                                </div>
                              </div>
                            </div>
                            {task.summary && (
                              <div className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm leading-6 text-slate-700">
                                {task.summary}
                              </div>
                            )}
                            {task.prompt && (
                              <details className="mt-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700">
                                <summary className="cursor-pointer font-medium text-slate-900">Prompt snapshot</summary>
                                <pre className="mt-3 overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-slate-700">
                                  {task.prompt}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tools' && (
                <div className="grid h-full gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="overflow-auto pr-1">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Tool executions</div>
                          <div className="text-xs text-slate-500">各ツールの開始・進捗・終了を追跡</div>
                        </div>
                        <div className="text-xs text-slate-500">{toolExecutions.length} observed</div>
                      </div>

                      <div className="space-y-2">
                        {toolExecutions.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                            ツールイベント待機中です。
                          </div>
                        )}

                        {toolExecutions.map((tool) => (
                          <button
                            key={tool.toolUseId}
                            type="button"
                            onClick={() => setSelectedToolId(tool.toolUseId)}
                            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                              selectedTool?.toolUseId === tool.toolUseId
                                ? 'border-slate-900 bg-slate-950 text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold">{tool.toolName}</div>
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  selectedTool?.toolUseId === tool.toolUseId
                                    ? 'bg-white/15 text-white'
                                    : tool.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : tool.status === 'error'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-sky-100 text-sky-700'
                                }`}
                              >
                                {tool.status}
                              </span>
                            </div>
                            <div className={`mt-2 text-xs ${selectedTool?.toolUseId === tool.toolUseId ? 'text-slate-300' : 'text-slate-500'}`}>
                              {truncate(tool.toolInput?.text ?? '', 90)}
                            </div>
                            <div className={`mt-3 flex items-center justify-between text-xs ${selectedTool?.toolUseId === tool.toolUseId ? 'text-slate-300' : 'text-slate-500'}`}>
                              <span>{formatTimestamp(tool.startedAt)}</span>
                              <span>{getRelativeDuration(tool.startedAt, tool.endedAt)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto pr-1">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      {!selectedTool && (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">
                          左側からツール呼び出しを選ぶと、入力と出力を確認できます。
                        </div>
                      )}

                      {selectedTool && (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Tool detail</div>
                              <div className="mt-1 text-2xl font-semibold text-slate-950">
                                {selectedTool.toolName}
                              </div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                              {selectedTool.toolUseId}
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Status</div>
                              <div className="mt-2 font-semibold text-slate-950">{selectedTool.status}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Parent</div>
                              <div className="mt-2 font-semibold text-slate-950">
                                {selectedTool.parentToolUseId ?? 'root'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Task</div>
                              <div className="mt-2 font-semibold text-slate-950">
                                {selectedTool.taskId ?? 'n/a'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Duration</div>
                              <div className="mt-2 font-semibold text-slate-950">
                                {getRelativeDuration(selectedTool.startedAt, selectedTool.endedAt)}
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 text-sm font-semibold text-slate-900">Input</div>
                              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                                {selectedTool.toolInput?.text ?? ''}
                              </pre>
                              {selectedTool.toolInput?.truncated && (
                                <div className="mt-2 text-xs text-slate-500">
                                  Large payload truncated to keep the UI responsive.
                                </div>
                              )}
                            </div>
                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 text-sm font-semibold text-slate-900">Output</div>
                              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                                {selectedTool.toolOutput?.text ?? ''}
                              </pre>
                              {selectedTool.toolOutput?.truncated && (
                                <div className="mt-2 text-xs text-slate-500">
                                  Large payload truncated to keep the UI responsive.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'trace' && (
                <div className="grid h-full gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-4 overflow-auto pr-1">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Trace summary</div>
                      <dl className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <dt>Request ID</dt>
                          <dd className="font-medium text-slate-900">
                            {runMeta?.requestId.slice(0, 8) ?? 'Waiting'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Total rows</dt>
                          <dd className="font-medium text-slate-900">{trace.rows.length}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Total duration</dt>
                          <dd className="font-medium text-slate-900">
                            {trace.totalMs ? `${(trace.totalMs / 1000).toFixed(1)} s` : 'Waiting'}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt>Trace source</dt>
                          <dd className="font-medium text-slate-900">
                            {runMeta?.tracing.enabled ? 'OpenTelemetry + UI' : 'UI event timeline'}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="text-sm font-semibold text-slate-900">Available tools</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(runtimeContext?.tools ?? []).map((tool) => (
                          <span key={tool} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {tool}
                          </span>
                        ))}
                        {!runtimeContext?.tools.length && (
                          <span className="text-sm text-slate-500">Waiting for init event</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-auto pr-1">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Execution waterfall</div>
                          <div className="text-xs text-slate-500">
                            Main run, subagent task, tool call を一本の時間軸に投影
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {trace.rows.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                            実行後にウォーターフォールを描画します。
                          </div>
                        )}

                        {trace.rows.map((row) => {
                          const left = `${(row.startMs / trace.totalMs) * 100}%`;
                          const width = `${Math.max(2, (row.durationMs / trace.totalMs) * 100)}%`;

                          return (
                            <div key={row.id} className="grid gap-3 md:grid-cols-[240px_minmax(0,1fr)] md:items-center">
                              <div>
                                <div className="text-sm font-semibold text-slate-900">{truncate(row.label, 48)}</div>
                                <div className="text-xs text-slate-500">{row.meta}</div>
                              </div>
                              <div className="relative h-11 rounded-2xl bg-slate-100">
                                <div
                                  className={`absolute top-1/2 h-7 -translate-y-1/2 rounded-xl ${
                                    row.kind === 'run'
                                      ? 'bg-slate-900'
                                      : row.kind === 'task'
                                        ? row.status === 'failed'
                                          ? 'bg-rose-500'
                                          : 'bg-sky-500'
                                        : row.status === 'error'
                                          ? 'bg-amber-500'
                                          : 'bg-emerald-500'
                                  }`}
                                  style={{ left, width }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'report' && (
                <div className="h-full overflow-auto pr-1">
                  {!report && (
                    <div className="grid h-full place-items-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500">
                      解析完了後に report をここに表示します。
                    </div>
                  )}

                  {report && (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Resources</div>
                          <div className="mt-2 text-3xl font-semibold text-slate-950">
                            {report.summary.resourcesAnalyzed}
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Security</div>
                          <div className="mt-2 text-3xl font-semibold text-slate-950">
                            {report.summary.securityFindings}
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Cost</div>
                          <div className="mt-2 text-3xl font-semibold text-slate-950">
                            {report.summary.costSavingsOpportunities}
                          </div>
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Architecture</div>
                          <div className="mt-2 text-3xl font-semibold text-slate-950">
                            {report.summary.architectureRecommendations}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="mb-3 text-sm font-semibold text-slate-900">Security findings</div>
                          <div className="space-y-3">
                            {(report.security ?? []).length === 0 && (
                              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                                No security findings in report.
                              </div>
                            )}
                            {(report.security ?? []).map((finding, index) => (
                              <div key={index} className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                                <div className="font-semibold text-slate-900">
                                  {String(finding.resource ?? finding.finding ?? `Finding ${index + 1}`)}
                                </div>
                                <div className="mt-1">{String(finding.finding ?? finding.remediation ?? '')}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="mb-3 text-sm font-semibold text-slate-900">Cost opportunities</div>
                          <div className="space-y-3">
                            {(report.cost ?? []).length === 0 && (
                              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                                No cost opportunities in report.
                              </div>
                            )}
                            {(report.cost ?? []).map((finding, index) => (
                              <div key={index} className="rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                                <div className="font-semibold text-slate-900">
                                  {String(finding.resource ?? finding.recommendation ?? `Opportunity ${index + 1}`)}
                                </div>
                                <div className="mt-1">{String(finding.recommendation ?? finding.finding ?? '')}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                        <div className="mb-3 text-sm font-semibold text-slate-900">Raw JSON</div>
                        <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
                          {formatJson(report)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {requestError && (
              <div className="mt-4 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {requestError}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}