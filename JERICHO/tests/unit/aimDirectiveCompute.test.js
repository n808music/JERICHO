import { describe, expect, it } from 'vitest';
import { computeGoalProfile, computeNextBestMove, scoreCandidate } from '../../src/state/aimDirectiveCompute.js';

describe('aimDirectiveCompute', () => {
  it('maps goal text to goal profile deterministically', () => {
    const profile = computeGoalProfile('Finish album and publish', '2025-12-31', '2025-12-01');
    expect(profile.goalType).toBe('SHIP_CREATIVE');
    expect(profile.dominantDomain).toBe('CREATION');
    expect(profile.daysRemaining).toBeGreaterThan(0);
    expect(profile.pressure).toBeGreaterThan(0);
  });

  it('pressure increases as deadline approaches', () => {
    const far = computeGoalProfile('Refactor system', '2026-12-31', '2025-12-01');
    const near = computeGoalProfile('Refactor system', '2025-12-10', '2025-12-01');
    expect(near.pressure).toBeGreaterThan(far.pressure);
  });

  it('scores domain match higher than non-match when other factors equal', () => {
    const profile = computeGoalProfile('Publish book', '2025-12-31', '2025-12-01');
    const a = { domain: profile.dominantDomain, title: 'aligned', durationMinutes: 60 };
    const b = { domain: 'FOCUS', title: 'aligned', durationMinutes: 60 };
    const scoreA = scoreCandidate(a, profile, {}, {});
    const scoreB = scoreCandidate(b, profile, {}, {});
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it('tie-breaking is stable by start time then duration then title', () => {
    const profile = computeGoalProfile('Publish book', '2025-12-31', '2025-12-01');
    const candidates = [
      { domain: profile.dominantDomain, title: 'B', durationMinutes: 30, start: '2025-12-01T10:00:00', kind: 'EXECUTE_EXISTING', blockId: '2', date: '2025-12-01' },
      { domain: profile.dominantDomain, title: 'A', durationMinutes: 30, start: '2025-12-01T09:00:00', kind: 'EXECUTE_EXISTING', blockId: '1', date: '2025-12-01' }
    ];
    const directive = computeNextBestMove(candidates, profile, { dayKey: '2025-12-01', patternDiagnostics: {}, userStats: {} });
    expect(directive.blockId).toBe('1'); // earlier start wins
  });
});
