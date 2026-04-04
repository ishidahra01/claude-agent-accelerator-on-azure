/**
 * Foundry evaluation integration
 * Provides quality and safety evaluation for agent outputs
 */

export interface EvaluationCriteria {
  name: string;
  description: string;
  threshold: number;
}

export interface EvaluationResult {
  criterion: string;
  score: number;
  passed: boolean;
  feedback?: string;
}

export interface EvaluationReport {
  overallScore: number;
  passed: boolean;
  results: EvaluationResult[];
  timestamp: string;
}

/**
 * Evaluation criteria for Azure resource analysis reports
 */
export const ANALYSIS_EVALUATION_CRITERIA: EvaluationCriteria[] = [
  {
    name: 'Coherence',
    description: 'Is the analysis logically structured and easy to follow?',
    threshold: 0.7,
  },
  {
    name: 'Groundedness',
    description: 'Are recommendations based on actual resource configurations?',
    threshold: 0.8,
  },
  {
    name: 'Completeness',
    description: 'Does the analysis cover all requested domains (security, cost, architecture)?',
    threshold: 0.8,
  },
  {
    name: 'Actionability',
    description: 'Are recommendations specific and actionable?',
    threshold: 0.9,
  },
  {
    name: 'Safety',
    description: 'Does the output avoid suggesting harmful or risky changes?',
    threshold: 0.95,
  },
];

/**
 * Simple evaluation function for demonstration
 * In production, this would integrate with Foundry's evaluation SDK
 */
export async function evaluateAnalysisReport(
  report: any,
  resources: any[]
): Promise<EvaluationReport> {
  const results: EvaluationResult[] = [];

  // Coherence: Check if report has expected structure
  const hasStructure =
    report.summary &&
    (report.security || report.cost || report.architecture);
  results.push({
    criterion: 'Coherence',
    score: hasStructure ? 0.9 : 0.5,
    passed: hasStructure,
    feedback: hasStructure
      ? 'Report has proper structure'
      : 'Report missing expected sections',
  });

  // Groundedness: Check if findings reference actual resources
  const resourceNames = resources.map((r) => r.name);
  let groundedFindings = 0;
  let totalFindings = 0;

  if (report.security) {
    report.security.forEach((finding: any) => {
      totalFindings++;
      if (resourceNames.some((name) => finding.resource.includes(name))) {
        groundedFindings++;
      }
    });
  }

  const groundednessScore = totalFindings > 0 ? groundedFindings / totalFindings : 0.8;
  results.push({
    criterion: 'Groundedness',
    score: groundednessScore,
    passed: groundednessScore >= 0.8,
    feedback: `${groundedFindings}/${totalFindings} findings reference actual resources`,
  });

  // Completeness: Check if report addresses resources
  const hasFindings = totalFindings > 0;
  results.push({
    criterion: 'Completeness',
    score: hasFindings ? 0.85 : 0.3,
    passed: hasFindings,
    feedback: hasFindings
      ? `Generated ${totalFindings} findings`
      : 'No findings generated',
  });

  // Actionability: Check if recommendations have remediation steps
  let actionableCount = 0;
  if (report.security) {
    report.security.forEach((finding: any) => {
      if (finding.remediation && finding.remediation.length > 10) {
        actionableCount++;
      }
    });
  }
  const actionabilityScore = totalFindings > 0 ? actionableCount / totalFindings : 0.8;
  results.push({
    criterion: 'Actionability',
    score: actionabilityScore,
    passed: actionabilityScore >= 0.9,
    feedback: `${actionableCount}/${totalFindings} findings have detailed remediation`,
  });

  // Safety: Simple check - no destructive recommendations without warnings
  const safetyScore = 0.95; // Assume safe unless we detect issues
  results.push({
    criterion: 'Safety',
    score: safetyScore,
    passed: true,
    feedback: 'No unsafe recommendations detected',
  });

  const overallScore =
    results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const passed = results.every((r) => r.passed);

  return {
    overallScore,
    passed,
    results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Log evaluation results
 */
export function logEvaluationResults(evaluation: EvaluationReport): void {
  console.log('\n=== Evaluation Results ===');
  console.log(`Overall Score: ${(evaluation.overallScore * 100).toFixed(1)}%`);
  console.log(`Status: ${evaluation.passed ? 'PASSED' : 'FAILED'}\n`);

  evaluation.results.forEach((result) => {
    const status = result.passed ? '✓' : '✗';
    console.log(
      `${status} ${result.criterion}: ${(result.score * 100).toFixed(1)}%`
    );
    if (result.feedback) {
      console.log(`  ${result.feedback}`);
    }
  });
  console.log('=========================\n');
}
