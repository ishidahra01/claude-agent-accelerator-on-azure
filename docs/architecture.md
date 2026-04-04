# Architecture Documentation

## System Overview

The Azure Resource Analysis Agent is a production-ready implementation of Claude Agent SDK deployed on Azure Container Apps with Microsoft Foundry-hosted Claude models. This architecture demonstrates enterprise-grade agentic AI with full observability, deployment automation, and Azure-native integration.

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              User / Client                             │
│                    (Azure Portal, CLI, API, Web UI)                    │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             │ HTTPS Request (JSON)
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Azure Container Apps Environment                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Azure Resource Analyzer Container                   │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │          Main Agent (index.ts + CLAUDE.md)               │ │  │
│  │  │                                                            │ │  │
│  │  │  Role: Orchestrate analysis workflow                      │ │  │
│  │  │  - Parse Azure resource export                            │ │  │
│  │  │  - Delegate to specialized subagents                      │ │  │
│  │  │  - Synthesize findings into report                        │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │  │
│  │  │ Security        │  │ Cost            │  │ Architecture   │  │  │
│  │  │ Analyzer        │  │ Optimizer       │  │ Reviewer       │  │  │
│  │  │ Subagent        │  │ Subagent        │  │ Subagent       │  │  │
│  │  │                 │  │                 │  │                │  │  │
│  │  │ Analyzes:       │  │ Analyzes:       │  │ Analyzes:      │  │  │
│  │  │ - IAM policies  │  │ - VM sizing     │  │ - Reliability  │  │  │
│  │  │ - Network ACLs  │  │ - Unused rsrcs  │  │ - Best pract.  │  │  │
│  │  │ - Encryption    │  │ - Reserved inst │  │ - WAF align.   │  │  │
│  │  └─────────────────┘  └─────────────────┘  └────────────────┘  │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │         Skills (Domain Knowledge Modules)                │ │  │
│  │  │                                                            │ │  │
│  │  │  - Azure Well-Architected Framework                       │ │  │
│  │  │  - Security Best Practices (CIS, ASB)                     │ │  │
│  │  │  - Cost Optimization Patterns                             │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │         Observability Layer                              │ │  │
│  │  │                                                            │ │  │
│  │  │  - OpenTelemetry Tracing                                  │ │  │
│  │  │  - Evaluation Framework                                   │ │  │
│  │  │  - Structured Logging                                     │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  Container Orchestration:                                             │
│  - Auto-scaling (1-10 replicas)                                       │
│  - Health checks                                                      │
│  - Secret management                                                  │
└────────────────────────────┬───────────────────┬───────────────────────┘
                             │                   │
                 ┌───────────┴───────┐  ┌────────┴────────┐
                 ▼                   ▼  ▼                 ▼
    ┌────────────────────┐  ┌─────────────────────────────────────┐
    │ Microsoft Foundry  │  │   Azure Observability Stack         │
    │                    │  │                                     │
    │ ┌────────────────┐ │  │ ┌─────────────────────────────┐   │
    │ │ Claude Sonnet  │ │  │ │ Application Insights        │   │
    │ │     4.5        │ │  │ │ - Distributed Tracing       │   │
    │ │                │ │  │ │ - Custom Metrics            │   │
    │ │ 200K Context   │ │  │ │ - Log Analytics             │   │
    │ └────────────────┘ │  │ └─────────────────────────────┘   │
    │                    │  │                                     │
    │ ┌────────────────┐ │  │ ┌─────────────────────────────┐   │
    │ │ Claude Opus    │ │  │ │ Evaluation Framework        │   │
    │ │     4.5        │ │  │ │ - Quality Metrics           │   │
    │ │ (Optional)     │ │  │ │ - Safety Checks             │   │
    │ └────────────────┘ │  │ │ - Compliance Validation     │   │
    │                    │  │ └─────────────────────────────┘   │
    │ Features:          │  │                                     │
    │ - Azure endpoints  │  │ ┌─────────────────────────────┐   │
    │ - Entra ID auth    │  │ │ Azure Monitor               │   │
    │ - Zero retention   │  │ │ - Alerts & Dashboards       │   │
    │ - Azure billing    │  │ └─────────────────────────────┘   │
    └────────────────────┘  └─────────────────────────────────────┘
