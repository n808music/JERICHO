import type { EnterpriseDisplayProjection } from './enterpriseDisplayProjection';
import { INCORRECT_ENTITY_NAME_ALIASES } from './enterpriseIdentityMap';

export type EnterpriseIdentityFailureCode =
  | 'CIVIC_LABEL_NOT_NORMALIZED'
  | 'REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED'
  | 'DISPLAY_ROW_USES_INTERNAL_LANE_NAME'
  | 'COMPANY_NAME_MISSING_FROM_PLAN_CHART'
  | 'PRODUCT_NAME_MISSING_FROM_PLAN_CHART'
  | 'UNSUPPORTED_ENTERPRISE_ENTITY'
  | 'AMBIGUOUS_REVENUE_RUNWAY_LANE'
  | 'BLOCK_DETAIL_TOO_ABSTRACT'
  | 'BLOCK_PROVENANCE_MISSING'
  | 'INCORRECT_ENTERPRISE_ENTITY_NAME';

export interface EnterpriseIdentityFinding {
  code: EnterpriseIdentityFailureCode;
  detail: string;
  laneId?: string;
  blockId?: string;
}

export interface EnterpriseIdentityAuditChartRow {
  primaryLabel: string;
  laneId: string;
}

export interface EnterpriseIdentityAuditBlockSignal {
  id: string;
  laneId: string | null;
  phaseLabel?: string;
  blockType?: string;
  /** Truthy when the Real Estate / capital P1 placement has explicit justification. */
  gatesJustification?: unknown;
  expectedOutput?: string;
  acceptanceEvidence?: string;
}

export interface EnterpriseIdentityAuditInput {
  projections: EnterpriseDisplayProjection[];
  chartRows: EnterpriseIdentityAuditChartRow[];
  blocks: EnterpriseIdentityAuditBlockSignal[];
}

export interface EnterpriseIdentityAuditResult {
  findings: EnterpriseIdentityFinding[];
}

const INTERNAL_NAME_PATTERN = /^operation endgame|\.{3}$|prod\.{3}|civic\b|product_|lane_/i;
const GENERIC_OUTPUT_TOKENS = ['', '—', 'tbd', 'todo', 'n/a'];

function isGenericText(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return GENERIC_OUTPUT_TOKENS.includes(normalized);
}

export function evaluateEnterpriseIdentityAudit(
  input: EnterpriseIdentityAuditInput,
): EnterpriseIdentityAuditResult {
  const findings: EnterpriseIdentityFinding[] = [];
  const projectionByLane = new Map(
    input.projections.map((p) => [p.internalLane, p]),
  );

  for (const row of input.chartRows) {
    const normalizedLabel = String(row.primaryLabel || '').trim();
    const lowered = normalizedLabel.toLowerCase();

    if (lowered === 'civic') {
      findings.push({
        code: 'CIVIC_LABEL_NOT_NORMALIZED',
        detail: 'Chart row renders "Civic" as primary label; expected "Global State Holdings".',
        laneId: row.laneId,
      });
    }

    const incorrectAlias = Object.keys(INCORRECT_ENTITY_NAME_ALIASES).find(
      (alias) => alias.toLowerCase() === lowered,
    );
    if (incorrectAlias) {
      findings.push({
        code: 'INCORRECT_ENTERPRISE_ENTITY_NAME',
        detail: `Chart row renders "${incorrectAlias}"; expected "${INCORRECT_ENTITY_NAME_ALIASES[incorrectAlias]}".`,
        laneId: row.laneId,
      });
    }

    if (INTERNAL_NAME_PATTERN.test(normalizedLabel)) {
      findings.push({
        code: 'DISPLAY_ROW_USES_INTERNAL_LANE_NAME',
        detail: `Chart row "${normalizedLabel}" looks like an internal lane name rather than a founder-facing display name.`,
        laneId: row.laneId,
      });
    }

    const projection = projectionByLane.get(row.laneId);
    if (projection && projection.provenanceStatus === 'unsupported') {
      findings.push({
        code: 'UNSUPPORTED_ENTERPRISE_ENTITY',
        detail: `Chart row "${normalizedLabel}" has no canonical enterprise entity.`,
        laneId: row.laneId,
      });
    }
  }

  for (const block of input.blocks) {
    if (!block.laneId) {
      findings.push({
        code: 'BLOCK_PROVENANCE_MISSING',
        detail: 'Block has no resolvable lane id; provenance cannot be determined.',
        blockId: block.id,
      });
      continue;
    }

    const projection = projectionByLane.get(block.laneId);
    const isRealEstate = projection?.companyCategory === 'Real Estate';
    const isExecution = String(block.blockType || '').toLowerCase() === 'execution';
    const isP1 = String(block.phaseLabel || '').toUpperCase() === 'P1';
    if (isRealEstate && isP1 && isExecution && !block.gatesJustification) {
      findings.push({
        code: 'REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED',
        detail:
          'Real Estate execution block scheduled in P1 without prerequisite, capital, legal, runway, or dependency justification.',
        laneId: block.laneId,
        blockId: block.id,
      });
    }

    if (isGenericText(block.expectedOutput) || isGenericText(block.acceptanceEvidence)) {
      findings.push({
        code: 'BLOCK_DETAIL_TOO_ABSTRACT',
        detail:
          'Block detail is missing a concrete artifact (Produces) or inspectable proof (Acceptance evidence).',
        laneId: block.laneId,
        blockId: block.id,
      });
    }
  }

  return { findings };
}
