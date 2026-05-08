import { ARCHETYPE_MATRIX_1_0, type ArchetypeDefinition } from './archetypeMatrix1_0';

export type ExecutionSpecLaneRow = {
  laneId: string;
  archetype: string;
  subtype: string;
  definition: string;
  deliverableCount: number;
  milestoneCount: number;
  actionClassCount: number;
  hasDependencyPattern: boolean;
  hasSchedulePattern: boolean;
  hasCorrectionPattern: boolean;
};

export type ExecutionSpecValidationRules = {
  minDeliverables: number;
  minMilestones: number;
  minActionClasses: number;
};

export type ExecutionSpecLaneIssueCode =
  | 'DELIVERABLES_TOO_SHALLOW'
  | 'MILESTONES_TOO_SHALLOW'
  | 'ACTION_CLASSES_TOO_SHALLOW'
  | 'MISSING_DEPENDENCY_PATTERN'
  | 'MISSING_SCHEDULE_PATTERN'
  | 'MISSING_CORRECTION_PATTERN';

export type ExecutionSpecLaneValidationIssue = {
  laneId: string;
  archetype: string;
  subtype: string;
  code: ExecutionSpecLaneIssueCode;
  message: string;
};

export const DEFAULT_EXECUTION_SPEC_RULES: ExecutionSpecValidationRules = {
  minDeliverables: 3,
  minMilestones: 1,
  minActionClasses: 3,
};

function toLaneId(archetype: string, subtype: string) {
  const canonical = `${archetype}.${subtype}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return canonical;
}

export function buildExecutionSpecLaneRows(
  matrix: ArchetypeDefinition[] = ARCHETYPE_MATRIX_1_0
): ExecutionSpecLaneRow[] {
  const rows: ExecutionSpecLaneRow[] = [];
  matrix.forEach((archetype) => {
    archetype.lanes.forEach((lane) => {
      rows.push({
        laneId: toLaneId(archetype.archetype, lane.subtype),
        archetype: archetype.archetype,
        subtype: lane.subtype,
        definition: lane.definition,
        deliverableCount: lane.grammar.typicalDeliverables.length,
        milestoneCount: lane.grammar.typicalMilestones.length,
        actionClassCount: lane.grammar.actionClasses.length,
        hasDependencyPattern: lane.grammar.dependencyPattern.trim().length > 0,
        hasSchedulePattern: lane.grammar.schedulePattern.trim().length > 0,
        hasCorrectionPattern: lane.grammar.correctionPattern.trim().length > 0,
      });
    });
  });
  return rows;
}

export function validateExecutionSpecLaneRows(
  rows: ExecutionSpecLaneRow[],
  rules: ExecutionSpecValidationRules = DEFAULT_EXECUTION_SPEC_RULES
): ExecutionSpecLaneValidationIssue[] {
  const issues: ExecutionSpecLaneValidationIssue[] = [];

  rows.forEach((row) => {
    if (row.deliverableCount < rules.minDeliverables) {
      issues.push({
        laneId: row.laneId,
        archetype: row.archetype,
        subtype: row.subtype,
        code: 'DELIVERABLES_TOO_SHALLOW',
        message: `Expected at least ${rules.minDeliverables} deliverables; found ${row.deliverableCount}.`,
      });
    }

    if (row.milestoneCount < rules.minMilestones) {
      issues.push({
        laneId: row.laneId,
        archetype: row.archetype,
        subtype: row.subtype,
        code: 'MILESTONES_TOO_SHALLOW',
        message: `Expected at least ${rules.minMilestones} milestones; found ${row.milestoneCount}.`,
      });
    }

    if (row.actionClassCount < rules.minActionClasses) {
      issues.push({
        laneId: row.laneId,
        archetype: row.archetype,
        subtype: row.subtype,
        code: 'ACTION_CLASSES_TOO_SHALLOW',
        message: `Expected at least ${rules.minActionClasses} action classes; found ${row.actionClassCount}.`,
      });
    }

    if (!row.hasDependencyPattern) {
      issues.push({
        laneId: row.laneId,
        archetype: row.archetype,
        subtype: row.subtype,
        code: 'MISSING_DEPENDENCY_PATTERN',
        message: 'Dependency pattern is required for test-matrix execution ordering.',
      });
    }

    if (!row.hasSchedulePattern) {
      issues.push({
        laneId: row.laneId,
        archetype: row.archetype,
        subtype: row.subtype,
        code: 'MISSING_SCHEDULE_PATTERN',
        message: 'Schedule pattern is required for lane-level scheduling expectations.',
      });
    }

    if (!row.hasCorrectionPattern) {
      issues.push({
        laneId: row.laneId,
        archetype: row.archetype,
        subtype: row.subtype,
        code: 'MISSING_CORRECTION_PATTERN',
        message: 'Correction pattern is required for drift/failure recovery tests.',
      });
    }
  });

  return issues;
}

export function summarizeExecutionSpecSurface(rows: ExecutionSpecLaneRow[]) {
  const byArchetype: Record<string, number> = {};
  rows.forEach((row) => {
    byArchetype[row.archetype] = (byArchetype[row.archetype] ?? 0) + 1;
  });

  return {
    archetypeCount: Object.keys(byArchetype).length,
    laneCount: rows.length,
    byArchetype,
    averageDeliverablesPerLane:
      rows.length === 0
        ? 0
        : Number((rows.reduce((sum, row) => sum + row.deliverableCount, 0) / rows.length).toFixed(2)),
    averageActionClassesPerLane:
      rows.length === 0
        ? 0
        : Number((rows.reduce((sum, row) => sum + row.actionClassCount, 0) / rows.length).toFixed(2)),
  };
}
