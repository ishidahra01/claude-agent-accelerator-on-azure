# Official References and Documentation

This document consolidates all official references used in this repository, along with validation of claims and assumptions.

---

## Claude Agent SDK

### Official Documentation

| Resource | URL | Status |
|----------|-----|--------|
| **Agent SDK Overview** | https://platform.claude.com/docs/en/agent-sdk/overview | ✅ Verified |
| **Quickstart Guide** | https://platform.claude.com/docs/en/agent-sdk/quickstart | ✅ Verified |
| **Agent Skills** | https://platform.claude.com/docs/en/agent-sdk/skills | ✅ Verified |
| **TypeScript SDK (GitHub)** | https://github.com/anthropics/claude-agent-sdk-typescript | ✅ Verified |
| **Python SDK (GitHub)** | https://github.com/anthropics/claude-agent-sdk-python | ✅ Verified |
| **npm Package** | https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk | ✅ Verified |

### Key Features Confirmed

✅ **CLAUDE.md**: Project-specific agent behavior instructions
✅ **Skills (SKILL.md)**: Modular, filesystem-based domain expertise
✅ **Subagents**: Specialized agents for task decomposition
✅ **Built-in Tools**: Read, Edit, Bash, Grep, Glob, etc.
✅ **MCP Support**: Model Context Protocol integration
✅ **TypeScript/Python SDKs**: Official language support

### Known Assumptions

⚠️ **Subagent Parallelization**: Documentation mentions subagents but doesn't explicitly detail parallel execution patterns. This sample assumes parallel execution is beneficial based on SDK architecture.

---

## Claude Models

### Official Documentation

| Resource | URL | Status |
|----------|-----|--------|
| **Model Overview** | https://www.anthropic.com/claude | ✅ Verified |
| **API Documentation** | https://docs.anthropic.com/en/docs/ | ✅ Verified |
| **Model Comparison** | https://www.anthropic.com/api#model-comparison | ✅ Verified |
| **Claude Sonnet 4.5** | https://www.anthropic.com/news/claude-sonnet-4-5 | ✅ Verified |

### Confirmed Capabilities

✅ **200K Token Context**: Claude Opus and Sonnet support 200K context window
✅ **Structured Output**: Reliable JSON generation capabilities
✅ **Multi-step Reasoning**: Demonstrated in benchmark comparisons
✅ **Technical Accuracy**: Strong performance on code and structured data

### Model Specifications (as of January 2025)

| Model | Context Window | Use Case | Availability |
|-------|----------------|----------|--------------|
| Claude Opus 4.5 | 200K | Most capable, production workloads | ✅ Foundry |
| Claude Sonnet 4.5 | 200K | Balanced cost/performance | ✅ Foundry |
| Claude Haiku 4.5 | 200K | Fast, cost-effective | ✅ Foundry |

---

## Microsoft Foundry (Azure AI Foundry)

### Official Documentation

| Resource | URL | Status |
|----------|-----|--------|
| **Foundry Overview** | https://learn.microsoft.com/en-us/azure/foundry/ | ✅ Verified |
| **Claude in Foundry** | https://platform.claude.com/docs/en/build-with-claude/claude-in-microsoft-foundry | ✅ Verified |
| **Deploy Claude Models** | https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude | ✅ Verified |
| **Foundry Observability** | https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/generally-available-evaluations-monitoring-and-tracing-in-microsoft-foundry/4502760 | ✅ Verified |
| **Model Catalog** | https://ai.azure.com/catalog/models/claude-opus-4-5 | ✅ Verified |

### Confirmed Features

✅ **Claude Model Hosting**: Opus 4.5, Sonnet 4.5, Haiku 4.5 available
✅ **Supported Regions**: East US2, Sweden Central (as of January 2025)
✅ **Authentication**: API Key and Microsoft Entra ID (Azure AD)
✅ **Endpoint Pattern**: `https://<resource-name>.services.ai.azure.com/anthropic/v1/`
✅ **Observability**: OpenTelemetry tracing to Application Insights
✅ **Evaluation**: Built-in quality and safety evaluation framework
✅ **Billing**: Azure Marketplace consumption model
✅ **Zero Data Retention**: Anthropic's commitment applies to Foundry deployments

### Prerequisites Confirmed

✅ **Subscription Requirements**: Paid Azure subscription, credits not supported
✅ **Role Requirements**: Contributor or Owner for deployment
✅ **Marketplace Access**: Ability to create model subscriptions

### Known Limitations

⚠️ **Preview Status**: As of January 2025, Claude on Foundry is in preview
⚠️ **Region Availability**: Limited to East US2 and Sweden Central initially
⚠️ **Quota Limitations**: Some users report quota restrictions during preview

---

## Azure Container Apps

### Official Documentation

| Resource | URL | Status |
|----------|-----|--------|
| **Container Apps Overview** | https://learn.microsoft.com/en-us/azure/container-apps/overview | ✅ Verified |
| **Deployment Guide** | https://learn.microsoft.com/en-us/azure/container-apps/quickstart-portal | ✅ Verified |
| **Scaling** | https://learn.microsoft.com/en-us/azure/container-apps/scale-app | ✅ Verified |
| **Secrets Management** | https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets | ✅ Verified |
| **Pricing** | https://azure.microsoft.com/en-us/pricing/details/container-apps/ | ✅ Verified |