```

## Component Details

### 1. Main Agent

**Location**: `src/agent/main-agent.ts` + `.claude/CLAUDE.md`

**Responsibilities**:
- Accept analysis requests (JSON with Azure resources)
- Load agent behavior from CLAUDE.md
- Delegate to specialized subagents based on analysis scope
- Synthesize findings from all subagents
- Generate structured report with prioritized recommendations
- Trigger evaluation framework (if enabled)

**Key Design Decisions**:
- **Stateless**: Each analysis is independent, no session state
- **Parallel Execution**: Subagents run concurrently for speed
- **Markdown-Driven**: Agent behavior defined in `.claude/CLAUDE.md`, not code

### 2. Subagents

#### Security Analyzer Subagent

**Location**: `.claude/agents/security-analyzer.md`

**Specialization**:
- Network security (NSGs, firewalls, public endpoints)
- Identity & access management (RBAC, service principals)
- Data protection (encryption, TLS versions)
- Secrets management (Key Vault usage, hardcoded credentials)
- Logging & monitoring (diagnostic logs, Defender)

**Output Format**: JSON array of security findings with severity, remediation, compliance references

#### Cost Optimizer Subagent

**Location**: `.claude/agents/cost-optimizer.md`

**Specialization**:
- Resource rightsizing (VM/DB sizing vs. utilization)
- Waste elimination (unattached disks, stopped VMs)
- Commitment discounts (reserved instances, savings plans)
- Pricing tier optimization (premium vs. standard)
- Scheduling opportunities (dev/test shutdown)

**Output Format**: JSON array of cost optimizations with savings calculations, effort, risk

#### Architecture Reviewer Subagent (Planned)

**Location**: `.claude/agents/architecture-reviewer.md` (to be implemented)

**Specialization**:
- Azure Well-Architected Framework alignment (5 pillars)
- Reliability patterns (availability zones, backup, DR)
- Performance efficiency (caching, CDN, scaling)
- Operational excellence (IaC, CI/CD, monitoring)

### 3. Skills

#### Azure Well-Architected Framework Skill

**Location**: `.claude/skills/azure-well-architected/SKILL.md`

**Knowledge Areas**:
- Reliability pillar: HA patterns, DR, health monitoring
- Security pillar: Defense-in-depth, Zero Trust, encryption
- Cost Optimization pillar: Rightsizing, reserved capacity, waste elimination
- Operational Excellence pillar: IaC, CI/CD, observability
- Performance Efficiency pillar: Scaling, caching, CDN

**Usage**: Referenced by all subagents for best practice validation

### 4. Foundry Client

**Location**: `src/models/foundry-client.ts`

**Responsibilities**:
- Wrap Anthropic SDK with Foundry-specific configuration
- Handle Azure-native endpoints (`https://<resource>.services.ai.azure.com/anthropic`)
- Support both API key and Entra ID authentication
- Provide streaming and non-streaming message APIs

**Design Pattern**: Adapter pattern—swap Foundry for direct Anthropic with minimal code changes

### 5. Observability Layer

#### Tracing

**Location**: `src/observability/tracing.ts`

**Implementation**:
- OpenTelemetry instrumentation
- Azure Monitor exporter via `@azure/monitor-opentelemetry`
- Traces every agent operation: security analysis, cost analysis, synthesis
- Records token usage, latency, error rates

**Trace Structure**:
```
analyze-resources (parent span)
  ├─ security-analysis
  │   └─ foundry-api-call (tokens, latency)
  └─ cost-analysis
      └─ foundry-api-call (tokens, latency)
```

#### Evaluation

**Location**: `src/observability/evaluation.ts` + `evaluation/criteria.json`

**Criteria**:
- **Coherence**: Logical structure (threshold: 0.7)
- **Groundedness**: Based on actual resources (threshold: 0.8)
- **Completeness**: Covers all domains (threshold: 0.8)
- **Actionability**: Specific remediation steps (threshold: 0.9)
- **Safety**: No risky suggestions (threshold: 0.95)

