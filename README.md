# Claude Agent SDK on Azure / Microsoft Foundry

A reference implementation demonstrating **Claude Agent SDK** deployed on **Azure Container Apps** with **Microsoft Foundry**-hosted Claude models. This sample showcases enterprise-grade agentic AI workflows with Azure-native observability, deployment, and governance.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This repository provides a production-ready sample of an **Azure Resource Analysis Agent** that:
- Uses **Claude Agent SDK** for autonomous multi-step reasoning
- Deploys specialized **subagents** for security and cost analysis
- Leverages **domain-specific skills** (Azure Well-Architected Framework)
- Runs Claude models via **Microsoft Foundry** for enterprise readiness
- Deploys on **Azure Container Apps** for scalable, serverless execution
- Integrates with **Azure Application Insights** for tracing and evaluation

### What This Sample Does

The Azure Resource Analysis Agent analyzes Azure infrastructure configurations and provides:
- **Security vulnerability identification** with remediation steps
- **Cost optimization recommendations** with savings calculations
- **Architecture best practice validation** against Azure Well-Architected Framework

**Example**: Given an Azure subscription export (ARM templates, resource configurations), the agent:
1. Decomposes the analysis into security, cost, and architecture domains
2. Executes specialized subagents in parallel for deep domain analysis
3. Synthesizes findings into a prioritized, actionable report
4. Provides specific Azure CLI commands and configuration changes

---

## Why Claude Agent SDK?

### Purpose-Built for Agentic Workflows

Unlike simple chat interfaces, **Claude Agent SDK** provides:

| Feature | Value |
|---------|-------|
| **Autonomous Execution** | Agents can read files, execute commands, search data—without manual tool orchestration |
| **Built-in Tools** | Read, Edit, Bash, Grep, Glob come out-of-the-box |
| **Skills System** | Modular, reusable domain expertise (see `.claude/skills/`) |
| **Subagents** | Natural task decomposition with specialized agents (see `.claude/agents/`) |
| **Project Memory** | CLAUDE.md provides persistent behavior and context |
| **Developer Experience** | Simple TypeScript/Python API, extensive documentation |

### This Sample Demonstrates

- ✅ **CLAUDE.md**: Agent behavior and domain expertise in `.claude/CLAUDE.md`
- ✅ **Custom Skills**: Azure Well-Architected Framework knowledge in `src/skills/azure-waf.ts` (using SDK `tool()` function)
- ✅ **Subagents**: Security Analyzer and Cost Optimizer configured via SDK `agents` option
- ✅ **SDK Integration**: Uses `query()` API from `@anthropic-ai/claude-agent-sdk` (v0.2.92)
- ✅ **Real Agentic Work**: Multi-step analysis with autonomous tool usage, not just Q&A

---

## Why Claude Models?

### Technical Differentiation

| Capability | Why It Matters for This Sample |
|------------|--------------------------------|
| **200K Token Context** | Analyze large Azure deployments (100+ resources) in a single request |
| **Technical Accuracy** | Superior performance on structured data (JSON configs, ARM templates) |
| **Multi-Step Reasoning** | Handles complex analysis workflows (security + cost + architecture) |
| **Structured Output** | Reliable JSON generation for programmatic consumption |
| **Low Hallucination** | Critical for infrastructure recommendations—errors are costly |

### Real-World Impact

- **Accuracy**: Claude correctly parses complex Azure resource schemas and identifies subtle configuration issues
- **Completeness**: Maintains context across multiple analysis domains without losing details
- **Actionability**: Generates specific, executable Azure CLI commands—not generic advice

---

## Why Claude on Azure / Microsoft Foundry?

### Enterprise Readiness

| Azure Benefit | Business Value |
|---------------|----------------|
| **Compliance & Governance** | Claude runs in Azure regions with data residency guarantees |
| **Unified Billing** | Single Azure invoice, consumption-based pricing, no separate vendor |
| **Native Integration** | Seamless with Azure Key Vault, Managed Identity, Monitor, VNets |
| **Zero Data Retention** | Anthropic's commitment applies to Foundry deployments |
| **Enterprise Support** | Azure support SLAs, no separate vendor contracts |

### Observability & Quality

Microsoft Foundry provides:
- **Integrated Tracing**: OpenTelemetry → Application Insights (see `src/observability/tracing.ts`)
- **Continuous Evaluation**: Quality/safety checks in production (see `src/observability/evaluation.ts`)
- **Lifecycle Visibility**: Monitor agent behavior across development, CI/CD, and production

### Deployment Simplicity

