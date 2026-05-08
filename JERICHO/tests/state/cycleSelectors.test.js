import { describe, expect, it } from 'vitest';
import {
  getActiveGoalOutcomes,
  getCanonicalCycleActions,
  getCanonicalLongHorizonPlanMetadata,
} from '../../src/state/cycleSelectors.js';

describe('cycle selectors', () => {
  it('returns terminal outcomes only for active cycles', () => {
    const cycles = {
      'cycle-a': {
        id: 'cycle-a',
        status: 'active',
        goalContract: { terminalOutcome: { text: 'Complete the album' } },
      },
      'cycle-b': {
        id: 'cycle-b',
        status: 'ended',
        goalContract: { terminalOutcome: { text: 'Complete the proposal' } },
      },
      'cycle-c': {
        id: 'cycle-c',
        status: 'active',
        goalContract: { goalText: 'Finish the book' },
      },
    };
    const outcomes = getActiveGoalOutcomes(cycles);
    expect(outcomes).toContain('Complete the album');
    expect(outcomes).toContain('Finish the book');
    expect(outcomes).not.toContain('Complete the proposal');
  });

  it('returns an empty array when no active cycles exist', () => {
    const cycles = {
      'cycle-x': { id: 'cycle-x', status: 'ended', goalContract: { terminalOutcome: { text: 'Legacy goal' } } },
    };
    expect(getActiveGoalOutcomes(cycles)).toEqual([]);
  });

  it('normalizes canonical actions across legacy dependency, readiness, and assumption fields', () => {
    const actions = getCanonicalCycleActions({
      id: 'cycle-1',
      llmActionGraph: {
        actions: [
          {
            id: 'validate:001:customer-interviews',
            title: 'Map riskiest assumptions for landing page',
            dependsOn: [],
            readiness: 'Need interview target list',
            assumption: 'ICP is still assumed',
          },
          {
            id: 'build:001:landing-page',
            title: 'Deploy landing page with signup flow',
            dependencyIds: ['validate:001:customer-interviews'],
            readinessConditions: ['Copy approved'],
            assumptions: ['Hosting stack is already available'],
          },
          {
            id: 'custom:001',
            title: 'Work on thing',
          },
        ],
      },
    });

    expect(actions[0].actionType).toBe('preparation');
    expect(actions[0].dependencies).toEqual([]);
    expect(actions[0].readinessCondition).toBe('Need interview target list');
    expect(actions[0].assumptions).toEqual(['ICP is still assumed']);

    expect(actions[1].actionType).toBe('execution');
    expect(actions[1].dependencies).toEqual(['validate:001:customer-interviews']);
    expect(actions[1].dependencyIds).toEqual(['validate:001:customer-interviews']);
    expect(actions[1].readinessConditions).toEqual(['Copy approved']);
    expect(actions[1].assumptions).toEqual(['Hosting stack is already available']);

    expect(actions[2].actionType).toBeUndefined();
  });

  it('derives canonical long-horizon phase structure and pacing from scaffold groups and scheduled blocks', () => {
    const cycle = {
      id: 'cycle-long',
      goalContract: {
        startDayKey: '2026-03-01',
        endDayKey: '2026-05-31',
      },
      actions: [
        { id: 'prep:001', title: 'Define project scope', actionType: 'preparation' },
        { id: 'build:001', title: 'Ship first milestone', actionType: 'execution' },
        { id: 'build:002', title: 'Ship second milestone', actionType: 'execution' },
      ],
    };
    const workspace = {
      deliverables: [
        { id: 'd1', title: 'Scope package', actionIds: ['prep:001'] },
        { id: 'd2', title: 'Milestone one', actionIds: ['build:001'] },
        { id: 'd3', title: 'Milestone two', actionIds: ['build:002'] },
      ],
      scaffoldGroups: [
        { id: 'phase-prep', title: 'Preparation', type: 'phase', actionIds: ['prep:001'], deliverableIds: ['d1'] },
        {
          id: 'phase-build',
          title: 'Execution',
          type: 'phase',
          actionIds: ['build:001', 'build:002'],
          deliverableIds: ['d2', 'd3'],
        },
      ],
    };
    const blocks = [
      {
        id: 'b1',
        actionId: 'prep:001',
        deliverableId: 'd1',
        startISO: '2026-03-03T14:00:00.000Z',
        durationMinutes: 60,
      },
      {
        id: 'b2',
        actionId: 'build:001',
        deliverableId: 'd2',
        startISO: '2026-04-10T14:00:00.000Z',
        durationMinutes: 90,
      },
      {
        id: 'b3',
        actionId: 'build:002',
        deliverableId: 'd3',
        startISO: '2026-05-14T14:00:00.000Z',
        durationMinutes: 90,
      },
    ];

    const metadata = getCanonicalLongHorizonPlanMetadata(cycle, workspace, blocks);

    expect(metadata.isLongHorizon).toBe(true);
    expect(metadata.phaseSource).toBe('scaffold_groups');
    expect(metadata.phases).toHaveLength(2);
    expect(metadata.phases[0].phaseMode).toBe('preparation');
    expect(metadata.phases[1].phaseMode).toBe('execution');
    expect(metadata.uncertainty.source).toBe('phase_bands');
    expect(metadata.uncertainty.bands.map((band) => band.certainty)).toEqual(['firm', 'provisional']);
    expect(metadata.checkpoints).toHaveLength(1);
    expect(metadata.checkpoints[0].checkpointReason).toBe('phase_transition_review');
    expect(metadata.saturation.saturationShape).toBe('balanced');
    expect(metadata.quality.state).toBe('trusted');
    expect(metadata.pacing.buckets.map((bucket) => bucket.bucketId)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(metadata.pacing.shape).toBe('distributed');
  });

  it('keeps simple plans honestly unphased', () => {
    const metadata = getCanonicalLongHorizonPlanMetadata(
      {
        id: 'cycle-short',
        goalContract: { startDayKey: '2026-03-01', endDayKey: '2026-03-20' },
        actions: [{ id: 'a1', title: 'Do work', actionType: 'execution' }],
      },
      {
        deliverables: [{ id: 'd1', title: 'Output', actionIds: ['a1'] }],
        scaffoldGroups: [
          { id: 'phase-1', title: 'Only phase', type: 'phase', actionIds: ['a1'], deliverableIds: ['d1'] },
        ],
      },
      [{ id: 'b1', actionId: 'a1', deliverableId: 'd1', startISO: '2026-03-05T14:00:00.000Z', durationMinutes: 60 }]
    );

    expect(metadata.isLongHorizon).toBe(false);
    expect(metadata.phases).toEqual([]);
    expect(metadata.uncertainty.bands).toEqual([]);
    expect(metadata.checkpoints).toEqual([]);
    expect(metadata.quality.state).toBe('not_applicable');
  });

  it('marks heavily front-loaded long-horizon pacing as front_loaded without inventing a score', () => {
    const metadata = getCanonicalLongHorizonPlanMetadata(
      {
        id: 'cycle-front',
        goalContract: { startDayKey: '2026-03-01', endDayKey: '2026-05-31' },
        actions: [{ id: 'a1', title: 'Do work', actionType: 'execution' }],
      },
      {
        deliverables: [{ id: 'd1', title: 'Output', actionIds: ['a1'] }],
        scaffoldGroups: [],
      },
      [
        { id: 'b1', actionId: 'a1', deliverableId: 'd1', startISO: '2026-03-01T09:00:00.000Z', durationMinutes: 60 },
        { id: 'b2', actionId: 'a1', deliverableId: 'd1', startISO: '2026-03-02T09:00:00.000Z', durationMinutes: 60 },
        { id: 'b3', actionId: 'a1', deliverableId: 'd1', startISO: '2026-03-03T09:00:00.000Z', durationMinutes: 60 },
        { id: 'b4', actionId: 'a1', deliverableId: 'd1', startISO: '2026-04-20T09:00:00.000Z', durationMinutes: 60 },
      ]
    );

    expect(metadata.isLongHorizon).toBe(true);
    expect(metadata.pacing.shape).toBe('front_loaded');
    expect(metadata.quality.reasonCodes).toContain('LONG_HORIZON_PACING_WEAK');
  });

  it('keeps assumptions distinct from temporal uncertainty in canonical long-horizon metadata', () => {
    const metadata = getCanonicalLongHorizonPlanMetadata(
      {
        id: 'cycle-uncertain',
        goalContract: { startDayKey: '2026-03-01', endDayKey: '2026-05-31' },
        actions: [
          { id: 'prep:001', title: 'Prepare scope', actionType: 'preparation', assumptions: ['Audience fit assumed'] },
          { id: 'build:001', title: 'Ship output', actionType: 'execution' },
        ],
      },
      {
        deliverables: [
          { id: 'd1', title: 'Scope package', actionIds: ['prep:001'] },
          { id: 'd2', title: 'Output package', actionIds: ['build:001'] },
        ],
        scaffoldGroups: [
          { id: 'phase-prep', title: 'Preparation', type: 'phase', actionIds: ['prep:001'], deliverableIds: ['d1'] },
          { id: 'phase-build', title: 'Execution', type: 'phase', actionIds: ['build:001'], deliverableIds: ['d2'] },
        ],
      },
      [
        {
          id: 'b1',
          actionId: 'prep:001',
          deliverableId: 'd1',
          startISO: '2026-03-02T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b2',
          actionId: 'build:001',
          deliverableId: 'd2',
          startISO: '2026-05-10T09:00:00.000Z',
          durationMinutes: 60,
        },
      ]
    );

    expect(metadata.uncertainty.bands[1].reasonCode).toBe('FUTURE_PHASE_STRUCTURE_PROVISIONAL');
    expect(metadata.uncertainty.bands.some((band) => String(band.reasonCode || '').includes('ASSUMPTION'))).toBe(false);
    expect(metadata.checkpoints[0].checkpointLabel).toContain('Review Preparation before Execution');
  });

  it('degrades overloaded long-horizon structure with explicit saturation reason codes', () => {
    const metadata = getCanonicalLongHorizonPlanMetadata(
      {
        id: 'cycle-overloaded',
        goalContract: { startDayKey: '2026-03-01', endDayKey: '2026-05-31' },
        actions: [
          { id: 'prep:001', title: 'Prepare scope', actionType: 'preparation' },
          { id: 'build:001', title: 'Ship output one', actionType: 'execution' },
          { id: 'build:002', title: 'Ship output two', actionType: 'execution' },
        ],
      },
      {
        deliverables: [
          { id: 'd1', title: 'Prep', actionIds: ['prep:001'] },
          { id: 'd2', title: 'Output one', actionIds: ['build:001'] },
          { id: 'd3', title: 'Output two', actionIds: ['build:002'] },
        ],
        scaffoldGroups: [
          { id: 'phase-prep', title: 'Preparation', type: 'phase', actionIds: ['prep:001'], deliverableIds: ['d1'] },
          {
            id: 'phase-exec',
            title: 'Execution',
            type: 'phase',
            actionIds: ['build:001', 'build:002'],
            deliverableIds: ['d2', 'd3'],
          },
        ],
      },
      [
        {
          id: 'b1',
          actionId: 'prep:001',
          deliverableId: 'd1',
          startISO: '2026-03-02T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b2',
          actionId: 'build:001',
          deliverableId: 'd2',
          startISO: '2026-03-03T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b3',
          actionId: 'build:002',
          deliverableId: 'd3',
          startISO: '2026-03-04T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b4',
          actionId: 'build:001',
          deliverableId: 'd2',
          startISO: '2026-03-05T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b5',
          actionId: 'build:002',
          deliverableId: 'd3',
          startISO: '2026-03-06T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b6',
          actionId: 'build:001',
          deliverableId: 'd2',
          startISO: '2026-04-10T09:00:00.000Z',
          durationMinutes: 60,
        },
        {
          id: 'b7',
          actionId: 'build:002',
          deliverableId: 'd3',
          startISO: '2026-05-10T09:00:00.000Z',
          durationMinutes: 60,
        },
      ]
    );

    expect(metadata.saturation.saturationShape).toBe('overloaded');
    expect(metadata.quality.state).toBe('degraded');
    expect(metadata.quality.reasonCodes).toContain('LONG_HORIZON_OVERLOADED');
  });

  it('degrades under-structured long-horizon plans with explicit temporal reason codes', () => {
    const metadata = getCanonicalLongHorizonPlanMetadata(
      {
        id: 'cycle-understructured',
        goalContract: { startDayKey: '2026-03-01', endDayKey: '2026-05-31' },
        actions: [{ id: 'build:001', title: 'Ship sparse output', actionType: 'execution' }],
      },
      {
        deliverables: [{ id: 'd1', title: 'Sparse output', actionIds: ['build:001'] }],
        scaffoldGroups: [],
      },
      [
        {
          id: 'b1',
          actionId: 'build:001',
          deliverableId: 'd1',
          startISO: '2026-03-15T09:00:00.000Z',
          durationMinutes: 60,
        },
      ]
    );

    expect(metadata.saturation.saturationShape).toBe('understructured');
    expect(metadata.quality.state).toBe('withheld');
    expect(metadata.quality.reasonCodes).toContain('LONG_HORIZON_PHASE_STRUCTURE_MISSING');
    expect(metadata.quality.reasonCodes).toContain('LONG_HORIZON_UNDERSTRUCTURED');
    expect(metadata.quality.reasonCodes).toContain('LONG_HORIZON_TEMPORAL_TRUTH_THIN');
  });
});
