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

    expect(result.plainAction).toMatch(/Gather the required inputs for post-anchor conversion instrumentation/i);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.expectedOutput).toBe('Prepared post-anchor conversion instrumentation package with required inputs');
    expect(result.doneWhen).toMatch(/assembled with the inputs the next execution step needs to proceed/i);
    expect(result.acceptanceEvidence).toMatch(/included inputs, metadata checks, and any remaining missing-item notes/i);
    expect(result.completionAssertion).toMatch(/Completing this asserts the operator produced/i);
    expect(result.confidence).toBe('high');
  });

  it('keeps generic purpose grammar distinct from action and completion proof', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Validate repeatable conversion path',
        laneLabel: 'Operation Endgame app platform',
        startDayKey: '2026-10-16',
      },
      {
        hierarchy: {
          initiative: 'Jericho System',
          lane: 'Product / Software',
        },
      }
    );

    expect(result.whyThisExists).toMatch(/^(Because|So that|To) /);
    expect(result.whyThisExists).not.toEqual(result.plainAction);
    expect(result.whyThisExists).not.toEqual(result.acceptanceEvidence);
    expect(result.doneWhen).not.toEqual(result.acceptanceEvidence);
    expect(result.expectedOutput).toBe('Validated repeatable conversion path record with findings and next corrections');
    expect(result.acceptanceEvidence).toMatch(/criteria checked, findings, blocking gaps/i);
    expect(result.workType).toBe('Validation');
  });

  it('aligns prepare-title work with planning instead of a stale specialty work type', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Prepare and upload release files for distribution',
        laneLabel: 'Operation Endgame album release engine',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Planning');
    expect(result.whyThisExists).toMatch(/^Because /);
    expect(result.doneWhen).toMatch(/verified distribution package is uploaded/i);
    expect(result.acceptanceEvidence).toMatch(/saved distribution package/i);
  });

  it('translates hard-anchor protection work into concrete validation guidance', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Validate Operation Endgame hard-anchor protection rules',
        laneId: 'brand',
        laneLabel: 'Operations / Systems',
        startDayKey: '2026-06-08',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
          initiative: 'Global State Solutions Foundation',
        },
      }
    );

    expect(result.intent).toMatch(/keep fixed.*anchors from moving/i);
    expect(result.workType).toBe('Validation');
    expect(result.laneLabel).toBe('Global State Solutions Foundation');
    expect(result.entityLabel).toBe('Global State Solutions');
    expect(result.expectedOutput).toBe('Validated hard-anchor rule set');
    expect(result.acceptanceEvidence).toMatch(/hard-anchor protection rule set/i);
    expect(result.completionAssertion).toMatch(/Completing this asserts/i);
  });

  it('treats restored forecast artifact nouns as completed-result outputs', () => {
    const result = resolveBlockPlainLanguage(
      {
        title:
          'Define operator checklist for Operation Endgame brand and operations system in P1 company/operations lane focused on operator checklist coverage for the May 2026 review window',
        laneId: 'brand',
        laneLabel: 'Operation Endgame studio operations system',
        producesArtifact: 'operator control sheet',
        passEvidence: 'Written operator control sheet reviewed against the next operating checkpoint.',
        masterPlanId: 'plan-1',
        derivationReason: 'Derived from P1 phase substrate for the current review window.',
      },
      {
        hierarchy: {
          phase: 'P1',
        },
      }
    );

    expect(result.expectedOutput).toBe('operator control sheet');
    expect(result.quality.failureCodes).not.toContain('MISSING_COMPLETED_ARTIFACT');
  });

  it('renders launch asset inventory work as concrete execution guidance instead of repeating the title', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Document album, app, and podcast launch asset inventory',
        laneLabel: 'Operation Endgame media narrative pipeline',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.intent).toMatch(/which .* launch assets already exist/i);
    expect(result.plainAction).toMatch(/List every album, app, and podcast launch asset/i);
    expect(result.doneWhen).toMatch(/single inventory shows each album, app, and podcast asset/i);
    expect(result.expectedOutput).toBe('Documented launch asset inventory with status and ownership map');
    expect(result.acceptanceEvidence).toMatch(/missing-item flags/i);
    expect(result.quality.failureCodes).not.toContain('TITLE_REPEATED_IN_DO_THIS');
  });

  it('classifies milestone dependency sequence checks as validation with a completed artifact', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Validate first-cycle milestone dependency sequence',
        laneLabel: 'Operation Endgame studio operations system',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Validation');
    expect(result.intent).toMatch(/milestone order is correct/i);
    expect(result.expectedOutput).toBe('Validated first-cycle milestone dependency sequence');
    expect(result.acceptanceEvidence).toMatch(/prerequisite links/i);
  });

  it('renders job-search calendar mapping as a concrete planning artifact', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Map job-search and income demands against the execution calendar',
        laneLabel: 'Operation Endgame services revenue bridge',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Planning');
    expect(result.plainAction).toMatch(/Map every job-search and income obligation onto the execution calendar/i);
    expect(result.expectedOutput).toBe('Mapped job-search and income demand calendar alignment');
    expect(result.acceptanceEvidence).toMatch(/protected execution windows/i);
    expect(result.quality.failureCodes).not.toContain('PLACEHOLDER_EXECUTION_LANGUAGE');
  });

  it('routes timing-slip governance work into the operations system lane with explicit phase justification', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Define timing-slip non-negotiables',
        laneLabel: 'Operations / Systems',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.laneLabel).toBe('Operations / Systems');
    expect(result.entityLabel).toBe('Global State Solutions');
    expect(result.projectLabel).toBe('Operations / Systems');
    expect(result.phaseJustification).toBe('Hard-anchor protection');
    expect(result.expectedOutput).toBe('Defined timing-slip non-negotiable rule set');
  });

  it('renders passive stakeholder-map milestones as concrete planning detail', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Stakeholder map created',
        laneLabel: 'Operation Endgame studio operations system',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.intent).toMatch(/who matters to this lane/i);
    expect(result.expectedOutput).toBe('Documented stakeholder map with asks and next-contact plan');
    expect(result.acceptanceEvidence).toMatch(/follow-up owner/i);
  });

  it('renders media episode recording blocks with a completed artifact instead of repeating the title', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Record next media narrative pipeline episode',
        laneLabel: 'Creative / Entertainment',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
          initiative: 'Help Your Self Broadcast',
        },
      }
    );

    expect(result.entityLabel).toBe('Global State Productions');
    expect(result.projectLabel).toBe('Help Your Self Broadcast');
    expect(result.expectedOutput).toBe('Recorded media narrative episode source session');
    expect(result.quality.failureCodes).not.toContain('TITLE_REPEATED_IN_PRODUCES');
    expect(result.quality.failureCodes).not.toContain('MISSING_COMPLETED_ARTIFACT');
  });

  it('renders product sprint cadence work as a concrete shipped change instead of generic sprint filler', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Complete product platform development sprint — feature, fix, or integration',
        laneLabel: 'Product / Software',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
          initiative: 'The Jericho System',
        },
      }
    );

    expect(result.entityLabel).toBe('Global State Systems');
    expect(result.projectLabel).toBe('The Jericho System');
    expect(result.expectedOutput).toBe('Completed product sprint change set with verified next release target');
    expect(result.quality.failureCodes).not.toContain('ABSTRACT_BLOCK_MEANING');
    expect(result.quality.failureCodes).not.toContain('BLOCK_DETAIL_AMBIGUOUS');
    expect(result.quality.failureCodes).not.toContain('PLACEHOLDER_EXECUTION_LANGUAGE');
  });

  it('renders app store listing cadence work as a completed listing package', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Update Operation Endgame product platform app store listing, metadata, and landing page',
        laneLabel: 'Operation Endgame product platform',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.expectedOutput).toBe('Updated app store listing package with current metadata and landing page copy');
    expect(result.quality.failureCodes).not.toContain('TITLE_REPEATED_IN_PRODUCES');
    expect(result.quality.failureCodes).not.toContain('MISSING_COMPLETED_ARTIFACT');
  });

  it('renders runway income-progress cadence as a concrete evaluation record', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Evaluate Operation Endgame runway bridge income progress and identify next high-leverage action',
        laneLabel: 'Operation Endgame runway bridge',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.expectedOutput).toBe('Evaluated income progress with next high-leverage runway action');
    expect(result.quality.failureCodes).not.toContain('ABSTRACT_BLOCK_MEANING');
    expect(result.quality.failureCodes).not.toContain('BLOCK_DETAIL_AMBIGUOUS');
  });

  it('renders stakeholder-tracker review work with distinct field roles and concrete purpose grammar', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Review stakeholder and partner tracker for Operation Endgame brand and operations system',
        laneLabel: 'Operation Endgame brand and operations system',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Validation');
    expect(result.expectedOutput).toBe('Updated stakeholder and partner tracker with next-contact decisions');
    expect(result.whyThisExists).toMatch(/^Because /);
    expect(result.plainAction).not.toEqual(result.whyThisExists);
    expect(result.doneWhen).not.toEqual(result.expectedOutput);
    expect(result.acceptanceEvidence).not.toEqual(result.whyThisExists);
  });

  it('renders brand positioning brief work as a concrete brief plus next outreach move', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Document positioning brief and next outreach move for Operation Endgame brand and operations system',
        laneLabel: 'Operation Endgame brand and operations system',
        startDayKey: '2026-07-06',
      },
      {
        hierarchy: {
          operatingCycle: 'July 2026 Operating Cycle',
        },
      }
    );

    expect(result.expectedOutput).toBe('Updated positioning brief with prioritized outreach move and message rationale');
    expect(result.acceptanceEvidence).toMatch(/updated message rationale, target audience or partner, chosen outreach move/i);
    expect(result.quality.failureCodes).not.toContain('PRODUCES_TITLE_SHELL');
  });

  it('renders release rollout review work as a reviewed package instead of a title shell', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Review release copy, visual rollout assets, and store metadata for Operation Endgame album release engine',
        laneLabel: 'Operation Endgame album release engine',
        startDayKey: '2026-07-09',
      },
      {
        hierarchy: {
          operatingCycle: 'July 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Validation');
    expect(result.expectedOutput).toBe('Reviewed release rollout package with approved copy, asset fixes, and metadata actions');
    expect(result.acceptanceEvidence).toMatch(/approved copy, visual asset fixes, metadata actions/i);
  });

  it('renders beta feedback review as prioritized next-cycle decisions', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Review Operation Endgame product platform beta feedback and prioritize next development cycle',
        laneLabel: 'Operation Endgame product platform',
        startDayKey: '2026-07-24',
      },
      {
        hierarchy: {
          operatingCycle: 'July 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Validation');
    expect(result.expectedOutput).toBe('Prioritized beta feedback review with next development cycle decisions');
    expect(result.acceptanceEvidence).toMatch(/grouped findings, ranked next-cycle changes, deferred items/i);
    expect(result.quality.failureCodes).not.toContain('MISSING_COMPLETED_ARTIFACT');
  });

  it('renders promo-material preparation as an approved campaign batch', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Prepare Operation Endgame album release engine promo material batch — social, press, and visual assets',
        laneLabel: 'Operation Endgame album release engine',
        startDayKey: '2026-08-20',
      },
      {
        hierarchy: {
          operatingCycle: 'August 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Planning');
    expect(result.expectedOutput).toBe('Prepared promo material batch with approved social, press, and visual assets');
    expect(result.doneWhen).toMatch(/promotion batch exists with approved social, press, and visual assets/i);
  });

  it('renders distribution upload work as a concrete distribution package instead of a title shell', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Prepare and upload release files for distribution',
        laneLabel: 'Operation Endgame album release engine',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Planning');
    expect(result.expectedOutput).toBe('Distribution upload package with verified release files and metadata');
    expect(result.whyThisExists).toMatch(/^Because /);
    expect(result.quality.failureCodes).not.toContain('TITLE_REPEATED_IN_PRODUCES');
    expect(result.acceptanceEvidence).not.toMatch(/linked to the downstream owner/i);
  });

  it('keeps primary distribution submission detail distinct from status verification detail', () => {
    const submission = resolveBlockPlainLanguage(
      {
        title: 'Prepare and upload release files for primary distribution submission',
        laneLabel: 'Operation Endgame album release engine',
        startDayKey: '2026-07-23',
      },
      {
        hierarchy: {
          operatingCycle: 'July 2026 Operating Cycle',
        },
      }
    );
    const verification = resolveBlockPlainLanguage(
      {
        title: 'Prepare and upload release files for distribution status verification',
        laneLabel: 'Operation Endgame album release engine',
        startDayKey: '2026-10-02',
      },
      {
        hierarchy: {
          operatingCycle: 'October 2026 Operating Cycle',
        },
      }
    );

    expect(submission.expectedOutput).toBe('Primary distribution submission package with verified release files and metadata');
    expect(submission.plainAction).toMatch(/submit the package to the main distribution target/i);
    expect(verification.expectedOutput).toBe(
      'Distribution status verification record with current submission outcome and next release action'
    );
    expect(verification.plainAction).toMatch(/verify the live platform status/i);
    expect(verification.whyThisExists).not.toMatch(/\bthe team\b/i);
    expect(verification.quality.failureCodes).not.toContain('FORBIDDEN_GENERIC_OWNER_LANGUAGE');
    expect(verification.quality.failureCodes).not.toContain('MISSING_COMPLETED_ARTIFACT');
    expect(submission.quality.failureCodes).not.toContain('DUPLICATE_BLOCK_BODY');
    expect(verification.quality.failureCodes).not.toContain('DUPLICATE_BLOCK_BODY');
    expect(submission.plainAction).not.toBe(verification.plainAction);
    expect(submission.acceptanceEvidence).not.toBe(verification.acceptanceEvidence);
  });

  it('treats plan-titled content pipeline proof work as planning instead of validation', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Plan content pipeline proof sequence for Operation Endgame media narrative pipeline',
        laneLabel: 'Operation Endgame media narrative pipeline',
        startDayKey: '2026-07-01',
      },
      {
        hierarchy: {
          operatingCycle: 'July 2026 Operating Cycle',
        },
      }
    );

    expect(result.workType).toBe('Planning');
    expect(result.expectedOutput).toBe('Documented podcast pilot distribution proof log');
    expect(result.quality.failureCodes).not.toContain('WORK_TYPE_TITLE_MISMATCH');
    expect(result.quality.failureCodes).not.toContain('MISSING_COMPLETED_ARTIFACT');
  });

  it('flags milestone labels masquerading as execution blocks', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'First revenue event',
        laneLabel: 'Operation Endgame services revenue bridge',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.quality.failureCodes).toContain('MILESTONE_RENDERED_AS_EXECUTION_BLOCK');
  });

  it('flags progress-note artifacts as placeholder execution language', () => {
    const result = resolveBlockPlainLanguage(
      {
        title: 'Coordinate partner readiness',
        laneLabel: 'Operation Endgame services revenue bridge',
        producesArtifact: 'Revenue Bridge progress note',
        startDayKey: '2026-06-20',
      },
      {
        hierarchy: {
          operatingCycle: 'June 2026 Operating Cycle',
        },
      }
    );

    expect(result.quality.failureCodes).toContain('GENERIC_PROGRESS_NOTE_ARTIFACT');
    expect(result.quality.failureCodes).toContain('PLACEHOLDER_EXECUTION_LANGUAGE');
  });
});
