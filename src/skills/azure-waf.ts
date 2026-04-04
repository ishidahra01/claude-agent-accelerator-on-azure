/**
 * Azure Well-Architected Framework Skill
 * Provides domain expertise on Azure WAF pillars for agent analysis
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Azure Well-Architected Framework knowledge base
 */
const wafKnowledge = {
  security: {
    principles: [
      'Defense in depth',
      'Least privilege access',
      'Zero trust architecture',
      'Identity as security perimeter',
      'Data encryption at rest and in transit',
    ],
    azureServices: {
      identity: ['Microsoft Entra ID', 'Managed Identities', 'RBAC'],
      network: ['NSG', 'Azure Firewall', 'Application Gateway WAF', 'Private Link'],
      data: ['Azure Key Vault', 'Storage Service Encryption', 'TDE'],
      monitoring: ['Microsoft Defender for Cloud', 'Azure Monitor', 'Sentinel'],
    },
    commonIssues: [
      'Public blob access enabled',
      'No HTTPS enforcement',
      'Missing network isolation',
      'Overly permissive RBAC',
      'Unencrypted data at rest',
      'Missing security monitoring',
    ],
  },
  cost: {
    principles: [
      'Right-sizing resources',
      'Using reserved instances for stable workloads',
      'Auto-scaling for variable workloads',
      'Decommissioning unused resources',
      'Optimizing storage tiers',
      'Monitoring and analyzing costs',
    ],
    commonWaste: [
      'Oversized VMs running 24/7',
      'Unattached disks',
      'Premium storage for dev/test',
      'No auto-shutdown for dev resources',
      'Missing reserved instance commitments',
      'Over-provisioned databases',
    ],
    savingsStrategies: [
      'Azure Hybrid Benefit for Windows/SQL',
      'Spot VMs for fault-tolerant workloads',
      'Cool/Archive storage tiers',
      'Azure Dev/Test pricing',
      'Reserved capacity for predictable workloads',
    ],
  },
  reliability: {
    principles: [
      'Design for failure',
      'Availability zones for HA',
      'Backup and disaster recovery',
      'Health monitoring and alerts',
      'Automated recovery procedures',
    ],
  },
  performance: {
    principles: [
      'CDN for global distribution',
      'Caching strategies',
      'Database indexing and optimization',
      'Async processing patterns',
      'Horizontal scaling over vertical',
    ],
  },
  operational: {
    principles: [
      'Infrastructure as Code',
      'CI/CD pipelines',
      'Automated testing',
      'Monitoring and alerting',
      'Incident response procedures',
    ],
  },
};

/**
 * Tool: Get Azure Well-Architected Framework guidance
 */
export const getWafGuidanceTool = tool(
  'get_waf_guidance',
  'Get Azure Well-Architected Framework best practices for a specific pillar',
  {
    pillar: z.enum(['security', 'cost', 'reliability', 'performance', 'operational']),
    context: z.string().optional().describe('Additional context about the specific scenario'),
  },
  async ({ pillar, context }) => {
    const guidance = wafKnowledge[pillar];

    let response = `Azure Well-Architected Framework: ${pillar.toUpperCase()} Pillar\n\n`;

    if (guidance.principles) {
      response += 'Key Principles:\n';
      guidance.principles.forEach((p: string) => response += `- ${p}\n`);
      response += '\n';
    }

    if (pillar === 'security' && guidance.azureServices) {
      response += 'Key Azure Services:\n';
      Object.entries(guidance.azureServices).forEach(([category, services]) => {
        response += `${category}: ${(services as string[]).join(', ')}\n`;
      });
      response += '\n';
    }

    if (guidance.commonIssues) {
      response += 'Common Issues to Check:\n';
      guidance.commonIssues.forEach((issue: string) => response += `- ${issue}\n`);
      response += '\n';
    }

    if (guidance.commonWaste) {
      response += 'Common Cost Waste Patterns:\n';
      guidance.commonWaste.forEach((waste: string) => response += `- ${waste}\n`);
      response += '\n';
    }

    if (guidance.savingsStrategies) {
      response += 'Cost Savings Strategies:\n';
      guidance.savingsStrategies.forEach((strategy: string) => response += `- ${strategy}\n`);
      response += '\n';
    }

    if (context) {
      response += `\nContext: ${context}\n`;
    }

    return {
      content: [{ type: 'text', text: response }],
    };
  }
);

/**
 * Tool: Analyze resource against WAF best practices
 */
export const analyzeResourceTool = tool(
  'analyze_azure_resource',
  'Analyze an Azure resource configuration against Well-Architected Framework best practices',
  {
    resourceType: z.string().describe('Azure resource type (e.g., Microsoft.Storage/storageAccounts)'),
    resourceConfig: z.string().describe('Resource configuration as JSON string'),
    pillar: z.enum(['security', 'cost', 'reliability', 'performance', 'operational', 'all']),
  },
  async ({ resourceType, resourceConfig, pillar }) => {
    let findings: string[] = [];

    try {
      const config = JSON.parse(resourceConfig);

      // Security analysis
      if (pillar === 'security' || pillar === 'all') {
        if (resourceType.includes('Storage')) {
          if (config.properties?.allowBlobPublicAccess === true) {
            findings.push('SECURITY: Public blob access is enabled - consider disabling for sensitive data');
          }
          if (config.properties?.supportsHttpsTrafficOnly === false) {
            findings.push('SECURITY: HTTPS-only traffic is not enforced');
          }
          if (!config.properties?.encryption) {
            findings.push('SECURITY: Encryption at rest is not configured');
          }
        }

        if (resourceType.includes('Web')) {
          if (config.properties?.httpsOnly === false) {
            findings.push('SECURITY: HTTPS enforcement is disabled');
          }
        }
      }

      // Cost analysis
      if (pillar === 'cost' || pillar === 'all') {
        if (resourceType.includes('Compute')) {
          const vmSize = config.properties?.hardwareProfile?.vmSize || config.sku?.name;
          if (vmSize && (vmSize.includes('Standard_D') || vmSize.includes('Standard_E'))) {
            findings.push(`COST: VM size ${vmSize} may be oversized - consider B-series for dev/test`);
          }
        }

        if (resourceType.includes('Disk')) {
          if (config.properties?.diskState === 'Unattached') {
            findings.push('COST: Disk is unattached - consider deletion to save costs');
          }
          if (config.sku?.name === 'Premium_LRS' && config.tags?.environment === 'dev') {
            findings.push('COST: Premium disk in dev environment - consider Standard_LRS');
          }
        }
      }

      if (findings.length === 0) {
        findings.push(`No immediate issues found for ${resourceType} under ${pillar} pillar`);
      }

    } catch (error) {
      findings.push(`Error parsing resource config: ${error}`);
    }

    return {
      content: [{ type: 'text', text: findings.join('\n') }],
    };
  }
);

/**
 * Export all Azure WAF skills
 */
export const azureWafSkills = [
  getWafGuidanceTool,
  analyzeResourceTool,
];
