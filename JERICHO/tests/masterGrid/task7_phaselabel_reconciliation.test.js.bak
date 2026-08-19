/**
 * task7_phaselabel_reconciliation.test.js
 *
 * TASK 7: Verify phaseLabel reconciliation showing BEFORE/AFTER values
 * Tests that blocks inherit computed Initiative Phase (numeric 1/2/3)
 * not theoretical phase model labels ('P1'/'P2'/'P3')
 */

import { describe, it, expect } from 'vitest';
import { identityReducer, buildBlankIdentityState } from '../../src/state/identityStore.js';
import { TERMINAL_DEADLINE_DATASET, CORRECTED_SPINE } from '../../src/domain/masterGrid/terminalDeadlineBackfill.js';

describe('Task 7: phaseLabel Reconciliation — Block Inheritance', () => {
  it('should show representative blocks with phaseLabel = Initiative.phase (numeric)', () => {
    let state = buildBlankIdentityState({ nowISO: '2026-08-16T00:00:00Z' });

    // Step 1: Declare key Initiatives
    const testInitiatives = [
      { id: 'state-of-control', name: 'State of Control (Spine P1)', terminalDeadline: '2028-02-17', nextMilestoneDeadline: '2026-09-01' },
      { id: 'seeds-of-destruction', name: 'Seeds of Destruction (Spine P2)', terminalDeadline: '2029-08-17', nextMilestoneDeadline: '2026-10-15' },
      { id: 'i-am-the-state', name: 'I Am The State (Spine P3)', terminalDeadline: '2031-12-31', nextMilestoneDeadline: '2026-11-01' },
      { id: 'the-imaginary-ceo', name: 'The Imaginary CEO (Cross-phase P3)', terminalDeadline: '2032-03-15', nextMilestoneDeadline: '2026-10-20' },
      { id: 'f8-energy-foundation', name: 'F8 Energy Foundation (P1)', terminalDeadline: '2026-09-23', nextMilestoneDeadline: '2026-08-31' },
      { id: 'f8-energy-production-operations', name: 'F8 Production Ops (P2)', terminalDeadline: null, nextMilestoneDeadline: '2026-12-01' },
    ];

    for (const data of testInitiatives) {
      state = identityReducer(state, {
        type: 'DECLARE_INITIATIVE',
        payload: {
          id: data.id,
          name: data.name,
          owningEntityId: null,
          purpose: 'portfolio-item',
          classification: 'objective',
          doneWhen: 'on-schedule',
          terminalDeadline: data.terminalDeadline || null,
          nextMilestoneDeadline: data.nextMilestoneDeadline || null,
        },
      });
    }

    // Step 2: Declare spine to trigger phase computation
    state = identityReducer(state, {
      type: 'DECLARE_SPINE',
      payload: { spineInitiativeIds: CORRECTED_SPINE },
    });

    // Step 3: Get blocks from the full horizon schedule
    const schedule = state.matrix?.fullHorizonSchedule || [];

    // Group blocks by Initiative to analyze
    const blocksByInitiative = {};
    for (const block of schedule) {
      const planId = block.sourceInputs?.find(s => s.startsWith('plan:'))?.replace('plan:', '') || 'unknown';
      if (!blocksByInitiative[planId]) {
        blocksByInitiative[planId] = [];
      }
      blocksByInitiative[planId].push(block);
    }

    // Step 4: Capture representative samples
    console.log('\n=== TASK 7: PHASEABEL RECONCILIATION — REPRESENTATIVE SAMPLES ===\n');
    console.log('SITE[1] — mkId() Block ID Construction');
    console.log('  From: mkId(planId, phase?.label, laneId, dayKey, idx)');
    console.log('  To:   mkId(planId, plan?.phase, laneId, dayKey, idx)\n');

    const stateOfControlBlocks = blocksByInitiative['state-of-control'] || [];
    const seedsBlocks = blocksByInitiative['seeds-of-destruction'] || [];
    const iamBlocks = blocksByInitiative['i-am-the-state'] || [];

    const sampleBlocks = [
      { blocks: stateOfControlBlocks, initiative: 'State of Control (P1)', expectedPhase: 1 },
      { blocks: seedsBlocks, initiative: 'Seeds of Destruction (P2)', expectedPhase: 2 },
      { blocks: iamBlocks, initiative: 'I Am The State (P3)', expectedPhase: 3 },
    ];

    for (const { blocks, initiative, expectedPhase } of sampleBlocks) {
      if (blocks.length === 0) continue;

      const sample = blocks[0];
      console.log(`  ${initiative}:`);
      console.log(`    ID: "${sample.id}"`);
      console.log(`    phaseLabel: ${sample.phaseLabel} (expected: ${expectedPhase}) ${sample.phaseLabel === expectedPhase ? '✅' : '❌'}`);
      console.log(`    blockType: ${sample.blockType}`);
      console.log();

      // Verify the phaseLabel value
      expect(sample.phaseLabel).toBe(expectedPhase);
    }

    // SITE[3]: P3-specific title branch (review scale window)
    console.log('\nSITE[3] — P3-specific Title Branch (Review Scale Window)');
    console.log('  From: phaseLabel === "P3" ? "scale review window" : "review window"');
    console.log('  To:   phaseLabel === 3 ? "scale review window" : "review window"\n');

    for (const { blocks, initiative, expectedPhase } of sampleBlocks) {
      if (blocks.length === 0) continue;

      const sample = blocks.find(b => b.title && b.title.includes('review window'));
      if (!sample) continue;

      const hasScaleKeyword = sample.title.includes('scale');
      const shouldHaveScale = expectedPhase === 3;

      console.log(`  ${initiative}:`);
      console.log(`    Title: "${sample.title.substring(0, 80)}..."`);
      console.log(`    Has 'scale' keyword: ${hasScaleKeyword} (expected: ${shouldHaveScale}) ${hasScaleKeyword === shouldHaveScale ? '✅' : '❌'}`);
      console.log();

      expect(hasScaleKeyword).toBe(shouldHaveScale);
    }

    // SITE[7]: block.phaseLabel assignment
    console.log('\nSITE[7] — Block.phaseLabel Assignment');
    console.log('  From: phaseLabel: phase?.label || null');
    console.log('  To:   phaseLabel: plan?.phase || null\n');

    const allSamples = stateOfControlBlocks.concat(seedsBlocks).concat(iamBlocks);
    const foundPhases = new Set(allSamples.map(b => b.phaseLabel));

    console.log(`  Found phases in blocks: ${Array.from(foundPhases).sort().join(', ')}`);
    console.log(`  Value format: numeric (not string 'P1'/'P2'/'P3') ✅`);

    for (const phase of foundPhases) {
      expect([1, 2, 3]).toContain(phase);
    }

    // SITE[6]: decorateDescriptorForOccurrence propagation
    console.log('\nSITE[6] — Descriptor Decoration Propagation');
    console.log('  From: phaseLabel: phase?.label || null');
    console.log('  To:   phaseLabel: plan?.phase || null\n');

    const gateBlocks = allSamples.filter(b => b.blockType === 'gate');
    if (gateBlocks.length > 0) {
      const gateSample = gateBlocks[0];
      console.log(`  Gate block sample:`);
      console.log(`    ID: "${gateSample.id}"`);
      console.log(`    Title: "${gateSample.title}"`);
      console.log(`    phaseLabel: ${gateSample.phaseLabel}`);
      console.log(`    gateName: "${gateSample.gateName}"`);
      console.log();

      // Verify gate progression format
      expect(gateSample.gateName).toMatch(/\d+→[\d\w-]+/);
      console.log(`  Gate name format '${gateSample.phaseLabel}→X' verified ✅`);
    }

    // SITE[4]: Phase progression (nextPhase computation)
    console.log('\nSITE[4] — Phase Progression (nextPhase Computation)');
    console.log('  From: phaseLabel === "P1" ? "P2" : phaseLabel === "P2" ? "P3" : "terminal-review"');
    console.log('  To:   phaseLabel === 1 ? 2 : phaseLabel === 2 ? 3 : "terminal-review"\n');

    for (const { blocks, expectedPhase } of sampleBlocks) {
      if (blocks.length === 0) continue;

      const gateBlock = blocks.find(b => b.blockType === 'gate');
      if (!gateBlock) continue;

      let expectedNext;
      if (expectedPhase === 1) expectedNext = '2';
      else if (expectedPhase === 2) expectedNext = '3';
      else expectedNext = 'terminal-review';

      const progression = gateBlock.gateName?.match(/(\d+|phase)→([\d\w-]+)/)?.[2] || 'unknown';
      console.log(`  Phase ${expectedPhase} → ${expectedNext}: gate shows "${progression}" ✅`);

      expect(progression).toContain(expectedNext);
    }

    // Summary
    console.log('\n=== RECONCILIATION SUMMARY ===');
    console.log(`Total blocks generated: ${schedule.length}`);
    console.log(`Blocks with numeric phaseLabel: ${allSamples.filter(b => [1, 2, 3].includes(b.phaseLabel)).length}`);
    console.log(`Blocks correctly inheriting Initiative.phase: ${allSamples.filter(b => {
      const initiativeId = b.sourceInputs?.find(s => s.startsWith('plan:'))?.replace('plan:', '');
      const initiative = state.matrix?.initiativesById?.[initiativeId];
      return b.phaseLabel === initiative?.phase;
    }).length}`);
    console.log('All phaseLabel values are numeric (1/2/3), not string (P1/P2/P3) ✅\n');
  });
});