Azure Container Apps offers:
- **Serverless Containers**: No Kubernetes complexity, auto-scaling
- **HTTPS Ingress**: Built-in TLS certificates and load balancing
- **Secrets Management**: Integration with Key Vault
- **Cost Efficiency**: Pay only for active usage

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Container Apps                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Claude Agent SDK Application                  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Main Agent (CLAUDE.md)                        │  │  │
│  │  │    ├─ Subagent: Security Analyzer              │  │  │
│  │  │    └─ Subagent: Cost Optimizer                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Skill: Azure Well-Architected Framework       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
┌─────────────────────┐   ┌─────────────────────────────────┐
│  Microsoft Foundry  │   │  Azure Observability            │
│  Claude Sonnet 4.5  │   │  Application Insights + Evals   │
└─────────────────────┘   └─────────────────────────────────┘
```

**For detailed architecture**: See [docs/ADR-001-system-architecture.md](docs/ADR-001-system-architecture.md)

---

## Features Demonstrated

### 1. Claude Agent SDK Integration
- **SDK Version**: `@anthropic-ai/claude-agent-sdk` v0.2.92 (latest official release)
- **Agent Orchestration**: Uses `query()` API for autonomous execution loops
- **Custom Skills**: Azure Well-Architected Framework tools defined with SDK `tool()` function and Zod schemas (`src/skills/azure-waf.ts`)
- **Subagents**: Security Analyzer and Cost Optimizer configured via SDK `agents` option in `MainAgent` class
- **System Prompts**: CLAUDE.md and subagent instructions loaded from `.claude/` directory
- **Autonomous Tool Usage**: Agent can call WAF tools, delegate to subagents, and synthesize results

### 2. Microsoft Foundry Integration
- Claude model hosted on Azure-native endpoints
- Authentication via Foundry API key (compatible with SDK's `apiKey` and `baseURL` options)
- Optimized for Azure region latency
- Uses required `anthropic-version` header (`2023-06-01`) for Foundry endpoints

### 3. Azure Container Apps Deployment
- Dockerfile with multi-stage build
- Bash and Bicep deployment scripts
- Environment variable and secrets management
- Health checks and auto-scaling

### 4. Observability
- OpenTelemetry tracing → Azure Application Insights
- Evaluation framework for quality/safety metrics
- Structured logging for debugging

---

## Getting Started

### Prerequisites

1. **Azure Subscription** with:
   - Microsoft Foundry access (preview, regions: East US2 or Sweden Central)
   - Claude Sonnet 4.5 deployed in Foundry project
   - Contributor/Owner role in resource group

2. **Local Development**:
   - Node.js 18+ and npm
   - Docker (for containerization)
   - Azure CLI (for deployment)

3. **Foundry Setup**:
   - Get Foundry API key or configure Entra ID auth
   - Note your Foundry base URL: `https://<resource-name>.services.ai.azure.com/anthropic/v1`

### Local Development

1. **Clone and Install**:
   ```bash
   git clone https://github.com/ishidahra01/claude-agent-accelerator-on-azure.git
   cd claude-agent-accelerator-on-azure
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.sample .env
   # Edit .env with your Foundry credentials
   ```

   Required variables:
   ```env
   FOUNDRY_API_KEY=your_foundry_api_key_here
   FOUNDRY_BASE_URL=https://your-resource-name.services.ai.azure.com/anthropic/v1
   FOUNDRY_MODEL=claude-sonnet-4-5
   ANTHROPIC_VERSION=2023-06-01
   ```

3. **Run the Agent**:
   ```bash
   npm run dev
   ```

   This analyzes the sample Azure export in `examples/sample-azure-export.json`.

### Deploy to Azure Container Apps

1. **Build Container**:
   ```bash
   docker build -t azure-resource-analyzer .
   ```

2. **Deploy** (using the provided script):
   ```bash
   chmod +x infrastructure/deploy-aca.sh

   export FOUNDRY_API_KEY="your_key"
   export FOUNDRY_BASE_URL="https://your-resource.services.ai.azure.com/anthropic/v1"

   ./infrastructure/deploy-aca.sh
   ```

   Or deploy with Bicep:
   ```bash
   az deployment group create \
     --resource-group claude-agent-rg \
     --template-file infrastructure/bicep/main.bicep \
     --parameters \
       foundryApiKey="your_key" \
       foundryBaseUrl="https://your-resource.services.ai.azure.com/anthropic/v1"
   ```

3. **Access Logs**:
   ```bash
   az containerapp logs show \
     --name azure-resource-analyzer \
     --resource-group claude-agent-rg \
     --follow
   ```

---

## Demo Guide

### Sample Analysis

The repository includes `examples/sample-azure-export.json` with intentionally misconfigured resources:
- Storage account with public access enabled
- Web app without HTTPS enforcement
- Oversized dev VM running 24/7
- Unattached premium disks

**Run the analysis**:
```bash
npm run dev
```

**Expected Output**:
```
=== ANALYSIS REPORT ===
{
  "summary": {
    "resourcesAnalyzed": 5,
    "securityFindings": 4,
    "costSavingsOpportunities": 3
  },
  "security": [
    {
      "severity": "Critical",
      "resource": "Storage Account: proddata001",
      "finding": "Public blob access enabled...",
      "remediation": "az storage account update --name proddata001 --default-action Deny"
    }
  ],
  "cost": [
    {
      "resource": "VM: dev-webserver-01",
      "savings": "$15.18/month | $182/year",
      "recommendation": "Downsize to Standard_B1s..."
    }
  ]
}
```

