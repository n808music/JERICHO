/**
 * phaseRetroactiveAudit.test.js
 *
 * Task 8: Retroactive Phase Audit execution
 * Runs the audit against sample matrix data and reports diffs before migration.
 */

import { describe, it, expect } from 'vitest';
import { auditInitiativePhases, formatAuditReport } from '../../src/domain/masterGrid/phaseRetroactiveAudit.js';

describe('Phase Retroactive Audit — Task 8', () => {
  it('should audit initiatives with no spine configured (baseline)', () => {
    const matrix = {
      initiativesById: {
        'init-state-control': {
          id: 'init-state-control',
          name: 'State of Control',
          terminalDeadline: '2032-03-15',
          phase: null, // Not yet set
        },
        'init-max-clout': {
          id: 'init-max-clout',
          name: 'Max Clout',
          terminalDeadline: '2033-06-30',
          phase: null,
        },
        'init-am-state': {
          id: 'init-am-state',
          name: 'I Am The State',
          terminalDeadline: '2035-12-31',
          phase: null,
        },
        'init-side-project': {
          id: 'init-side-project',
          name: 'Side Initiative',
          terminalDeadline: '2034-09-15',
          phase: null, // Will be P2 when spine is configured
        },
      },
      projectsById: {
        'proj-soc-launch': {
          id: 'proj-soc-launch',
          name: 'State of Control Launch',
          owningInitiativeId: 'init-state-control',
          targetDate: '2032-02-01',
          phase: null,
        },
        'proj-mc-scale': {
          id: 'proj-mc-scale',
          name: 'Max Clout Scale',
          owningInitiativeId: 'init-max-clout',
          targetDate: '2033-05-01',
          phase: null,
        },
      },
      spineInitiativeIds: [], // No spine yet
    };

    const audit = auditInitiativePhases(matrix);

    expect(audit).toMatchObject({
      totalInitiatives: 4,
      totalProjects: 2,
      expectedDiffs: [],
      unexpectedDiffs: [],
      hierarchyViolations: [],
      consistent: 4, // All are null/null = consistent
      readyForMigration: true,
    });
  });

  it('should detect expected diffs when spine is configured', () => {
    const matrix = {
      initiativesById: {
        'init-state-control': {
          id: 'init-state-control',
          name: 'State of Control',
          terminalDeadline: '2032-03-15',
          phase: null, // Will compute to P1
        },
        'init-max-clout': {
          id: 'init-max-clout',
          name: 'Max Clout',
          terminalDeadline: '2033-06-30',
          phase: null, // Will compute to P2
        },
        'init-am-state': {
          id: 'init-am-state',
          name: 'I Am The State',
          terminalDeadline: '2035-12-31',
          phase: null, // Will compute to P3
        },
      },
      projectsById: {},
      spineInitiativeIds: ['init-state-control', 'init-max-clout', 'init-am-state'],
    };

    const audit = auditInitiativePhases(matrix);

    // With spine configured, all initiatives now compute to their phase
    expect(audit.expectedDiffs.length).toBe(3);
    expect(audit.expectedDiffs).toContainEqual(
      expect.objectContaining({
        initiativeId: 'init-state-control',
        oldPhase: null,
        newPhase: 1,
      })
    );
    expect(audit.expectedDiffs).toContainEqual(
      expect.objectContaining({
        initiativeId: 'init-max-clout',
        oldPhase: null,
        newPhase: 2,
      })
    );
    expect(audit.expectedDiffs).toContainEqual(
      expect.objectContaining({
        initiativeId: 'init-am-state',
        oldPhase: null,
        newPhase: 3,
      })
    );
    expect(audit.hierarchyViolations).toHaveLength(0);
    expect(audit.readyForMigration).toBe(true);
  });

  it('should detect phase hierarchy violations', () => {
    const matrix = {
      initiativesById: {
        'init-spine-1': {
          id: 'init-spine-1',
          name: 'Spine 1',
          terminalDeadline: '2032-01-01', // P1
          phase: 1,
        },
        'init-spine-2': {
          id: 'init-spine-2',
          name: 'Spine 2',
          terminalDeadline: '2034-01-01', // P2
          phase: 2,
        },
        'init-parent': {
          id: 'init-parent',
          name: 'Parent Initiative',
          terminalDeadline: '2034-06-01', // P2
          phase: 2,
        },
        'init-child': {
          id: 'init-child',
          name: 'Child Initiative',
          parentInitiativeId: 'init-parent',
          terminalDeadline: '2033-01-01', // P1 — violates child >= parent
          phase: 1,
        },
      },
      projectsById: {
        'proj-child-work': {
          id: 'proj-child-work',
          name: 'Child Project',
          owningInitiativeId: 'init-child',
          targetDate: '2032-06-01', // P1
          phase: 1,
        },
      },
      spineInitiativeIds: ['init-spine-1', 'init-spine-2'],
    };

    const audit = auditInitiativePhases(matrix);

    // Initiative Phase violation: child (P1) < parent (P2)
    expect(audit.hierarchyViolations.length).toBeGreaterThan(0);
    expect(audit.readyForMigration).toBe(false);
    expect(audit.unexpectedDiffs.length).toBe(0); // Diffs are expected; violations are separate
  });

  it('should format audit report as markdown', () => {
    const auditReport = {
      timestamp: '2026-08-15T18:44:00Z',
      totalInitiatives: 3,
      totalProjects: 2,
      expectedDiffs: [
        {
          initiativeId: 'init-state-control',
          name: 'State of Control',
          oldPhase: null,
          newPhase: 1,
          reason: 'Terminal Deadline now present, Phase computable from spine windows',
        },
      ],
      unexpectedDiffs: [],
      hierarchyViolations: [
        {
          projectId: 'proj-test',
          projectName: 'Test Project',
          initiativeId: 'init-test',
          initiativeName: 'Test Initiative',
          projectPhase: 1,
          initiativePhase: 2,
          violation: 'Child Initiative phase (1) is less than parent Initiative phase (2).',
        },
      ],
      consistent: 2,
      readyForMigration: false,
      message: 'Audit FLAGGED: 2 consistent, 1 expected diffs, 0 ANOMALIES, 1 hierarchy violations. Review required before migration.',
    };

    const formatted = formatAuditReport(auditReport);

    expect(formatted).toContain('Phase Retroactive Audit Report');
    expect(formatted).toContain('⚠️ REQUIRES REVIEW');
    expect(formatted).toContain('Expected Phase Changes');
    expect(formatted).toContain('State of Control');
    expect(formatted).toContain('null → P1');
    expect(formatted).toContain('Phase Hierarchy Violations');
    expect(formatted).toContain('Test Project');
    expect(formatted).toContain('Test Initiative');
  });

  it('should report PASSED when audit is clean', () => {
    const matrix = {
      initiativesById: {
        'init-one': {
          id: 'init-one',
          name: 'Initiative One',
          terminalDeadline: '2032-03-15',
          phase: 1, // Already computed and stored
        },
        'init-two': {
          id: 'init-two',
          name: 'Initiative Two',
          terminalDeadline: '2033-06-30',
          phase: 2, // Already computed and stored
        },
      },
      projectsById: {
        'proj-one': {
          id: 'proj-one',
          name: 'Project One',
          owningInitiativeId: 'init-one',
          targetDate: '2032-02-01',
          phase: 1,
        },
      },
      spineInitiativeIds: ['init-one', 'init-two'],
    };

    const audit = auditInitiativePhases(matrix);

    expect(audit.readyForMigration).toBe(true);
    expect(audit.expectedDiffs.length).toBe(0);
    expect(audit.unexpectedDiffs.length).toBe(0);
    expect(audit.hierarchyViolations.length).toBe(0);
    expect(audit.consistent).toBe(2);
    expect(audit.message).toContain('PASSED');
  });
});