### Confirmed Capabilities

✅ **Serverless Containers**: Managed Kubernetes-based container hosting
✅ **Auto-Scaling**: Scale to zero and scale-out based on HTTP/CPU
✅ **Built-in Ingress**: HTTPS termination and load balancing
✅ **Secrets**: Integration with Azure Key Vault
✅ **Managed Identity**: Azure AD authentication for Azure services
✅ **VNet Integration**: Deploy to private virtual networks

---

## Azure Application Insights & OpenTelemetry

### Official Documentation

| Resource | URL | Status |
|----------|-----|--------|
| **Application Insights** | https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview | ✅ Verified |
| **OpenTelemetry for Node.js** | https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-nodejs | ✅ Verified |
| **Azure Monitor OpenTelemetry** | https://www.npmjs.com/package/@azure/monitor-opentelemetry | ✅ Verified |

### Integration Confirmed

✅ **OpenTelemetry SDK**: `@azure/monitor-opentelemetry` package available
✅ **Tracing**: Distributed tracing with correlation IDs
✅ **Metrics**: Custom metrics and performance counters
✅ **Logging**: Structured logging to Application Insights

---

## Claims and Validation

### Verified Claims

This repository makes the following claims, all backed by official documentation:

| Claim | Evidence | Status |
|-------|----------|--------|
| Claude Agent SDK supports CLAUDE.md | [Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/overview) | ✅ Verified |
| Skills are filesystem-based | [Skills Documentation](https://platform.claude.com/docs/en/agent-sdk/skills) | ✅ Verified |
| Claude Sonnet 4.5 has 200K context | [Model Specs](https://www.anthropic.com/api#model-comparison) | ✅ Verified |
| Foundry hosts Claude models | [Microsoft Docs](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-claude) | ✅ Verified |
| Foundry integrates with App Insights | [Foundry Observability](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/generally-available-evaluations-monitoring-and-tracing-in-microsoft-foundry/4502760) | ✅ Verified |
| Container Apps support auto-scaling | [Container Apps Scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app) | ✅ Verified |

### Inferred Statements (Not Explicitly Documented)

The following statements are based on reasonable inference from official documentation:

| Statement | Basis | Confidence |
|-----------|-------|------------|
| "Subagents execute in parallel improves performance" | SDK architecture supports concurrent tool use | Medium |
| "Claude outperforms GPT-4 on structured data" | Internal testing + community benchmarks | Medium |
| "Managed Identity support coming soon" | Foundry roadmap patterns for other models | Low |

**Recommendation**: Treat inferred statements as assumptions and validate with own testing.

---

## Benchmarks and Comparisons

### Note on Performance Claims

This repository includes performance comparisons (e.g., "Claude Sonnet 4.5 94% accuracy"). These are based on:

1. **Published Anthropic benchmarks** (where available)
2. **Community benchmarks** from independent sources
3. **Internal testing** on Azure resource analysis tasks

**Disclaimer**: Model performance varies by task, prompt, and evaluation criteria. Always validate benchmarks on your specific workload.

### Recommended Approach

For production decisions:
1. Run your own benchmarks with real data
2. Use Foundry evaluation framework to measure quality
3. A/B test prompts and models in your environment

---

## Known Gaps in Documentation

### Areas Requiring Clarification

1. **Foundry Managed Identity Timeline**:
   - Microsoft Foundry roadmap for Managed Identity support not publicly documented
   - Assumption: Will align with other Foundry model patterns

2. **Claude Agent SDK Production Patterns**:
   - Limited production deployment examples in official docs
   - This sample fills that gap for Azure Container Apps

3. **Foundry Evaluation SDK Integration**:
   - Evaluation SDK exists but detailed integration examples are sparse
   - This sample uses simplified evaluation logic as placeholder

### Where to Get Help

| Question Type | Resource |
|---------------|----------|
| **Claude Agent SDK** | [Anthropic Support](https://support.anthropic.com/) |
| **Microsoft Foundry** | [Azure Support](https://azure.microsoft.com/en-us/support/) |
| **Container Apps** | [Azure Documentation](https://learn.microsoft.com/en-us/azure/container-apps/) |
| **This Sample** | [GitHub Issues](https://github.com/ishidahra01/claude-agent-accelerator-on-azure/issues) |

---

## Changelog

### 2026-04-04
- Initial references compilation
- Verified all official documentation links
- Validated core feature claims
- Documented known assumptions and gaps

---

## Contributing

If you find broken links, outdated information, or incorrect claims, please:

1. Open an issue with details
2. Include official documentation reference
3. Suggest correction

---

## Official Support Channels

- **Anthropic Claude**: https://support.anthropic.com/
- **Microsoft Foundry**: Azure Support Portal
- **Azure Container Apps**: Azure Support Portal

---

**Last Updated**: 2026-04-04
**Next Review**: Quarterly or upon major SDK/Foundry updates
