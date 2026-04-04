# ADR-001: Claude Agent SDK on Azure/Microsoft Foundry - System Architecture

## Status
Accepted

## Context
We need to create a sample application that demonstrates the value of Claude Agent SDK running on Azure infrastructure with Microsoft Foundry-hosted Claude models. This sample should serve as a reference implementation for presales, demos, workshops, and technical validation.

## Decision

### Core Architecture Components

#### 1. Agent Runtime Layer
- **Claude Agent SDK** as the core agent orchestration framework
- **Language**: TypeScript (primary choice for broad ecosystem compatibility)
- **Key SDK Features Demonstrated**:
  - **CLAUDE.md**: Project-specific memory and behavior instructions
  - **Skills (SKILL.md)**: Domain-specific capabilities for Azure resource analysis
  - **Subagents**: Specialized agents for focused task decomposition
  - **Built-in Tools**: Read, Edit, Bash, Grep, Glob for file operations
  - **MCP Support**: Model Context Protocol for extensibility (optional, if useful)

#### 2. Model Layer
- **Provider**: Microsoft Foundry (Azure AI Foundry)
- **Model**: Claude Sonnet 4.5 (primary), with Opus 4.5 option for complex scenarios
- **Authentication**: Microsoft Entra ID (Azure AD) or API key-based
- **Endpoint Pattern**: Azure-native Foundry endpoints
  - Format: `https://<resource-name>.services.ai.azure.com/anthropic/v1/`

#### 3. Deployment Layer
- **Platform**: Azure Container Apps (ACA)
- **Why ACA**:
  - Serverless container execution with auto-scaling
  - Built-in HTTPS ingress and certificate management
  - Native Azure integration (managed identity, Key Vault, etc.)
  - Cost-effective for demo/workshop scenarios
  - Simple deployment model without Kubernetes complexity

#### 4. Observability Layer
- **Tracing**: Azure Application Insights with OpenTelemetry instrumentation
- **Evaluation**: Foundry evaluation SDK for quality/safety metrics
- **Monitoring**: Azure Monitor for operational health
- **Minimum Viable Integration**:
  - Request/response tracing for agent interactions
  - Basic evaluation dataset with quality criteria
  - Dashboard for trace visualization

### Sample Application Scenario

**Selected Scenario**: **Azure Resource Analysis and Recommendation Agent**

This scenario demonstrates:
- **Agentic Value**: Multi-step reasoning over structured and unstructured data
- **Claude Strengths**: Long context, technical accuracy, structured output
- **Azure Integration**: Analysis of Azure resources, cost optimization, security best practices

**User Flow**:
1. User provides Azure subscription info or resource export
2. Main agent analyzes resource configuration using Claude Agent SDK
3. Subagents handle specific domains:
   - **Security Analyzer**: Reviews security configurations, suggests improvements
   - **Cost Optimizer**: Identifies cost-saving opportunities
   - **Architecture Reviewer**: Checks against Azure Well-Architected Framework
4. Skills provide Azure-specific knowledge and templates
5. Agent generates structured report with recommendations

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        User/Client                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Azure Container Apps (Deployment)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Claude Agent SDK Application                  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Main Agent (CLAUDE.md)                        │  │  │
│  │  │    ├─ Subagent: Security Analyzer              │  │  │
│  │  │    ├─ Subagent: Cost Optimizer                 │  │  │
│  │  │    └─ Subagent: Architecture Reviewer          │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Skills                                         │  │  │
│  │  │    ├─ Azure Well-Architected Framework         │  │  │
│  │  │    ├─ Security Best Practices                  │  │  │
│  │  │    └─ Cost Optimization Templates              │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
┌─────────────────────┐   ┌─────────────────────────────────┐
│  Microsoft Foundry  │   │  Azure Observability            │
│  ┌───────────────┐  │   │  ┌───────────────────────────┐  │
│  │ Claude Sonnet │  │   │  │ Application Insights      │  │
│  │     4.5       │  │   │  │ (OpenTelemetry Tracing)   │  │
│  └───────────────┘  │   │  └───────────────────────────┘  │
│  ┌───────────────┐  │   │  ┌───────────────────────────┐  │
│  │ Claude Opus   │  │   │  │ Foundry Evaluation SDK    │  │
│  │     4.5       │  │   │  │ (Quality Metrics)         │  │
│  └───────────────┘  │   │  └───────────────────────────┘  │
└─────────────────────┘   └─────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Main Agent** | Orchestrates analysis workflow, coordinates subagents, generates final report |
| **Security Analyzer Subagent** | Analyzes security configurations, identifies vulnerabilities, suggests remediation |
| **Cost Optimizer Subagent** | Reviews resource sizing, identifies unused resources, calculates savings |
| **Architecture Reviewer Subagent** | Validates against Well-Architected Framework pillars |
| **Azure Skills** | Provides domain knowledge, templates, and best practice guidelines |
| **Foundry Model Layer** | Executes Claude API calls via Azure-native endpoints |
| **Observability Layer** | Captures traces, evaluates quality, monitors operational health |

