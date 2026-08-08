import { describe, it, expect } from 'vitest';
import { evaluatePlanQualityGate } from './evaluatePlanQualityGate';

describe('evaluatePlanQualityGate - FEASIBILITY_DEMAND_EXCEEDS_CAPACITY blocking', () => {
  it('should add FEASIBILITY_DEMAND_EXCEEDS_CAPACITY failure code when feasibilityStatus is INFEASIBLE', () => {
    // Test case: BrandLaunch execution type
    // Remaining blocks: 5, upper-bound duration: 720 min/block = 3600 min total Demand
    // Available capacity: 2160 minutes (3 days * 720 min per day)
    // Demand > Capacity → INFEASIBLE → gate should block

    const result = evaluatePlanQualityGate({
      goalText: 'Build and launch a personal brand initiative',
      deliverables: [
        { id: 'd1', title: 'Brand strategy document' },
        { id: 'd2', title: 'Brand visual identity' },
      ],
      actions: [{ id: 'a1', title: 'Research competitive brands', deliverableId: 'd1' }],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Initial brand research',
          deliverableId: 'd1',
          dayKey: '2026-02-01',
        },
        {
          id: 'b2',
          title: 'Develop visual direction',
          deliverableId: 'd2',
          dayKey: '2026-02-02',
        },
      ],
      committedBlocks: [],
      branchCoverageSummary: { declaredBranches: ['d1', 'd2'] },
      temporalContext: {
        contractStartDayKey: '2026-02-01',
        contractEndDayKey: '2026-02-04',
      },
      // Feasibility gate: INFEASIBLE status indicates upper-bound Demand exceeds Capacity
      feasibilityStatus: 'INFEASIBLE',
      insufficientCapacityReasons: ['INSUFFICIENT_CAPACITY'],
    });

    console.log('\n=== FEASIBILITY_DEMAND_EXCEEDS_CAPACITY Gate Test ===');
    console.log(`Gate status: ${result.status}`);
    console.log(`Failure codes: ${result.failureCodes.join(', ')}`);
    console.log(`Reason codes: ${result.reasonCodes.join(', ')}`);

    // The gate should WITHHOLD when feasibility is INFEASIBLE
    expect(result.status).toBe('PLAN_QUALITY_WITHHELD');
    expect(result.failureCodes).toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');
    expect(result.reasonCodes).toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');
    expect(result.reasonCodes).toContain('INSUFFICIENT_CAPACITY');

    console.log(`✓ Plan generation BLOCKED: FEASIBILITY_DEMAND_EXCEEDS_CAPACITY added`);
    console.log(`✓ Gate correctly withheld: status = ${result.status}`);
  });

  it('should not add FEASIBILITY_DEMAND_EXCEEDS_CAPACITY when feasibilityStatus is FEASIBLE', () => {
    // Test case: SkillAcquisition execution type (120 min upper bound)
    // This should PASS the feasibility check

    const result = evaluatePlanQualityGate({
      goalText: 'Learn Spanish conversational fluency',
      deliverables: [
        { id: 'd1', title: 'Spanish vocabulary list' },
        { id: 'd2', title: 'Conversation practice schedule' },
      ],
      actions: [{ id: 'a1', title: 'Study daily vocabulary', deliverableId: 'd1' }],
      proposedBlocks: [
        {
          id: 'b1',
          title: 'Daily vocabulary practice - Day 1',
          deliverableId: 'd1',
          dayKey: '2026-02-01',
        },
        {
          id: 'b2',
          title: 'Daily vocabulary practice - Day 2',
          deliverableId: 'd1',
          dayKey: '2026-02-02',
        },
        {
          id: 'b3',
          title: 'Weekly conversation session',
          deliverableId: 'd2',
          dayKey: '2026-02-08',
        },
      ],
      committedBlocks: [],
      branchCoverageSummary: { declaredBranches: ['d1', 'd2'] },
      temporalContext: {
        contractStartDayKey: '2026-02-01',
        contractEndDayKey: '2026-02-10',
      },
      // Feasibility gate: FEASIBLE status means Demand fits within Capacity
      feasibilityStatus: 'FEASIBLE',
      insufficientCapacityReasons: [],
    });

    console.log('\n=== FEASIBILITY GATE NOT APPLIED (FEASIBLE) Test ===');
    console.log(`Gate status: ${result.status}`);
    console.log(`FEASIBILITY_DEMAND_EXCEEDS_CAPACITY in failureCodes? ${result.failureCodes.includes('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY')}`);

    // The feasibility gate should NOT fire when status is FEASIBLE
    expect(result.failureCodes).not.toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');
    console.log(`✓ Feasibility gate correctly NOT applied: FEASIBLE status passes`);
  });

  it('should not add code when feasibilityStatus is null or REQUIRED', () => {
    // Test with null feasibilityStatus
    const resultNull = evaluatePlanQualityGate({
      goalText: 'Some goal',
      proposedBlocks: [],
      committedBlocks: [],
      branchCoverageSummary: { declaredBranches: [] },
      feasibilityStatus: null,
      insufficientCapacityReasons: [],
    });

    expect(resultNull.failureCodes).not.toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');

    // Test with REQUIRED status
    const resultRequired = evaluatePlanQualityGate({
      goalText: 'Some goal',
      proposedBlocks: [],
      committedBlocks: [],
      branchCoverageSummary: { declaredBranches: [] },
      feasibilityStatus: 'REQUIRED',
      insufficientCapacityReasons: [],
    });

    expect(resultRequired.failureCodes).not.toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');
    console.log(`✓ Feasibility gate only fires when status === 'INFEASIBLE'`);
  });

  it('should include all insufficient capacity reasons in reasonCodes when INFEASIBLE', () => {
    const result = evaluatePlanQualityGate({
      goalText: 'Test goal',
      proposedBlocks: [],
      committedBlocks: [],
      branchCoverageSummary: { declaredBranches: [] },
      feasibilityStatus: 'INFEASIBLE',
      insufficientCapacityReasons: ['INSUFFICIENT_CAPACITY', 'SUBDEADLINE_INFEASIBLE'],
    });

    console.log('\n=== Multiple Reason Codes Test ===');
    console.log(`Reason codes: ${result.reasonCodes.join(', ')}`);

    expect(result.failureCodes).toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');
    expect(result.reasonCodes).toContain('FEASIBILITY_DEMAND_EXCEEDS_CAPACITY');
    expect(result.reasonCodes).toContain('INSUFFICIENT_CAPACITY');
    expect(result.reasonCodes).toContain('SUBDEADLINE_INFEASIBLE');

    console.log(`✓ All reason codes propagated correctly`);
  });
});
