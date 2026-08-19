/**
 * phaseRetroactiveAudit.js
 *
 * Task 8: Retroactive Phase audit. Computes what Phase WOULD be for every existing Initiative
 * using the new spine-window doctrine, diffs against currently stored Phase values, and produces
 * a named-diff report BEFORE any stored values are overwritten.
 *
 * This audit is the gate that prevents silent Phase value changes from corrupting existing data.
 * It must run once before the first production use of automatic Phase computation, and may be
 * re-run on demand to validate consistency.
 *
 * Per directive constraint: "do not silently change any stored Phase value without producing
 * the retroactive-audit diff first."
 */

import { computeSpineWindows, computeInitiativePhase, validateInitiativePhaseHierarchy } from './spinePhaseComputation.js';

/**
 * Audits all Initiatives in the matrix, comparing current stored Phase against
 * newly computed Phase from spine windows. Also validates Project↔Initiative
 * Phase hierarchy (child >= parent).
 *
 * @param {object} matrix - Full matrix object (initiativesById, projectsById, spineInitiativeIds, etc.)
 * @returns {object} Audit report with expected/unexpected diffs and hierarchy violations
 *   {
 *     timestamp: ISO string,
 *     totalInitiatives: number,
 *     totalProjects: number,
 *     expectedDiffs: [{initiativeId, name, oldPhase, newPhase, reason}],
 *     unexpectedDiffs: [{initiativeId, name, oldPhase, newPhase, note}],
 *     hierarchyViolations: [{projectId, projectName, initiativeId, initiativeName, projectPhase, initiativePhase}],
 *     consistent: number,
 *     readyForMigration: boolean,
 *     message: string
 *   }
 */
export function auditInitiativePhases(matrix) {
  if (!matrix?.initiativesById) {
    return {
      timestamp: new Date().toISOString(),
      totalInitiatives: 0,
      totalProjects: 0,
      expectedDiffs: [],
      unexpectedDiffs: [],
      hierarchyViolations: [],
      consistent: 0,
      readyForMigration: true,
      message: 'No initiatives in matrix.',
    };
  }

  const initiatives = Object.values(matrix.initiativesById);
  const projects = Object.values(matrix.projectsById || {});
  const spineInitiatives = (matrix.spineInitiativeIds || [])
    .map((id) => matrix.initiativesById?.[id])
    .filter(Boolean);
  const spineWindows = computeSpineWindows(spineInitiatives);

  const expectedDiffs = [];
  const unexpectedDiffs = [];
  const hierarchyViolations = [];
  let consistent = 0;

  // Compute all Initiative phases first (needed for hierarchy check)
  const initiativePhases = new Map();
  for (const initiative of initiatives) {
    const computedPhase = computeInitiativePhase(initiative, spineWindows);
    initiativePhases.set(initiative.id, computedPhase);

    const storedPhase = initiative.phase ? Number(initiative.phase) : null;
    const computedValue = computedPhase === null || computedPhase === 'CROSS_PHASE' ? null : Number(computedPhase);

    // Match stored vs computed
    if (storedPhase === computedValue) {
      consistent++;
      continue;
    }

    // Determine if diff is expected or anomalous
    const diff = {
      initiativeId: initiative.id,
      name: initiative.name || initiative.id,
      oldPhase: storedPhase,
      newPhase: computedValue,
    };

    if (storedPhase === null && computedValue !== null) {
      diff.reason = 'Terminal Deadline now present, Phase computable from spine windows';
      expectedDiffs.push(diff);
    } else if (storedPhase !== null && computedValue === null) {
      diff.note = 'WARNING: Terminal Deadline missing or invalid; Phase cannot be computed';
      unexpectedDiffs.push(diff);
    } else if (storedPhase !== null && computedValue !== null && storedPhase !== computedValue) {
      if (matrix.spineInitiativeIds && matrix.spineInitiativeIds.length > 0) {
        diff.reason = `Hand-typed phase (${storedPhase}) being replaced by computed phase from spine windows`;
        expectedDiffs.push(diff);
      } else {
        diff.note = 'Spine not configured; unclear if hand-typed or computed value';
        unexpectedDiffs.push(diff);
      }
    }
  }

  // Validate Initiative↔Initiative Phase hierarchy (Task 6)
  // Rule: child Initiative Phase >= parent Initiative Phase
  for (const initiative of initiatives) {
    if (!initiative.parentInitiativeId) continue;

    const childPhase = initiativePhases.get(initiative.id);
    const parentPhase = initiativePhases.get(initiative.parentInitiativeId);

    if (childPhase !== null && childPhase !== 'CROSS_PHASE' && parentPhase !== null && parentPhase !== 'CROSS_PHASE') {
      const validation = validateInitiativePhaseHierarchy(childPhase, parentPhase);
      if (!validation.valid) {
        hierarchyViolations.push({
          childInitiativeId: initiative.id,
          childInitiativeName: initiative.name || initiative.id,
          parentInitiativeId: initiative.parentInitiativeId,
          parentInitiativeName: matrix.initiativesById?.[initiative.parentInitiativeId]?.name || initiative.parentInitiativeId,
          childPhase,
          parentPhase,
          violation: validation.message,
        });
      }
    }
  }

  // Validate Project↔Initiative Phase hierarchy (Task 6)
  // Rule: Project Phase >= Initiative Phase (child >= parent)
  for (const project of projects) {
    if (!project.owningInitiativeId) continue;

    const projectPhase = computeInitiativePhase(project, spineWindows);
    const initiativePhase = initiativePhases.get(project.owningInitiativeId);

    if (projectPhase !== null && projectPhase !== 'CROSS_PHASE' && initiativePhase !== null && initiativePhase !== 'CROSS_PHASE') {
      const validation = validateInitiativePhaseHierarchy(projectPhase, initiativePhase);
      if (!validation.valid) {
        hierarchyViolations.push({
          projectId: project.id,
          projectName: project.name || project.id,
          initiativeId: project.owningInitiativeId,
          initiativeName: matrix.initiativesById?.[project.owningInitiativeId]?.name || project.owningInitiativeId,
          projectPhase,
          initiativePhase,
          violation: validation.message,
        });
      }
    }
  }

  const readyForMigration = unexpectedDiffs.length === 0 && hierarchyViolations.length === 0;

  return {
    timestamp: new Date().toISOString(),
    totalInitiatives: initiatives.length,
    totalProjects: projects.length,
    expectedDiffs,
    unexpectedDiffs,
    hierarchyViolations,
    consistent,
    readyForMigration,
    message: readyForMigration
      ? `Audit PASSED: ${consistent} initiatives consistent, ${expectedDiffs.length} expected diffs, 0 anomalies, 0 hierarchy violations. Ready for migration.`
      : `Audit FLAGGED: ${consistent} consistent, ${expectedDiffs.length} expected diffs, ${unexpectedDiffs.length} ANOMALIES, ${hierarchyViolations.length} hierarchy violations. Review required before migration.`,
  };
}

