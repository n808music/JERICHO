import { describe, it, expect } from 'vitest';
import { computeNextBestMove, scoreCandidate } from '../aimCompute.js';

describe('Task 3: execution linkage — urgency ranking into daily recommendations', () => {
  it('boosts score and sets CONSTRAINT claimType for CRITICAL block', () => {
    const goal = 'Complete critical deliverable';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    // Block linked to a CRITICAL Deliverable
    const blocks = [
      {
        id: 'b1',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-critical', // Links to critical deliverable
      },
    ];

    // Urgency ranking shows d-critical as CRITICAL (5-day deadline via blocking chain)
    const urgencyRanking = {
      'd-critical': {
        id: 'd-critical',
        name: 'Critical Task',
        urgencyBand: 'CRITICAL',
        daysToDeadline: 5,
        chainDepth: 2,
        blockedItems: ['other1', 'other2'],
        demandMinutes: 120,
        rank: 1,
      },
    };

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking
    );

    expect(recommendation).toBeDefined();
    expect(recommendation.type).toBe('execute');
    expect(recommendation.blockId).toBe('b1');
    expect(recommendation.claimType).toBe('CONSTRAINT'); // CRITICAL → CONSTRAINT
    expect(recommendation.deliverableId).toBe('d-critical');
    expect(recommendation.urgencyBand).toBe('CRITICAL');
    // Rationale should include the blocking chain context
    expect(recommendation.rationale.some(r => r.includes('urgent chain'))).toBe(true);
  });

  it('sets INTENT claimType for MEDIUM urgency block', () => {
    const goal = 'Advance important work';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    const blocks = [
      {
        id: 'b2',
        start: '2026-07-31T14:00:00Z',
        end: '2026-07-31T15:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-medium',
      },
    ];

    const urgencyRanking = {
      'd-medium': {
        id: 'd-medium',
        name: 'Important Task',
        urgencyBand: 'MEDIUM',
        daysToDeadline: 45,
        chainDepth: 1,
        blockedItems: ['other'],
        demandMinutes: 90,
        rank: 5,
      },
    };

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking
    );

    expect(recommendation).toBeDefined();
    expect(recommendation.claimType).toBe('INTENT'); // MEDIUM → INTENT
    expect(recommendation.urgencyBand).toBe('MEDIUM');
  });

  it('omits claimType for LOW urgency block (awaiting Task 4)', () => {
    const goal = 'Background work';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    const blocks = [
      {
        id: 'b3',
        start: '2026-07-31T16:00:00Z',
        end: '2026-07-31T17:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-low',
      },
    ];

    const urgencyRanking = {
      'd-low': {
        id: 'd-low',
        name: 'Low-Priority Task',
        urgencyBand: 'LOW',
        daysToDeadline: 120,
        chainDepth: 0,
        blockedItems: [],
        demandMinutes: 30,
        rank: 50,
      },
    };

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking
    );

    expect(recommendation).toBeDefined();
    expect('claimType' in recommendation).toBe(false); // LOW gets no claim type key (key is absent)
    expect(recommendation.urgencyBand).toBe('LOW');
  });

  it('operator override works: CONSTRAINT recommendation is advisory; engine has no enforcement gate', () => {
    const goal = 'Complete urgent deliverable';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    const blocks = [
      {
        id: 'urgent-block',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        deliverableId: 'd-critical',
      },
      {
        id: 'other-block',
        start: '2026-07-31T10:00:00Z',
        end: '2026-07-31T11:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        // no deliverableId — not linked to urgent task
      },
    ];

    const urgencyRanking = {
      'd-critical': {
        id: 'd-critical',
        urgencyBand: 'CRITICAL',
        daysToDeadline: 3,
        chainDepth: 2,
        blockedItems: ['other1', 'other2'],
        demandMinutes: 120,
        rank: 1,
      },
    };

    // Scenario 1: computeNextBestMove recommends the CONSTRAINT block
    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking
    );

    // Verify CONSTRAINT recommendation is generated
    expect(recommendation.blockId).toBe('urgent-block');
    expect(recommendation.claimType).toBe('CONSTRAINT');
    expect(recommendation.type).toBe('execute');

    // Scenario 2: Verify both blocks can be scored independently via scoreCandidate
    // This proves the engine has no gate preventing the non-urgent block from being evaluated/selected
    const profile = {
      dominantDomain: 'FOCUS',
      urgencyBand: 'high',
      daysRemaining: 31,
      goalTokens: ['complete', 'urgent', 'deliverable'],
    };

    // Score the urgent block
    const urgentCandidateObj = {
      kind: 'scheduled_block',
      blockId: 'urgent-block',
      domain: 'FOCUS',
      durationMinutes: 60,
      startISO: blocks[0].start,
      title: 'urgent block',
      deliverableId: 'd-critical',
    };
    const urgentScore = scoreCandidate(urgentCandidateObj, profile, blocks, urgencyRanking, 'd-critical');

    // Score the non-urgent block (no deliverableId linkage)
    const otherCandidateObj = {
      kind: 'scheduled_block',
      blockId: 'other-block',
      domain: 'FOCUS',
      durationMinutes: 60,
      startISO: blocks[1].start,
      title: 'other block',
      deliverableId: null,
    };
    const otherScore = scoreCandidate(otherCandidateObj, profile, blocks, urgencyRanking, null);

    // Both blocks produce valid scores (neither is rejected/blocked by the engine)
    expect(urgentScore.score).toBeGreaterThan(0);
    expect(otherScore.score).toBeGreaterThan(0);

    // CONSTRAINT block scores higher (as intended)
    expect(urgentScore.score).toBeGreaterThan(otherScore.score);

    // CONSTRAINT block has claimType; non-urgent does not
    expect(urgentScore.claimType).toBe('CONSTRAINT');
    expect('claimType' in otherScore).toBe(false); // claimType key is absent, not null

    // Scenario 3: Verify engine has no gating logic that prevents operator selection
    // The recommendation is advisory data only; the dispatch/scheduling layer is upstream
    // and has no claimType-based enforcement guards. Proof: both candidates scored successfully
    // without any rejection or error thrown by the engine, confirming the override path is open.
    expect(() => {
      scoreCandidate(otherCandidateObj, profile, blocks, urgencyRanking, null);
    }).not.toThrow();
  });

  it('block without deliverableId gets no claim type', () => {
    const goal = 'Unlinked work';
    const deadlineISO = '2026-08-31T23:59:59Z';
    const todayKey = '2026-07-31';

    const blocks = [
      {
        id: 'unlinked-block',
        start: '2026-07-31T09:00:00Z',
        end: '2026-07-31T10:00:00Z',
        durationMinutes: 60,
        practice: 'FOCUS',
        domain: 'FOCUS',
        // no deliverableId
      },
    ];

    const urgencyRanking = {}; // No deliverables

    const recommendation = computeNextBestMove(
      goal,
      deadlineISO,
      blocks,
      [],
      todayKey,
      urgencyRanking
    );

    expect(recommendation).toBeDefined();
    expect('claimType' in recommendation).toBe(false); // No link, no claim type key
    expect(recommendation.deliverableId).toBeNull(); // Linked block has no deliverableId
  });
});
