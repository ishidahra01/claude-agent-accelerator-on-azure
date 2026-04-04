# Demo Guide: Azure Resource Analysis Agent

This guide walks through a complete demonstration of the Azure Resource Analysis Agent, showcasing Claude Agent SDK capabilities with Microsoft Foundry integration.

## Demo Flow (15 minutes)

### Part 1: The Problem (2 minutes)

**Scenario**: Your organization has Azure infrastructure that has grown organically. You need to:
- Identify security vulnerabilities before they're exploited
- Find cost-saving opportunities without degrading service
- Validate alignment with Azure best practices

**Traditional Approach Challenges**:
- Manual review is time-consuming and error-prone
- Siloed teams (security, FinOps, architecture) work independently
- Findings lack actionable remediation steps
- No systematic tracking of technical debt

**Agentic Approach**: Use Claude Agent SDK to orchestrate autonomous, multi-domain analysis.

---

### Part 2: The Solution (3 minutes)

**What Makes This Agentic?**

1. **Autonomous Task Decomposition**:
   - Main agent reads the resource export
   - Automatically delegates to Security Analyzer and Cost Optimizer subagents
   - Synthesizes results without manual orchestration

2. **Domain Expertise via Skills**:
   - Azure Well-Architected Framework skill provides best practice knowledge
   - Subagents reference specific compliance frameworks (CIS Azure Benchmarks)

3. **Tool Usage**:
   - Agents use Read, Grep, JSON parsing autonomously
   - No explicit tool-calling code needed

**Architecture**:
```
User Request → Main Agent (CLAUDE.md)
                ├─→ Security Analyzer Subagent → Finds vulnerabilities
                └─→ Cost Optimizer Subagent → Identifies savings
                      ↓
              Synthesized Report with Prioritized Actions
```

---

### Part 3: Live Demo (7 minutes)

#### Step 1: Show the Input

**File**: `examples/sample-azure-export.json`

Highlight intentionally misconfigured resources:
```json
{
  "name": "proddata001",
  "type": "Microsoft.Storage/storageAccounts",
  "properties": {
    "allowBlobPublicAccess": true,   // ← Security risk!
    "networkAcls": {
      "defaultAction": "Allow"        // ← No firewall!
    }
  }
}
```

```json
{
  "name": "dev-webserver-01",
  "properties": {
    "hardwareProfile": {
      "vmSize": "Standard_B2s"        // ← Oversized for dev
    }
  }
}
```

#### Step 2: Run the Agent

```bash
npm run dev
```

**What Happens**:
1. Agent loads `CLAUDE.md` instructions
2. Reads `sample-azure-export.json`
3. Delegates to Security Analyzer subagent
4. Delegates to Cost Optimizer subagent
5. Synthesizes findings into report

#### Step 3: Review the Output

**Security Findings**:
```json
{
  "severity": "Critical",
  "resource": "Storage Account: proddata001",
  "finding": "Storage account allows public blob access with no firewall restrictions",
  "threat": "Sensitive data may be accessible to unauthorized parties",
  "remediation": "1. Set 'allowBlobPublicAccess' to false\n2. Configure firewall to allow only specific VNets",
  "effort": "Low",
  "compliance": ["CIS Azure 3.8", "ASB ST-2"],
  "priority": 10
}
```

**Cost Optimizations**:
```json
{
  "resource": "VM: dev-webserver-01 (Standard_B2s)",
  "currentCost": "$30.37/month",
  "recommendation": "Downsize to Standard_B1s (1 vCPU, 1 GB RAM)",
  "savings": "$15.18/month | $182/year",
  "savingsPercentage": "50%",
  "effort": "Low (5 minutes)",
  "priority": 9
}
```

**Highlight**:
- Specific Azure CLI commands provided
- Compliance frameworks referenced
- Concrete savings calculations
- Risk and effort assessments

---

### Part 4: Why Claude on Azure? (3 minutes)

#### Claude Agent SDK Benefits

**Show the Code** (`src/agent/main-agent.ts`):
```typescript
// No manual tool orchestration needed!
// Agent automatically uses subagents based on CLAUDE.md instructions
const securityFindings = await this.analyzeSecurityWithTracing(resourcesSummary);
const costOptimizations = await this.analyzeCostWithTracing(resourcesSummary);
```

**Show CLAUDE.md**:
```markdown
## Subagent Coordination
- **Security Analyzer**: Delegate all security-related analysis
- **Cost Optimizer**: Delegate cost and resource efficiency analysis

Execute subagents in parallel when possible for faster analysis.
```

**Agent automatically**:
- Understands when to use subagents
- Parses JSON responses
- Synthesizes findings

#### Microsoft Foundry Integration

**Show Foundry Client** (`src/models/foundry-client.ts`):
```typescript
this.client = new Anthropic({
  apiKey: config.apiKey,
  baseURL: config.baseUrl,  // Azure Foundry endpoint
});
```

**Benefits**:
- Single Azure bill
- Azure compliance and data residency
- Integration with Azure Monitor

**Show Tracing** (`src/observability/tracing.ts`):
```typescript
useAzureMonitor({
  azureMonitorExporterOptions: {
    connectionString,
  },
});
```

