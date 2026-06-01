/**
 * Plan quality gate enforces business-development professionalism for
 * commercial/capital/institution/civic lanes (Phase 5 — Execution
 * Professionalism Remediation).
 *
 * BD-required lane families must include at least one external-facing BD
 * execution block AND at least one external stakeholder touchpoint when
 * the lane has active execution work. Capital lanes additionally must
 * declare a budget amount/range or explicit unknown-budget flag.
 */
import { describe, expect, it } from 'vitest';

import { evaluatePlanQualityGate } from './evaluatePlanQualityGate.ts';

function baseInput(proposedBlocks: unknown[]) {
  return {
    goalText: 'goal',
    deliverables: [],
    actions: [],
    proposedBlocks,
    committedBlocks: [],
  } as Parameters<typeof evaluatePlanQualityGate>[0];
}

function actionBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    blockType: 'action',
    title: 'Define service revenue offer',
    dayKey: '2026-06-01',
    phaseLabel: 'P1',
    laneId: 'lane-revenue',
    owner: 'revenue_owner',
    durationMinutes: 60,
    producesArtifact: 'Offer brief with terms',
    consumedBy: ['phase:P2'],
    consumedByRef: { type: 'phaseObjective', id: 'P2' },
    passEvidence: 'Offer brief reviewed and approved',
    executionContext: { laneFamily: 'income_stream', laneStatus: 'active' },
    ...overrides,
  };
}

describe('plan quality gate — MISSING_BD_EXECUTION_MECHANICS', () => {
  it('fires when an active income_stream lane has no external BD execution blocks', () => {
    const blocks = [
      actionBlock({ id: 'b-1', title: 'Define service offer', isExternalBdMechanic: false }),
      actionBlock({ id: 'b-2', blockType: 'review', title: 'Review revenue path', isExternalBdMechanic: false, owner: 'reviewer' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('MISSING_BD_EXECUTION_MECHANICS');
  });

  it('does NOT fire when the lane has at least one external BD execution block', () => {
    const blocks = [
      actionBlock({ id: 'b-1', title: 'Send outreach batch to prospect list', isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true }),
      actionBlock({ id: 'b-2', title: 'Run discovery call with prospect', isExternalBdMechanic: true, isExternalStakeholderTouchpoint: true, producesArtifact: 'Capital budget memo with $50K-100K range' }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_BD_EXECUTION_MECHANICS');
  });

  it('does NOT fire for non-BD lane families (product_software)', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Ship MVP feature',
        owner: 'product_owner',
        executionContext: { laneFamily: 'product_software', laneStatus: 'active' },
        laneId: 'lane-product',
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_BD_EXECUTION_MECHANICS');
  });

  it('does NOT fire when the BD-required lane is gated/blocked/incubating (no active work)', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        blockType: 'readiness',
        title: 'Assess capital readiness',
        owner: 'capital_owner',
        executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'gated' },
        laneId: 'lane-capital',
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_BD_EXECUTION_MECHANICS');
  });
});

describe('plan quality gate — MISSING_EXTERNAL_STAKEHOLDER_TOUCHPOINT', () => {
  it('fires when an active BD-required lane has BD mechanics but no stakeholder touchpoint', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Build prospect list',
        isExternalBdMechanic: true,
        isExternalStakeholderTouchpoint: false,
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('MISSING_EXTERNAL_STAKEHOLDER_TOUCHPOINT');
  });

  it('does NOT fire when the lane has at least one stakeholder touchpoint', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Send outreach to investors',
        isExternalBdMechanic: true,
        isExternalStakeholderTouchpoint: true,
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_EXTERNAL_STAKEHOLDER_TOUCHPOINT');
  });
});

describe('plan quality gate — MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE', () => {
  it('fires when an active capital_real_estate lane has no block with a budget amount/range artifact', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Send outreach to investors',
        owner: 'capital_owner',
        producesArtifact: 'Outreach log with reply status',
        isExternalBdMechanic: true,
        isExternalStakeholderTouchpoint: true,
        executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'active' },
        laneId: 'lane-capital',
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).toContain('MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE');
  });

  it('does NOT fire when a block declares a dollar range in producesArtifact', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Define capital budget for property acquisition',
        owner: 'capital_owner',
        producesArtifact: 'Capital budget memo with $50K-100K range and financing path',
        isExternalBdMechanic: true,
        isExternalStakeholderTouchpoint: true,
        executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'active' },
        laneId: 'lane-capital',
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE');
  });

  it('does NOT fire when a block declares an explicit unknown-budget flag', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Stub capital budget with unknown-budget flag',
        owner: 'capital_owner',
        producesArtifact: 'Capital budget memo with unknown-budget flag requiring resolution',
        isExternalBdMechanic: true,
        isExternalStakeholderTouchpoint: true,
        executionContext: { laneFamily: 'capital_real_estate', laneStatus: 'active' },
        laneId: 'lane-capital',
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE');
  });

  it('does NOT fire for non-capital lane families', () => {
    const blocks = [
      actionBlock({
        id: 'b-1',
        title: 'Define revenue offer',
        owner: 'revenue_owner',
        isExternalBdMechanic: true,
        isExternalStakeholderTouchpoint: true,
        executionContext: { laneFamily: 'income_stream', laneStatus: 'active' },
        laneId: 'lane-revenue',
      }),
    ];
    const result = evaluatePlanQualityGate(baseInput(blocks));
    expect(result.failureCodes).not.toContain('MISSING_CAPITAL_AMOUNT_OR_BUDGET_RANGE');
  });
});