**Process**:
1. Parse analysis report
2. Validate findings against input resources
3. Check remediation specificity
4. Assess safety implications
5. Calculate weighted score
6. Pass/fail determination

## Data Flow

### Request Flow

1. **User Request**:
   ```json
   {
     "resources": [ /* Azure resource objects */ ],
     "scope": "all",  // or "security", "cost"
     "format": "json"
   }
   ```

2. **Main Agent Processing**:
   - Reads `CLAUDE.md` instructions
   - Loads available skills and subagents
   - Creates trace span for entire analysis

3. **Subagent Delegation**:
   - Main agent constructs prompts for each subagent
   - Includes subagent-specific instructions from `.claude/agents/`
   - References skills (Azure Well-Architected Framework)
   - Sends to Foundry Claude API in parallel

4. **Model Invocation** (via Foundry):
   - Request routed to Azure-hosted Claude Sonnet 4.5
   - 200K context window accommodates large resource sets
   - Structured JSON output generated

5. **Response Synthesis**:
   - Main agent collects subagent responses
   - Parses JSON findings
   - Merges into unified report structure
   - Adds summary statistics

6. **Evaluation** (if enabled):
   - Run evaluation criteria against report
   - Log results to Application Insights
   - Include in trace metadata

7. **Response**:
   ```json
   {
     "summary": { /* counts */ },
     "security": [ /* findings */ ],
     "cost": [ /* optimizations */ ]
   }
   ```

## Deployment Architecture

### Container Image Build

```
Build Stage (node:18-alpine):
  - Install dependencies (npm ci)
  - Compile TypeScript (tsc)
  - Output to dist/

Production Stage (node:18-alpine):
  - Copy production node_modules only
  - Copy compiled dist/
  - Copy .claude/ (agent definitions)
  - Copy examples/ (sample data)
  - Run as non-root user (nodejs:nodejs)
```

**Image Size**: ~200 MB (optimized via multi-stage build)

### Azure Container Apps Environment

**Infrastructure**:
- Managed Kubernetes-based platform (abstracted)
- Auto-scaling: 1-10 replicas based on HTTP concurrency
- Health checks: Node.js process check every 30s
- Ingress: HTTPS with auto-provisioned TLS certificate

**Configuration**:
```yaml
CPU: 0.5 cores
Memory: 1.0 GB
Min Replicas: 1
Max Replicas: 3
Target Concurrency: 10 concurrent requests
```

**Secrets**:
- `foundry-api-key`: Stored as Container Apps secret
- Reference in env vars as `secretref:foundry-api-key`

### Networking

**Default**:
- Public ingress (HTTPS only)
- Outbound: Internet access for Foundry API calls

**Production** (optional):
- VNet integration: Deploy to private subnet
- Private endpoints: Foundry API via Azure Private Link
- Internal ingress: Accessible only within VNet

## Security Architecture

### Authentication Flow

**Current** (API Key):
```
Container App → Foundry Endpoint
  Header: x-api-key: <secret>
```

**Future** (Managed Identity):
```
Container App (Managed Identity) → Azure AD
  ↓ (get token)
Azure AD → Container App (JWT token)
  ↓
Container App → Foundry Endpoint
  Header: Authorization: Bearer <token>
```

### Secrets Management

1. **API Keys**: Azure Key Vault or Container Apps secrets
2. **Application Insights Connection String**: Environment variable (not secret)
3. **No Hardcoded Secrets**: All secrets via environment or Key Vault references

### Network Security

- **TLS 1.2+**: All HTTPS traffic encrypted
- **No Public Storage**: No Azure Storage accounts exposed
- **Least Privilege**: Container runs as non-root user

## Scalability & Performance

### Scaling Strategy

| Load Pattern | Scaling Approach |
|--------------|------------------|
| **Dev/Test** | Scale to zero (0 replicas when idle) |
| **Production** | Min 1, max 10 replicas |
| **Burst** | Auto-scale on HTTP concurrency (10 requests/replica) |