/**
 * Formats audit report as named-diff output (per directive: evidence-first reporting).
 *
 * @param {object} auditReport - From auditInitiativePhases()
 * @returns {string} Formatted report
 */
export function formatAuditReport(auditReport) {
  const lines = [
    `## Phase Retroactive Audit Report`,
    `**Timestamp:** ${auditReport.timestamp}`,
    `**Status:** ${auditReport.readyForMigration ? '✅ READY FOR MIGRATION' : '⚠️ REQUIRES REVIEW'}`,
    ``,
    `**Summary:**`,
    `- Total Initiatives: ${auditReport.totalInitiatives}`,
    `- Consistent (no change): ${auditReport.consistent}`,
    `- Expected diffs (expected phase changes): ${auditReport.expectedDiffs.length}`,
    `- Unexpected anomalies (require operator review): ${auditReport.unexpectedDiffs.length}`,
    ``,
    `${auditReport.message}`,
    ``,
  ];

  if (auditReport.expectedDiffs.length > 0) {
    lines.push(`### Expected Phase Changes`);
    lines.push(``);
    for (const diff of auditReport.expectedDiffs) {
      lines.push(
        `- **${diff.name}** (${diff.initiativeId}): ${diff.oldPhase === null ? 'null' : `P${diff.oldPhase}`} → ${diff.newPhase === null ? 'null' : `P${diff.newPhase}`}`
      );
      lines.push(`  - Reason: ${diff.reason}`);
    }
    lines.push(``);
  }

  if (auditReport.unexpectedDiffs.length > 0) {
    lines.push(`### ⚠️ Unexpected Anomalies (Require Review)`);
    lines.push(``);
    for (const diff of auditReport.unexpectedDiffs) {
      lines.push(
        `- **${diff.name}** (${diff.initiativeId}): ${diff.oldPhase === null ? 'null' : `P${diff.oldPhase}`} → ${diff.newPhase === null ? 'null' : `P${diff.newPhase}`}`
      );
      lines.push(`  - Note: ${diff.note}`);
    }
    lines.push(``);
  }

  if (auditReport.hierarchyViolations.length > 0) {
    lines.push(`### ⚠️ Phase Hierarchy Violations (Task 6)`);
    lines.push(``);
    for (const violation of auditReport.hierarchyViolations) {
      if (violation.childInitiativeId) {
        // Initiative↔Initiative violation
        lines.push(
          `- **${violation.childInitiativeName}** (${violation.childInitiativeId}) [Child P${violation.childPhase}] under **${violation.parentInitiativeName}** (${violation.parentInitiativeId}) [Parent P${violation.parentPhase}]`
        );
      } else {
        // Project↔Initiative violation
        lines.push(
          `- **${violation.projectName}** (${violation.projectId}) [Project P${violation.projectPhase}] under **${violation.initiativeName}** (${violation.initiativeId}) [Initiative P${violation.initiativePhase}]`
        );
      }
      lines.push(`  - Violation: ${violation.violation}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