### Data Flow

1. **Request Ingress**: User submits Azure resource data (JSON export, ARM templates, or subscription ID)
2. **Agent Initialization**: Main agent loads CLAUDE.md, available skills, and subagent definitions
3. **Task Decomposition**: Main agent analyzes request and delegates to appropriate subagents
4. **Parallel Analysis**: Subagents execute domain-specific analysis concurrently
5. **Model Invocation**: Each agent step calls Foundry-hosted Claude via SDK
6. **Trace Collection**: OpenTelemetry captures each model call, tool use, and decision point
7. **Result Synthesis**: Main agent aggregates subagent outputs into structured report
8. **Evaluation**: Foundry evaluator checks output quality (coherence, groundedness, safety)
9. **Response**: Structured recommendations returned to user

### Authentication & Configuration

#### Environment Variables
```
# Foundry Model Configuration
FOUNDRY_API_KEY=<api_key>
FOUNDRY_BASE_URL=https://<resource-name>.services.ai.azure.com/anthropic
FOUNDRY_MODEL=claude-sonnet-4-5

# Application Configuration
PORT=3000
NODE_ENV=production

# Observability Configuration
APPLICATIONINSIGHTS_CONNECTION_STRING=<connection_string>
ENABLE_TRACING=true
ENABLE_EVALUATION=true
```

#### Secrets Management
- API keys stored in **Azure Key Vault**
- Container Apps secrets reference for runtime injection
- Managed Identity for Azure resource access (future enhancement)

### Deployment Prerequisites

1. **Azure Resources**:
   - Azure Container Registry (ACR) for container images
   - Azure Container Apps Environment
   - Microsoft Foundry project with Claude model deployed
   - Application Insights workspace
   - Key Vault for secrets

2. **Development Tools**:
   - Docker for containerization
   - Azure CLI for deployment
   - Node.js 18+ for local development

3. **Foundry Setup**:
   - Contributor/Owner role in Foundry project
   - Claude Sonnet 4.5 deployed in supported region (East US2 or Sweden Central)
   - API key or Entra ID authentication configured

## Repository Structure

```
claude-agent-accelerator-on-azure/
├── .claude/                    # Claude Agent SDK configuration
│   ├── CLAUDE.md              # Main agent behavior and memory
│   ├── skills/                # Custom skills
│   │   ├── azure-well-architected/
│   │   │   ├── SKILL.md
│   │   │   └── templates/
│   │   ├── security-analyzer/
│   │   │   └── SKILL.md
│   │   └── cost-optimizer/
│   │       └── SKILL.md
│   └── agents/                # Subagent definitions
│       ├── security-analyzer.md
│       ├── cost-optimizer.md
│       └── architecture-reviewer.md
├── src/
│   ├── index.ts               # Application entry point
│   ├── agent/
│   │   ├── main-agent.ts      # Main agent orchestration
│   │   ├── subagents.ts       # Subagent initialization
│   │   └── config.ts          # Agent configuration
│   ├── models/
│   │   └── foundry-client.ts  # Foundry Claude API client
│   ├── observability/
│   │   ├── tracing.ts         # OpenTelemetry setup
│   │   └── evaluation.ts      # Foundry evaluation integration
│   └── types/
│       └── index.ts           # TypeScript type definitions
├── infrastructure/
│   ├── Dockerfile             # Container image definition
│   ├── deploy-aca.sh          # ACA deployment script
│   └── bicep/                 # Infrastructure as Code
│       ├── main.bicep
│       └── modules/
├── evaluation/
│   ├── dataset.json           # Evaluation test cases
│   └── criteria.json          # Quality/safety criteria
├── docs/
│   ├── ADR-001-system-architecture.md
│   ├── architecture.md        # Detailed architecture guide
│   ├── deployment.md          # Deployment instructions
│   ├── demo-guide.md          # Demo script
│   └── positioning.md         # Why Claude? Why Azure?
├── examples/
│   └── sample-azure-export.json
├── .env.sample
├── package.json
├── tsconfig.json
└── README.md
```

