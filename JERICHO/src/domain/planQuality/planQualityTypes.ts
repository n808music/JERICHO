export type PlanQualityGateStatus = 'PLAN_QUALITY_PASSED' | 'PLAN_QUALITY_WITHHELD';

export type PlanQualityFailureCode =
  | 'PLAN_COVERAGE_MISSING_MAJOR_COMPONENT'
  | 'PLAN_COVERAGE_MISSING_DELIVERABLE_BRANCH'
  | 'PLAN_COVERAGE_MISSING_EXECUTION_DESCENDANTS'
  | 'PLAN_COVERAGE_PARTIAL_SCOPE_COLLAPSE'
  | 'DELIVERABLE_OBJECT_MISSING'
  | 'DELIVERABLE_TOO_GENERIC'
  | 'DELIVERABLE_GOAL_DISCONNECTED'
  | 'DELIVERABLE_SEMANTIC_HOLLOWNESS'
  | 'ACTION_LINEAGE_BROKEN'
  | 'BLOCK_LINEAGE_BROKEN'
  | 'BLOCK_TOO_GENERIC'
  | 'BLOCK_GOAL_OBJECT_MISSING'
  | 'LINEAGE_VISIBLE_MEANING_LOSS'
  | 'FEASIBILITY_NOT_ADMITTED_PLAN_QUALITY_WITHHELD'
  | 'POS_NOT_ADMITTED_PLAN_QUALITY_WITHHELD'
  | 'POS_NOT_ADMITTED_FEASIBILITY_WITHHELD'
  | 'POS_NOT_ADMITTED_INCOMPLETE_PLAN_SUBSTRATE'
  | 'OUTCOME_COVERAGE_PREP_ONLY'
  | 'OUTCOME_COVERAGE_TERMINAL_STAGE_MISSING'
  | 'OUTCOME_ENDPOINT_MISSING'
  | 'OUTCOME_SPLIT_DIMENSION_UNCOVERED'
  | 'LONG_HORIZON_TEMPORAL_COMPRESSION'
  | 'LONG_HORIZON_UNJUSTIFIED_TAIL_GAP'
  | 'LONG_HORIZON_SPARSE_CADENCE'
  | 'LONG_HORIZON_WORK_GAPS'
  | 'COMMERCIAL_BLOCK_SPECIFICITY_WEAK'
  | 'COMMERCIAL_WORK_WINDOW_UNDERUSED'
  | 'TERMINAL_OBJECT_DRIFT'
  | 'COMMERCIAL_READINESS_MISSING'
  | 'PURCHASE_PATH_MISSING'
  | 'FIRST_SALES_CORRIDOR_MISSING'
  | 'BRAND_LAUNCH_SUBSTITUTED_FOR_PRODUCT_LAUNCH'
  | 'TERMINAL_EVENT_EVIDENCE_MISSING';

export type PlanQualityGateResult = {
  status: PlanQualityGateStatus;
  failureCodes: PlanQualityFailureCode[];
  reasonCodes: string[];
  meta?: {
    missingMajorComponents?: string[];
    missingDeliverableBranches?: string[];
    missingExecutionDescendants?: string[];
    weakDeliverableIds?: string[];
    weakBlockIds?: string[];
    goalDisconnectedDeliverableIds?: string[];
    semanticHollowDeliverableIds?: string[];
    goalObjectMissingBlockIds?: string[];
    meaningLossBlockIds?: string[];
    temporalDistribution?: {
      contractStartDayKey: string;
      contractEndDayKey: string;
      firstScheduledDayKey: string;
      lastScheduledDayKey: string;
      horizonDays: number;
      scheduledSpanDays: number;
      occupiedMonths: string[];
      latestScheduledHorizonRatio: number;
      requiredLatestHorizonRatio: number;
      requiredOccupiedMonths: number;
      remainingTailDays?: number;
      remainingTailRatio?: number;
      maxUnjustifiedTailRatio?: number;
      scheduledBlockCount?: number;
      averageBlocksPerWeek?: number;
      requiredAverageBlocksPerWeek?: number;
      maxInterBlockGapDays?: number;
      maxAllowedInterBlockGapDays?: number;
      averageActiveWeekdaysPerScheduledWeek?: number;
      requiredActiveWeekdaysPerScheduledWeek?: number;
    };
    commercialBlockSpecificity?: {
      repeatedShellBlockIds: string[];
      repeatedShellTitleCount: number;
      repeatedShellTitleRatio: number;
      maxRepeatedShellTitleCount: number;
      maxRepeatedShellTitleRatio: number;
    };
    commercialSemanticCoverage?: {
      requiredFamilies: string[];
      coveredFamilies: string[];
      missingFamilies: string[];
      invalidSubstituteFamilies: string[];
      evaluatedArtifacts: number;
    };
  };
};