### Performance Optimizations

1. **Parallel Subagent Execution**: Security + Cost analysis run concurrently
2. **Stateless Design**: No session affinity required, any replica can handle any request
3. **Compiled TypeScript**: No JIT compilation overhead
4. **Minimal Docker Image**: Alpine-based, ~200 MB

### Bottlenecks

| Component | Potential Bottleneck | Mitigation |
|-----------|---------------------|------------|
| **Foundry API Latency** | 5-15 seconds per analysis | Cache common queries, use streaming |
| **Container Cold Start** | ~5 seconds from scale-to-zero | Set min replicas = 1 for prod |
| **Large Resource Sets** | 200K context limit | Chunk analysis or use Claude Opus |

## Cost Analysis

### Monthly Cost Breakdown (1000 analyses/month)

| Component | Cost | Notes |
|-----------|------|-------|
| **Azure Container Apps** | $15 | 0.5 CPU, 1.0 GB, scale-to-zero enabled |
| **Foundry API Calls** | $300 | Estimated at $0.30/analysis (4K input + 2K output tokens) |
| **Application Insights** | $5 | Basic tier, minimal telemetry volume |
| **Azure Container Registry** | $5 | Basic tier |
| **Total** | **$325/month** | |

**Cost Optimization**:
- Use Claude Haiku for simpler analyses ($150 vs. $300 API cost)
- Scale to zero for dev/test ($0 when idle)
- Batch analyses to reduce per-request overhead

## Limitations & Tradeoffs

### Current Limitations

1. **Static Analysis Only**: Analyzes exported JSON, not live Azure subscriptions
2. **Simplified Evaluation**: Uses basic evaluation logic, not full Foundry Evaluation SDK
3. **API Key Authentication**: Managed Identity support pending Foundry GA
4. **Regional Availability**: Foundry limited to East US2, Sweden Central (as of Jan 2025)

### Architectural Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| **TypeScript vs. Python** | TypeScript chosen for broader ecosystem, but Python has stronger data science libs |
| **Container Apps vs. AKS** | Simpler deployment, but less control over orchestration |
| **Parallel Subagents** | Faster analysis, but higher token cost (multiple API calls) |
| **Stateless Design** | Easy to scale, but no cross-request learning |

## Extension Points

### How to Add a New Subagent

1. Create `.claude/agents/compliance-checker.md` with:
   - Purpose statement
   - Analysis framework
   - Output format specification

2. Update `CLAUDE.md` to reference new subagent:
   ```markdown
   - **Compliance Checker**: Delegate regulatory compliance validation
   ```

3. Add method to `main-agent.ts`:
   ```typescript
   private async analyzeComplianceWithTracing(summary: string): Promise<any[]> {
     // Load compliance-checker.md instructions
     // Call Foundry Claude
     // Parse response
   }
   ```

4. Test with evaluation dataset

**No SDK code changes needed**—agent behavior is markdown!

### How to Add a New Skill

1. Create `.claude/skills/azure-landing-zones/SKILL.md` with domain knowledge
2. Skills are auto-discovered from `.claude/skills/` directory
3. Reference in agent prompts: "Use Azure Landing Zones skill for guidance"

### How to Integrate Live Azure APIs

Replace static JSON input with Azure Resource Graph queries:

```typescript
// src/integrations/azure-resource-graph.ts
import { ResourceGraphClient } from '@azure/arm-resourcegraph';

export async function queryAzureResources(subscriptionId: string) {
  const client = new ResourceGraphClient(credential);
  const result = await client.resources({
    query: 'Resources | where type =~ "Microsoft.Storage/storageAccounts"'
  });
  return result.data;
}
```

Update `main-agent.ts` to call Azure APIs instead of reading `examples/sample-azure-export.json`.

## References

- [ADR-001: System Architecture](ADR-001-system-architecture.md)
- [Deployment Guide](deployment.md)
- [Demo Guide](demo-guide.md)
- [Positioning](positioning.md)
- [Official References](references.md)
