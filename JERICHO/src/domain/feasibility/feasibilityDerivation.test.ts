import { describe, expect, it } from 'vitest';
import { deriveFeasibility } from './feasibilityDerivation';
import { gumBrandFounderIntake } from '../../../tests/fixtures/gumBrandFounderIntake';
import { prePlanFeasibility } from '../goal/prePlanFeasibility';

const basePlan = {
  actions: [
    { id: 'a1', title: "Define the Founder's Journey content series" },
    { id: 'a2', title: 'Capital checkpoint 4 - MOQ production deposit', capitalGateId: 'moq_production_deposit' },
    { id: 'a3', title: 'Dead space management - production queue' },
  ],
  scheduledBlocks: [
    {
      id: 'b1',
      title: "Define the Founder's Journey content series",
      actionId: 'a1',
      startISO: '2026-04-24T09:00:00.000Z',
      endISO: '2026-04-24T10:00:00.000Z',
      blockType: 'execution',
    },
    {
      id: 'b2',
      title: 'Capital checkpoint 4 - MOQ production deposit',
      actionId: 'a2',
      startISO: '2026-11-24T09:00:00.000Z',
      endISO: '2026-11-24T10:00:00.000Z',
      blockType: 'capital_checkpoint',
      capitalGateId: 'moq_production_deposit',
    },
    {
      id: 'b3',
      title: 'Dead space management - production queue',
      actionId: 'a3',
      startISO: '2026-08-01T09:00:00.000Z',
      endISO: '2026-09-26T23:59:59.000Z',
      blockType: 'waiting_period',
      minimumDurationBusinessDays: 40,
    },
  ],
  summary: {
    planStatus: 'VALID_AND_FULLY_SCHEDULED',
    horizonDayCount: 463,
    scheduledBlockCount: 3,
  },
  startDayKey: '2026-04-24',
  deadlineDayKey: '2027-07-31',
  prePlanFeasibility: prePlanFeasibility(gumBrandFounderIntake as any),
  capitalAcquisitionFeasibility: prePlanFeasibility(gumBrandFounderIntake as any),
};

describe('feasibilityDerivation', () => {
  it('derives the founder case as viable with identified risks', () => {
    const assessment = deriveFeasibility(basePlan as any, gumBrandFounderIntake as any);

    expect(assessment.overallStatus).toBe('VIABLE_WITH_IDENTIFIED_RISKS');
    expect(assessment.dimensions.capital.rating).toBe('MODERATE');
    expect(assessment.dimensions.market.rating).toBe('MODERATE');
    expect(assessment.topRisks).toHaveLength(3);
  });

  it('includes specific capital math and traces instead of generic statements', () => {
    const assessment = deriveFeasibility(basePlan as any, gumBrandFounderIntake as any);

    expect(assessment.dimensions.capital.explanation).toMatch(/200/);
    expect(assessment.dimensions.capital.explanation).toMatch(/\$8,000|\$8000/);
    expect(assessment.dimensions.capital.explanation).toMatch(/0\.87%/);
    expect(assessment.confidenceStatement).toMatch(/Founder.?s?.?Journey/i);
    expect(assessment.derivedFrom.some((trace) => trace.sourceId === 'capital.conversionRate')).toBe(true);
    expect(assessment.derivedFrom.some((trace) => trace.sourceId === 'timeline.productionRunLeadTime')).toBe(true);
  });

  it('marks a critical timeline mismatch as not viable as stated', () => {
    const impossiblePlan = {
      ...basePlan,
      summary: { ...basePlan.summary, horizonDayCount: 20 },
      deadlineDayKey: '2026-05-15',
    };
    const impossibleIntake = {
      ...gumBrandFounderIntake,
      hardDeadline: '2026-05-15',
    };

    const assessment = deriveFeasibility(impossiblePlan as any, impossibleIntake as any);
    expect(assessment.overallStatus).toBe('NOT_VIABLE_AS_STATED');
    expect(assessment.dimensions.timeline.rating).toBe('CRITICAL');
  });
});
