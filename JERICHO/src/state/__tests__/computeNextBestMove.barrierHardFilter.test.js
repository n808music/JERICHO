import { describe, it, expect } from 'vitest';
import { computeNextBestMove, applyBarrierHardFilter } from '../aimCompute.js';

describe('Step 4: Barrier Hard-Filter — exclude blocks tied to projects with CONSTRAINT barriers', () => {
  it('filters out a block tied to a project with an active legal-formation CONSTRAINT barrier', () => {
    const goal = 'Complete project setup';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-08-03';

    // Unformed entity
    const entity = {
      id: 'entity-1',
      name: 'My Company',
      legallyFormed: false,
    };

    // Project that requires legal formation
    const project = {
      id: 'project-1',
      name: 'Revenue Engine',
      owningEntityId: 'entity-1',
      requiresLegalFormation: true,
    };

    // Deliverable owned by the blocked project
    const deliverable = {
      id: 'deliv-1',
      name: 'Setup Deliverable',
      owningProjectId: 'project-1',
      owningInitiativeId: 'init-1',
    };

    // Barrier: entity not legally formed
    const barrier = {
      id: 'barrier-legal-entity-1-project-1',
      type: 'legalFormation',
      entityId: 'entity-1',
      projectId: 'project-1',
      claimType: 'CONSTRAINT',
      message: 'BARRIER — My Company: not legally formed. Revenue Engine requires legal formation to proceed. This step cannot proceed until resolved.',
      resolutionType: 'prerequisite',
    };

    // Block scheduled for today, linked to the blocked project via deliverable
    const blocks = [
      {
        id: 'block-1',
        start: '2026-08-03T09:00:00Z',
        end: '2026-08-03T10:00:00Z',
        durationMinutes: 60,
        domain: 'FOCUS',
        practice: 'FOCUS',
        deliverableId: 'deliv-1', // Links to project via deliverable
      },
    ];

    const deliverablesById = { 'deliv-1': deliverable };
    const barriersById = { 'barrier-legal-entity-1-project-1': barrier };

    // Without barrier filter (old behavior)
    const recommendationWithoutBarrier = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      {}, // urgencyRanking
      deliverablesById,
      90, // longLeadThresholdDays
      {} // no barriers
    );

    // Block should be recommended (not filtered)
    expect(recommendationWithoutBarrier).toBeDefined();
    expect(recommendationWithoutBarrier.type).toBe('execute');
    expect(recommendationWithoutBarrier.blockId).toBe('block-1');

    // With barrier filter (new behavior)
    const recommendationWithBarrier = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      {}, // urgencyRanking
      deliverablesById,
      90, // longLeadThresholdDays
      barriersById // barriers active
    );

    // Block should NOT be recommended (filtered out by barrier)
    expect(recommendationWithBarrier).toBeNull();
  });

  it('allows blocks with no deliverable ID even when barriers are active', () => {
    const goal = 'Complete work';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-08-03';

    const barrier = {
      id: 'barrier-legal-entity-1-project-1',
      type: 'legalFormation',
      projectId: 'project-1',
      claimType: 'CONSTRAINT',
    };

    // Block with no deliverable ID (not linked to any project)
    const blocks = [
      {
        id: 'block-orphan',
        start: '2026-08-03T09:00:00Z',
        end: '2026-08-03T10:00:00Z',
        durationMinutes: 60,
        domain: 'FOCUS',
        // No deliverableId
      },
    ];

    const barriersById = { 'barrier-legal-entity-1-project-1': barrier };

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      {},
      {},
      90,
      barriersById
    );

    // Block should be recommended (no project linkage, so barrier doesn't apply)
    expect(recommendation).toBeDefined();
    expect(recommendation.type).toBe('execute');
    expect(recommendation.blockId).toBe('block-orphan');
  });

  it('allows blocks linked to projects WITHOUT barriers', () => {
    const goal = 'Complete work';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-08-03';

    // Barrier on a DIFFERENT project
    const barrier = {
      id: 'barrier-legal-entity-1-project-2',
      type: 'legalFormation',
      projectId: 'project-2', // Different project!
      claimType: 'CONSTRAINT',
    };

    // Deliverable linked to project-1 (NOT project-2)
    const deliverable = {
      id: 'deliv-free',
      name: 'Free Deliverable',
      owningProjectId: 'project-1',
      owningInitiativeId: 'init-1',
    };

    // Block linked to the NON-blocked project
    const blocks = [
      {
        id: 'block-free',
        start: '2026-08-03T09:00:00Z',
        end: '2026-08-03T10:00:00Z',
        durationMinutes: 60,
        domain: 'FOCUS',
        practice: 'FOCUS',
        deliverableId: 'deliv-free',
      },
    ];

    const deliverablesById = { 'deliv-free': deliverable };
    const barriersById = { 'barrier-legal-entity-1-project-2': barrier };

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      {},
      deliverablesById,
      90,
      barriersById
    );

    // Block should be recommended (project is not blocked)
    expect(recommendation).toBeDefined();
    expect(recommendation.type).toBe('execute');
    expect(recommendation.blockId).toBe('block-free');
  });

  it('only filters blocks for CONSTRAINT-level barriers (ignores other levels)', () => {
    const goal = 'Complete work';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-08-03';

    const deliverable = {
      id: 'deliv-info',
      name: 'Informational Deliverable',
      owningProjectId: 'project-1',
      owningInitiativeId: 'init-1',
    };

    // Barrier with INFO level (not CONSTRAINT)
    const barrierInfo = {
      id: 'barrier-info',
      type: 'legalFormation',
      projectId: 'project-1',
      claimType: 'INFO', // Not CONSTRAINT
    };

    const blocks = [
      {
        id: 'block-info',
        start: '2026-08-03T09:00:00Z',
        end: '2026-08-03T10:00:00Z',
        durationMinutes: 60,
        domain: 'FOCUS',
        practice: 'FOCUS',
        deliverableId: 'deliv-info',
      },
    ];

    const deliverablesById = { 'deliv-info': deliverable };
    const barriersById = { 'barrier-info': barrierInfo };

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      {},
      deliverablesById,
      90,
      barriersById
    );

    // Block should be recommended (barrier is not CONSTRAINT-level)
    expect(recommendation).toBeDefined();
    expect(recommendation.type).toBe('execute');
    expect(recommendation.blockId).toBe('block-info');
  });

  it('applies applyBarrierHardFilter() directly to exclude blocked project blocks', () => {
    const deliverable = {
      id: 'deliv-1',
      owningProjectId: 'project-blocked',
    };

    const barrier = {
      id: 'barrier-1',
      type: 'legalFormation',
      projectId: 'project-blocked',
      claimType: 'CONSTRAINT',
    };

    const blocks = [
      { id: 'b1', deliverableId: 'deliv-1' },
      { id: 'b2', deliverableId: null }, // orphan
      { id: 'b3', deliverableId: 'deliv-unknown' }, // unknown deliverable
    ];

    const deliverablesById = { 'deliv-1': deliverable };
    const barriersById = { 'barrier-1': barrier };

    const filtered = applyBarrierHardFilter(blocks, barriersById, deliverablesById);

    // b1 filtered out (deliverable → project-blocked → barrier)
    // b2 allowed (no deliverable)
    // b3 allowed (deliverable unknown)
    expect(filtered.length).toBe(2);
    expect(filtered.some(b => b.id === 'b1')).toBe(false);
    expect(filtered.some(b => b.id === 'b2')).toBe(true);
    expect(filtered.some(b => b.id === 'b3')).toBe(true);
  });
});
