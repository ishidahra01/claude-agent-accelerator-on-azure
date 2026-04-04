# Azure Well-Architected Framework Skill

## Description
This skill provides comprehensive knowledge of the Azure Well-Architected Framework (WAF) and helps analyze Azure deployments against the five pillars: Reliability, Security, Cost Optimization, Operational Excellence, and Performance Efficiency.

## When to Use
Use this skill when:
- Analyzing Azure architecture for best practice alignment
- Reviewing infrastructure designs
- Providing recommendations for architecture improvements
- Assessing technical debt and architecture quality

## Knowledge Base

### 1. Reliability Pillar
**Objective**: Ensure workload availability and recovery from failures

**Key Principles**:
- Design for failure: Assume components will fail
- Use availability zones and regions for redundancy
- Implement health monitoring and automated recovery
- Test disaster recovery regularly

**Common Patterns**:
- Multi-region active-active or active-passive
- Availability Sets and Availability Zones
- Azure Site Recovery for disaster recovery
- Application-level retry logic and circuit breakers

**Anti-patterns to Detect**:
- Single region deployment for critical workloads
- No backup or disaster recovery strategy
- Missing health probes on load balancers
- Stateful applications without session persistence

### 2. Security Pillar
**Objective**: Protect against security threats and maintain confidentiality

**Key Principles**:
- Defense in depth: Multiple layers of security
- Least privilege access (Zero Trust)
- Encrypt data at rest and in transit
- Monitor and respond to security events

**Common Patterns**:
- Azure AD for identity and access management
- Network Security Groups and Azure Firewall for network isolation
- Key Vault for secrets management
- Azure Defender/Microsoft Defender for Cloud

**Anti-patterns to Detect**:
- Public endpoints without network restrictions
- Hardcoded credentials or keys
- Overly permissive RBAC assignments
- No encryption for sensitive data

### 3. Cost Optimization Pillar
**Objective**: Maximize business value while minimizing costs

**Key Principles**:
- Right-size resources based on actual usage
- Use pricing models that match usage patterns (reserved, spot)
- Eliminate waste (unused resources)
- Monitor and forecast spending

**Common Patterns**:
- Azure Reserved Instances for predictable workloads
- Autoscaling for variable workloads
- Azure Spot VMs for fault-tolerant batch processing
- Azure Cost Management for monitoring

**Anti-patterns to Detect**:
- Oversized VMs or databases
- Always-on resources for dev/test environments
- Premium storage for non-critical data
- No budget alerts or cost monitoring

### 4. Operational Excellence Pillar
**Objective**: Streamline development and operations processes

**Key Principles**:
- Infrastructure as Code (IaC)
- Continuous integration and deployment
- Monitoring and observability
- Incident response and learning

**Common Patterns**:
- Bicep/ARM templates or Terraform for IaC
- Azure DevOps or GitHub Actions for CI/CD
- Azure Monitor and Application Insights
- Automated testing and quality gates

**Anti-patterns to Detect**:
- Manual resource provisioning
- No automated testing
- Lack of monitoring or alerting
- No documented runbooks

### 5. Performance Efficiency Pillar
**Objective**: Scale to meet demand efficiently

**Key Principles**:
- Choose the right resources for workload requirements
- Scale horizontally over vertical when possible
- Optimize data storage and retrieval
- Use caching and CDNs

**Common Patterns**:
- Azure CDN for static content
- Redis Cache for application caching
- Cosmos DB for global distribution
- Load balancers and auto-scaling

**Anti-patterns to Detect**:
- No caching layer
- Inefficient database queries
- Not using CDN for static assets
- Single large instance instead of scale-out

## Assessment Templates

### Quick Assessment Checklist
```markdown
#### Reliability
- [ ] Multi-region or multi-zone deployment
- [ ] Automated backup configured
- [ ] Health monitoring in place
- [ ] Disaster recovery tested

#### Security
- [ ] Network isolation (NSG, firewall)
- [ ] Encryption at rest and in transit
- [ ] Secrets in Key Vault (not hardcoded)
- [ ] RBAC with least privilege

#### Cost Optimization
- [ ] Right-sized resources (CPU, memory usage < 80%)
- [ ] Reserved instances for stable workloads
- [ ] Autoscaling configured
- [ ] Cost alerts configured

#### Operational Excellence
- [ ] Infrastructure as Code used
- [ ] CI/CD pipeline in place
- [ ] Monitoring and alerting configured
- [ ] Documented runbooks

#### Performance Efficiency
- [ ] Caching layer implemented
- [ ] CDN for static content
- [ ] Database indexes optimized
- [ ] Horizontal scaling enabled
```

### Severity Levels for Issues
- **Critical**: Immediate risk to security, availability, or significant cost impact (> $10k/year)
- **High**: Significant gap from best practices, moderate risk
- **Medium**: Improvement opportunity, minor risk
- **Low**: Nice-to-have optimization

## How to Use This Skill

1. **Parse Resources**: Extract Azure resource types and configurations
2. **Map to Pillars**: Determine which pillars are most relevant
3. **Apply Patterns**: Check for recommended patterns and anti-patterns
4. **Generate Findings**: Document gaps with severity and recommendations
5. **Prioritize**: Order recommendations by impact and effort

## Example Output Format
```json
{
  "pillar": "Security",
  "severity": "Critical",
  "finding": "Storage account 'proddata001' has public network access enabled",
  "risk": "Potential unauthorized access to sensitive data",
  "recommendation": "Configure firewall rules to restrict access to specific VNets or IP ranges",
  "implementation": "az storage account update --name proddata001 --default-action Deny",
  "effort": "Low (5 minutes)",
  "confidence": "High"
}
```
