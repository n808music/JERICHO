// ---------------------------------------------------------------------------
// Feasibility Substrate Level
//
// Maps plan quality gate outputs to a pre-execution substrate level that
// controls whether feasibility can be truthfully awarded for a given plan.
//
// Order of operations: plan quality → substrate → feasibility.
// Feasibility MUST NOT be surfaced to the user until the plan qualifies
// for at least rough_feasibility substrate.
// ---------------------------------------------------------------------------

export type FeasibilitySubstrateLevel =
  | 'withheld'          // Plan has violations or quality gate withheld. Feasibility cannot be stated.
  | 'support_only'      // Plan quality indeterminate or intake insufficient. Support guidance only.
  | 'rough_feasibility' // Plan passes quality gate but has warnings. Feasibility estimate with caveats.
  | 'trusted_feasibility'; // Plan passes all quality gates, no violations, no warnings. Full feasibility.

export type PlanAuditSummary = {
  planStatus: 'VALID_AND_FULLY_SCHEDULED' | 'VALID_WITH_WARNINGS' | 'INVALID_VIOLATIONS_PRESENT' | string;
  violationCount: number;
  warningCount: number;
};

export type PlanQualityGateSummary = {
  status: 'PLAN_QUALITY_PASSED' | 'PLAN_QUALITY_WITHHELD' | string;
};

export type FeasibilitySubstrateResult = {
  level: FeasibilitySubstrateLevel;
  reason: string;
  feasibilityEligible: boolean;
};

export function deriveFeasibilitySubstrateLevel(
  planAudit: PlanAuditSummary | null | undefined,
  planQualityGate: PlanQualityGateSummary | null | undefined
): FeasibilitySubstrateResult {
  const auditStatus = String(planAudit?.planStatus || '').trim();
  const violationCount = Math.max(0, Number(planAudit?.violationCount ?? 0));
  const warningCount = Math.max(0, Number(planAudit?.warningCount ?? 0));
  const gateStatus = String(planQualityGate?.status || '').trim();

  if (!planAudit || !planQualityGate) {
    return {
      level: 'support_only',
      reason: 'Plan quality audit or quality gate result is unavailable. Feasibility estimate is unsupported.',
      feasibilityEligible: false,
    };
  }

  if (gateStatus === 'PLAN_QUALITY_WITHHELD') {
    return {
      level: 'withheld',
      reason: 'Plan quality gate is withheld. Feasibility cannot be stated until the plan meets the quality threshold.',
      feasibilityEligible: false,
    };
  }

  if (auditStatus === 'INVALID_VIOLATIONS_PRESENT' || violationCount > 0) {
    return {
      level: 'withheld',
      reason: `Plan has ${violationCount} structural violation(s). Feasibility cannot be stated until violations are resolved.`,
      feasibilityEligible: false,
    };
  }

  if (gateStatus !== 'PLAN_QUALITY_PASSED') {
    return {
      level: 'support_only',
      reason: 'Plan quality gate status is unrecognized. Only support-level guidance is available.',
      feasibilityEligible: false,
    };
  }

  if (warningCount > 0 || auditStatus === 'VALID_WITH_WARNINGS') {
    return {
      level: 'rough_feasibility',
      reason: `Plan passes the quality gate but has ${warningCount} warning(s). Feasibility estimate is available with caveats.`,
      feasibilityEligible: true,
    };
  }

  return {
    level: 'trusted_feasibility',
    reason: 'Plan passes all quality gates with no violations or warnings. Full feasibility assessment is supported.',
    feasibilityEligible: true,
  };
}