For a full demo script: See [docs/demo-guide.md](docs/demo-guide.md)

---

## Code Structure

### Key Implementation Files

```
src/
├── agent/
│   └── main-agent.ts          # Main agent using Claude Agent SDK query() API
├── skills/
│   └── azure-waf.ts           # Azure Well-Architected Framework tools (SDK tool() function)
├── observability/
│   ├── tracing.ts             # OpenTelemetry integration
│   └── evaluation.ts          # Quality/safety evaluation
├── types/
│   └── index.ts               # TypeScript type definitions
└── index.ts                   # Entry point

.claude/
├── CLAUDE.md                  # Main agent instructions
└── agents/
    ├── security-analyzer.md   # Security subagent instructions
    └── cost-optimizer.md      # Cost subagent instructions
```

### How It Works

**1. Main Agent Setup** (`src/agent/main-agent.ts`):
```typescript
import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { azureWafSkills } from '../skills/azure-waf.js';

// Configure agent with skills and subagents
const agentOptions: Options = {
  apiKey: foundryApiKey,
  baseURL: foundryBaseUrl,
  model: 'claude-sonnet-4-5',
  systemPrompt: claudeMd,          // From .claude/CLAUDE.md
  tools: azureWafSkills,            // Custom WAF tools
  agents: {
    'security-analyzer': {
      systemPrompt: securityAnalyzerMd,
      tools: azureWafSkills,
    },
    'cost-optimizer': {
      systemPrompt: costOptimizerMd,
      tools: azureWafSkills,
    },
  },
};
```

**2. Custom Skills** (`src/skills/azure-waf.ts`):
```typescript
import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const getWafGuidanceTool = tool(
  'get_waf_guidance',
  'Get Azure Well-Architected Framework best practices',
  {
    pillar: z.enum(['security', 'cost', 'reliability', 'performance', 'operational']),
    context: z.string().optional(),
  },
  async ({ pillar, context }) => {
    // Return WAF guidance based on pillar
    return { content: [{ type: 'text', text: guidance }] };
  }
);
```

**3. Agent Execution** (`src/agent/main-agent.ts`):
```typescript
const iterator = query({
  prompt: analysisPrompt,
  options: agentOptions,
});

for await (const msg of iterator) {
  if (msg.type === 'assistant') {
    // Handle agent responses
  }
  if (msg.type === 'agent_start') {
    console.log(`Subagent Started: ${msg.agentName}`);
  }
}
```

---

## Documentation

- **[Architecture Decision Record](docs/ADR-001-system-architecture.md)**: System design and component responsibilities
- **[Demo Guide](docs/demo-guide.md)**: Step-by-step walkthrough
- **[Positioning](docs/positioning.md)**: Why Claude? Why Azure? Customer value propositions
- **[Deployment Guide](docs/deployment.md)**: Production deployment patterns
- **[References](docs/references.md)**: Official documentation links

---

## Limitations & Roadmap

### Current Limitations

- **Foundry Access**: Requires preview access and specific regions (East US2, Sweden Central)
- **Authentication**: Currently uses API keys; Managed Identity support is a future enhancement
- **Analysis Scope**: Demonstrates static resource analysis; live Azure API integration is a future feature
- **Evaluation**: Uses simplified evaluation logic; production integration with Foundry Evaluation SDK is planned

### Future Enhancements

- [ ] Managed Identity authentication (eliminate API keys)
- [ ] Live Azure subscription analysis via Azure Resource Graph API
- [ ] Web UI for interactive analysis
- [ ] RAG integration with Azure AI Search for compliance policies
- [ ] Advanced evaluation dashboards in Azure Workbooks
- [ ] Multi-subscription batch analysis

---

## Use Cases

This sample is designed for:

| Audience | Use Case |
|----------|----------|
| **Presales / Solution Architects** | Demo Claude Agent SDK + Azure value in customer workshops |
| **Developers** | Reference implementation for building production agents on Azure |
| **Technical Decision Makers** | Evaluate Claude vs. other models on Azure with concrete code |
| **Customer Success** | PoC accelerator for Azure + Claude integration |

---

## Contributing

This is a reference sample maintained for demonstration purposes. For questions or feedback, please open an issue.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Official References

- [Claude Agent SDK Documentation](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude in Microsoft Foundry](https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry)
- [Microsoft Foundry Documentation](https://learn.microsoft.com/en-us/azure/foundry/)
- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Microsoft Foundry Observability](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/generally-available-evaluations-monitoring-and-tracing-in-microsoft-foundry/4502760)

---

**Built with Claude Agent SDK • Powered by Microsoft Foundry • Deployed on Azure**