## Implementation Phases

### Phase 1: Core Agent Application (Issue 2)
- [ ] Set up TypeScript project with Claude Agent SDK
- [ ] Implement Foundry Claude client integration
- [ ] Create CLAUDE.md with agent behavior
- [ ] Implement at least one custom Skill (Azure Well-Architected Framework)
- [ ] Implement at least one Subagent (Security Analyzer)
- [ ] Create local development workflow
- [ ] Test end-to-end agent flow locally

### Phase 2: Azure Container Apps Deployment (Issue 3)
- [ ] Create Dockerfile with multi-stage build
- [ ] Set up health check endpoints
- [ ] Create ACA deployment scripts
- [ ] Document environment variable configuration
- [ ] Test deployment on ACA
- [ ] Document troubleshooting steps

### Phase 3: Foundry Observability Integration (Issue 4)
- [ ] Integrate OpenTelemetry for tracing
- [ ] Configure Application Insights connection
- [ ] Create evaluation dataset and criteria
- [ ] Implement evaluation workflow
- [ ] Create sample traces and dashboards
- [ ] Document observability usage

### Phase 4: Documentation & Positioning (Issues 5 & 6)
- [ ] Write comprehensive README with positioning
- [ ] Create architecture documentation
- [ ] Create demo guide with sample scenarios
- [ ] Create positioning page (Why Claude? Why Azure?)
- [ ] Validate all official references
- [ ] Add references.md with source citations

## Positioning Strategy

### Why Claude Agent SDK?
- **Agentic Framework**: Purpose-built for autonomous agent workflows, not just chat
- **Rich Tool Ecosystem**: Built-in tools for file operations, code execution, web search
- **Skills System**: Modular, reusable domain expertise
- **Subagent Architecture**: Natural task decomposition and parallel execution
- **Developer Experience**: Simple API, TypeScript/Python support, extensive documentation

### Why Claude Models?
- **Extended Context**: 200K token context for analyzing large Azure configurations
- **Technical Accuracy**: Superior performance on technical/structured tasks
- **Structured Output**: Reliable JSON generation for reports and recommendations
- **Multi-step Reasoning**: Handles complex, multi-faceted analysis workflows
- **Safety & Reliability**: Built-in guardrails, low hallucination rates

### Why Claude on Azure / Microsoft Foundry?
- **Enterprise Readiness**: Azure compliance, security, and governance
- **Native Integration**: Seamless with Azure services (Key Vault, Monitor, Identity)
- **Unified Billing**: Single Azure invoice, consumption-based pricing
- **Observability**: Integrated tracing, evaluation, and monitoring
- **Deployment Simplicity**: ACA provides serverless container execution
- **Data Residency**: Models run in Azure regions with data sovereignty guarantees
- **Zero Data Retention**: Anthropic's commitment applies to Foundry deployments

## Future Extension Points

### Advanced Features (Post-MVP)
- Managed Identity authentication (replacing API keys)
- Azure Resource Graph integration for live subscription analysis
- Multi-agent collaboration with message passing
- RAG integration with Azure AI Search for policy documents
- Batch processing for multiple subscription analysis
- Web UI for interactive analysis

### Additional Observability
- Custom dashboards in Azure Workbooks
- Alerting on quality/safety thresholds
- A/B testing framework for prompt optimization
- Cost tracking per analysis run

## Consequences

### Positive
- Clear value proposition for Claude on Azure
- Reusable sample for customer conversations
- Demonstrates real agentic workflow (not just chat)
- Extensible architecture for future enhancements
- Production-ready patterns (observability, deployment)

### Negative
- Requires Foundry access (preview, limited regions)
- Additional complexity vs. direct Anthropic API
- Azure-specific deployment (less portable)

### Neutral
- TypeScript choice (Python alternative could be added)
- Azure resource analysis scenario (domain-specific)

## References
- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude in Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)
- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Microsoft Foundry Observability](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/generally-available-evaluations-monitoring-and-tracing-in-microsoft-foundry/4502760)
