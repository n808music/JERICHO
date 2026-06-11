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
        dependsOn: ['proof:launch-blocker-definition'],
        consumedBy: ['phase:P1-launch-proof'],
      },
      {
        hierarchy: {
          initiative: 'Jericho System',
          lane: 'Product / Software',
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.laneLabel).toBe('Product / Software');
    expect(result.intent).toMatch(/onboarding and profile restoration/i);
    expect(result.plainAction).toMatch(/run the live onboarding path like a real user/i);
    expect(result.steps).toEqual(
      expect.arrayContaining([
        'Open the app and complete the sign-in flow.',
        'Refresh the app and confirm profile restoration returns to the correct context.',
      ])
    );
    expect(result.expectedOutput).toMatch(/test report/i);
    expect(result.acceptanceEvidence).toMatch(/passing onboarding test report|blocker log/i);
    expect(result.dependencies.requires).toContain('proof:launch-blocker-definition');
    expect(result.dependencies.unlocks).toContain('phase:P1-launch-proof');
    expect(result.quality.status).toBe('passed');
    expect(result.quality.failureCodes).toEqual([]);
  });

  it('produces lane-specific real estate detail and renames civic/district wording to Real Estate', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Map credibility dependencies for Operation Endgame district coalition development in P2 civic/district lane',
        laneLabel: 'Operation Endgame district coalition development',
        expectedOutput: 'Corridor credibility dependency map',
        passEvidence: 'Dependency map naming capital, legal, and partnership prerequisites',
        dependsOn: ['proof:P1'],
        consumedBy: ['phase:P3'],
        phaseLabel: 'P2',
      },
      { hierarchy: { phase: 'P2', operatingCycle: 'June 2027 Operating Cycle' } }
    );

    expect(result.laneLabel).toBe('Real Estate');
    expect(result.initiativeLabel).toBe('Real Estate');
    expect(result.intent).toMatch(/real-estate lane structurally present/i);
    expect(result.expectedOutput).toBe('Corridor credibility dependency map');
    expect(result.acceptanceEvidence).toMatch(/capital, legal, and partnership prerequisites/i);
    expect(result.dependencies.requires).toContain('proof:P1');
    expect(result.dependencies.unlocks).toContain('phase:P3');
    expect(result.quality.status).toBe('passed');
  });

  it('fails detail quality for unjustified P1 real estate execution', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Decide whether the district execution path is ready for execution',
        laneLabel: 'Operation Endgame district coalition development',
        phaseLabel: 'P1',
      },
      { hierarchy: { phase: 'P1' } }
    );

    expect(result.laneLabel).toBe('Real Estate');
    expect(result.quality.status).toBe('under_specified');
    expect(result.quality.failureCodes).toEqual(
      expect.arrayContaining(['LANE_CONTEXT_NOT_APPLIED', 'BLOCK_DETAIL_AMBIGUOUS'])
    );
  });

  it('keeps passed lane breakdowns distinct across software, music, revenue, and patent work', () => {
    const software = resolveBlockPlainLanguage(
      {
        title: 'Validate onboarding path for Operation Endgame app platform',
        laneLabel: 'Operation Endgame app platform',
        dependsOn: ['artifact:product-spec'],
        consumedBy: ['phase:P1'],
      },
      { hierarchy: { lane: 'Product / Software' } }
    );
    const music = resolveBlockPlainLanguage(
      {
        title: 'Sequence release asset completion for Operation Endgame album release engine',
        laneLabel: 'Operation Endgame album release engine',
        dependsOn: ['artifact:track-draft'],
        consumedBy: ['phase:P1'],
      },
      { hierarchy: { lane: 'Creative / Music' } }
    );
    const revenue = resolveBlockPlainLanguage(
      {
        title: 'Validate immediate revenue path for Operation Endgame services revenue bridge',
        laneLabel: 'Operation Endgame services revenue bridge',
        dependsOn: ['artifact:offer-draft'],
        consumedBy: ['phase:P1'],
      },
      { hierarchy: { lane: 'Revenue' } }
    );
    const patent = resolveBlockPlainLanguage(
      {
        title: 'Prepare provisional patent filing package for gum formulation protection',
        laneLabel: 'capital/ip lane',
        dependsOn: ['artifact:claims-draft'],
        consumedBy: ['phase:P1'],
      },
      { hierarchy: { lane: 'Capital / IP' } }
    );

    expect(software.plainAction).not.toBe(music.plainAction);
    expect(music.expectedOutput).toMatch(/release asset/i);
    expect(revenue.laneLabel).toBe('Revenue');
    expect(revenue.plainAction).toMatch(/commercial|revenue/i);
    expect(patent.acceptanceEvidence).toMatch(/filing packet|memo|signed note/i);
    [software, music, revenue, patent].forEach((result) => {
      expect(result.quality.status).toBe('passed');
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  it('marks ambiguous fallback blocks as under-specified instead of emitting generic execution filler', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Clarify next move',
      },
      {}
    );

    expect(result.quality.status).toBe('under_specified');
    expect(result.quality.failureCodes).toEqual(
      expect.arrayContaining([
        'GENERIC_EXECUTION_INSTRUCTION',
        'MISSING_EXPECTED_OUTPUT',
        'MISSING_ACCEPTANCE_EVIDENCE',
        'MISSING_DEPENDENCY_CONTEXT',
      ])
    );
    expect(result.plainAction).toBe('');
    expect(result.steps).toEqual([]);
  });
});
