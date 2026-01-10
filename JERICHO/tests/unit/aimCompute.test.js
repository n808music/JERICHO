import { describe, expect, it } from 'vitest';
import { computeGoalProfile, getTodayCandidates, scoreCandidate, computeNextBestMove } from '../../src/state/aimCompute.js';

describe('aimCompute', () => {
  it('urgency band thresholds', () => {
    expect(computeGoalProfile('goal', null, '2025-01-01').urgencyBand).toBe('low');
    expect(computeGoalProfile('goal', '2025-01-10', '2025-01-01').urgencyBand).toBe('high');
    expect(computeGoalProfile('goal', '2025-02-20', '2025-01-01').urgencyBand).toBe('medium');
  });

  it('domain inference by keywords', () => {
    expect(computeGoalProfile('grow revenue and clients', null, '2025-01-01').dominantDomain).toBe('RESOURCES');
    expect(computeGoalProfile('publish an album', null, '2025-01-01').dominantDomain).toBe('CREATION');
    expect(computeGoalProfile('improve sleep and workout', null, '2025-01-01').dominantDomain).toBe('BODY');
    expect(computeGoalProfile('general focus', null, '2025-01-01').dominantDomain).toBe('FOCUS');
  });

  it('candidate generation adds scheduled, gap_fill, first_move', () => {
    const blocks = [
      { id: '1', start: '2025-01-01T09:00:00', domain: 'CREATION', durationMinutes: 30, status: 'pending' }
    ];
    const scheduled = getTodayCandidates(blocks, '2025-01-01');
    expect(scheduled.find((c) => c.kind === 'scheduled_block')).toBeTruthy();
    const directive = computeNextBestMove('grow revenue', null, [], [], '2025-01-01');
    expect(directive.type).toBe('schedule'); // first_move when zero blocks
  });

  it('scoring prefers dominant domain', () => {
    const profile = computeGoalProfile('publish album', '2025-12-31', '2025-01-01');
    const a = { kind: 'scheduled_block', blockId: 'a', domain: profile.dominantDomain, durationMinutes: 30 };
    const b = { kind: 'scheduled_block', blockId: 'b', domain: 'FOCUS', durationMinutes: 30 };
    const scoreA = scoreCandidate(a, profile, []);
    const scoreB = scoreCandidate(b, profile, []);
    expect(scoreA.score).toBeGreaterThan(scoreB.score);
  });

  it('tie-breaking is stable (score -> duration -> start -> lex)', () => {
    const profile = computeGoalProfile('focus work', '2025-12-31', '2025-01-01');
    const blocks = [];
    const candidates = [
      { kind: 'scheduled_block', blockId: 'b', domain: profile.dominantDomain, durationMinutes: 30, startISO: '2025-01-01T09:00:00' },
      { kind: 'scheduled_block', blockId: 'a', domain: profile.dominantDomain, durationMinutes: 30, startISO: '2025-01-01T09:00:00' }
    ];
    const directive = computeNextBestMove('focus work', '2025-12-31', candidates.map((c) => ({ id: c.blockId, start: c.startISO, domain: c.domain, durationMinutes: c.durationMinutes, status: 'pending' })), blocks, '2025-01-01');
    expect(directive.blockId).toBe('a'); // lexical tie-break
  });

  it('computeNextBestMove executes pending dominant block when present', () => {
    const blocks = [
      { id: '1', start: '2025-01-01T09:00:00', domain: 'CREATION', durationMinutes: 30, status: 'pending' },
      { id: '2', start: '2025-01-01T10:00:00', domain: 'FOCUS', durationMinutes: 30, status: 'pending' }
    ];
    const directive = computeNextBestMove('publish album', '2025-12-31', blocks, [], '2025-01-01');
    expect(directive.type).toBe('execute');
    expect(directive.blockId).toBe('1');
  });

  it('computeNextBestMove schedules when no dominant pending block exists', () => {
    const blocks = [{ id: '2', start: '2025-01-01T10:00:00', domain: 'FOCUS', durationMinutes: 30, status: 'pending' }];
    const directive = computeNextBestMove('publish album', '2025-12-31', blocks, [], '2025-01-01');
    expect(directive.type).toBe('schedule');
    expect(directive.durationMinutes).toBe(30);
  });
});