All agent interactions flow to Application Insights.

#### Azure Container Apps Deployment

**Show Dockerfile**:
- Multi-stage build for minimal image size
- Non-root user for security
- Health checks

**Show Deployment** (`infrastructure/deploy-aca.sh`):
```bash
az containerapp create \
  --name azure-resource-analyzer \
  --environment claude-agent-env \
  --secrets foundry-api-key="${FOUNDRY_API_KEY}" \
  --cpu 0.5 --memory 1.0Gi \
  --min-replicas 1 --max-replicas 3
```

**Benefits**:
- Serverless: pay only for active usage
- Auto-scaling: handle variable load
- Built-in HTTPS ingress

---

### Part 5: Q&A Scenarios

#### Q: "Can this analyze live Azure subscriptions?"

**A**: This sample analyzes static JSON exports. For production, integrate with Azure Resource Graph API to fetch live resource configurations. The agent architecture remains the same—just change the input source.

**Code Change**:
```typescript
// Instead of reading JSON file:
const resources = JSON.parse(readFileSync('export.json'));

// Call Azure Resource Graph:
const resources = await azureResourceGraphClient.query(
  'Resources | where type =~ "Microsoft.Compute/virtualMachines"'
);
```

#### Q: "How do you handle sensitive data?"

**A**:
- API keys in Azure Key Vault (not in code)
- Foundry deployment respects Anthropic's zero data retention policy
- All data stays in Azure regions with compliance certifications

**Show**:
```bash
# Secrets reference in Container Apps
--secrets foundry-api-key="${FOUNDRY_API_KEY}"
--env-vars FOUNDRY_API_KEY=secretref:foundry-api-key
```

#### Q: "How accurate are the recommendations?"

**A**: Evaluation framework measures:
- **Groundedness**: Are findings based on actual resources?
- **Actionability**: Do recommendations have specific remediation steps?
- **Safety**: No destructive changes without warnings

**Show Evaluation** (`src/observability/evaluation.ts`):
```typescript
export async function evaluateAnalysisReport(report, resources) {
  // Check if findings reference actual resource names
  // Check if remediation steps are detailed
  // Check for unsafe recommendations
}
```

---

## Demo Variations

### For Security Teams

Focus on:
- CIS Azure Benchmarks compliance
- Threat vectors identified
- Remediation automation potential

Run:
```bash
# Security-only analysis
npm run dev -- --scope security
```

### For FinOps Teams

Focus on:
- Concrete savings calculations
- Quick wins (unattached disks, stopped VMs)
- Reserved instance recommendations

Show `cost-optimizer.md` subagent instructions.

### For Architects

Focus on:
- Azure Well-Architected Framework alignment
- Multi-pillar analysis (reliability, security, cost, ops, performance)
- Technical debt tracking

Show `.claude/skills/azure-well-architected/SKILL.md`.

---

## Extending the Demo

### Add a New Subagent

1. Create `.claude/agents/compliance-checker.md`:
```markdown
## Purpose
Check resources against HIPAA/PCI/SOC2 requirements

## Analysis Framework
- Check encryption at rest
- Verify audit logging
- Validate access controls
```

2. Update `CLAUDE.md`:
```markdown
- **Compliance Checker**: Delegate regulatory compliance validation
```

3. Add to `main-agent.ts`:
```typescript
const complianceFindings = await this.analyzeComplianceWithTracing(resourcesSummary);
```

No SDK code changes needed—agent behavior is in markdown!

### Add a New Skill

1. Create `.claude/skills/azure-landing-zones/SKILL.md` with CAF patterns
2. Agent automatically discovers it in the skills directory
3. Reference in analysis prompts

---

## Demo Success Metrics

Successful demo if audience understands:

✅ **Claude Agent SDK = More than Chat**: Autonomous, multi-step workflows
✅ **Skills + Subagents = Composability**: Reusable expertise, natural delegation
✅ **Azure Foundry = Enterprise Readiness**: Compliance, billing, observability
✅ **Container Apps = Simple Deployment**: Serverless, auto-scaling, cost-effective

---

## Next Steps for Audience

1. **Try it locally**: Clone repo, run with Anthropic API key (no Azure needed)
2. **Deploy to Azure**: Follow deployment guide
3. **Customize for your domain**: Replace Azure analysis with your use case
4. **Schedule a deeper workshop**: Hands-on with real customer data

---

## Troubleshooting Demo Issues

### Agent returns empty findings
- Check that `examples/sample-azure-export.json` loaded correctly
- Verify Foundry API key is valid
- Increase `maxTokens` in `foundry-client.ts` if truncated

### Deployment fails
- Ensure Azure region supports Foundry (East US2, Sweden Central)
- Verify ACR name is globally unique
- Check subscription quotas for Container Apps

### Tracing not showing in Application Insights
- Verify `APPLICATIONINSIGHTS_CONNECTION_STRING` is set
- Enable tracing: `ENABLE_TRACING=true`
- Wait 2-3 minutes for data ingestion

---

**Demo Duration**: 15 minutes
**Audience**: Technical decision makers, solution architects, developers
**Goal**: Show concrete value of Claude Agent SDK on Azure, not just feature list
