import { describe, expect, it } from 'vitest';

import { resolveBlockPlainLanguage } from './resolveBlockPlainLanguage.js';

describe('resolveBlockPlainLanguage', () => {
  it('translates onboarding launch-blocker work into clear execution guidance', () => {
    const result = resolveBlockPlainLanguage(
      {
        title:
          'Run unit and integration tests for Operation Endgame product platform onboarding implementation using launch blocker clearance for the May 2026 review window',
        laneLabel: 'Operation Endgame app platform',
        startDayKey: '2026-06-08',
      },
      {
        hierarchy: {
          initiative: 'Jericho System',
          lane: 'Product / Software',
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.intent).toMatch(/onboarding and login behavior/i);
    expect(result.steps).toEqual(
      expect.arrayContaining([
        'Open the app as a user.',
        'Sign in and confirm access succeeds.',
        'Refresh and verify profile restoration still lands in the correct context.',
      ])
    );
    expect(result.doneWhen).toMatch(/works without a blocker/i);
    expect(result.originalWindow).toBe('May 2026 review window');
    expect(result.currentWindow).toBe('June 2026 Operating Cycle');
    expect(result.confidence).toBe('high');
  });

  it('falls back to generic guidance when no specialized pattern is matched', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Prepare post-anchor conversion instrumentation for Operation Endgame app platform in product/software lane',
        laneLabel: 'Operation Endgame app platform',
        startDayKey: '2026-06-08',
      },
      {
        hierarchy: {
          initiative: 'Jericho System',
          lane: 'Product / Software',
        },
      }
    );

    expect(result.plainAction).toMatch(/Prepare post-anchor conversion instrumentation/i);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.acceptanceEvidence).toMatch(/Proof that Jericho System progress note exists/i);
    expect(result.confidence).toBe('inferred');
  });
});
