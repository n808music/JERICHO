import { describe, it, expect } from 'vitest';
import { UI_AUTHORITY_MAP } from '../../src/contracts/uiAuthorityMap.ts';

const REQUIRED_IDS = [
  'goal.intake.family',
  'goal.intake.target',
  'goal.intake.deadline',
  'goal.intake.constraints',
  'goal.intake.submit',
  'tabs.structure',
  'tabs.today',
  'tabs.stability',
  'today.nav.prev',
  'today.nav.next',
  'today.nav.today',
  'addBlock.submit',
  'suggestedPath.generatePlan',
  'suggestedPath.applyPlan',
  'proposedBlocks.panel',
  'suggestedPath.accept',
  'suggestedPath.ignore',
  'suggestedPath.dismiss',
  'acceptedBlocks.panel',
  'acceptedBlocks.complete',
  'acceptedBlocks.reschedule',
  'acceptedBlocks.delete',
  'progress.strictMode',
  'whatMovedToday.panel',
  'deliverables.panel',
  'criteria.panel',
  'goal.compile',
  'strategy.save',
  'strategy.regenerate',
  'strategy.rebase',
  'truthPanel.addEntry',
  'patternLens.panel',
  'stability.panel',
  'proof.planProof',
  'proof.probability',
  'proof.conflicts',
  'cycle.switch',
  'cycle.new'
];

describe('UI authority map coverage', () => {
  it('covers required panels and controls', () => {
    REQUIRED_IDS.forEach((id) => {
      expect(UI_AUTHORITY_MAP[id], `missing authority map entry: ${id}`).toBeTruthy();
    });
  });

  it('has valid authority values', () => {
    Object.values(UI_AUTHORITY_MAP).forEach((entry) => {
      expect(entry.authority).toBeTruthy();
    });
  });

  it('does not mark writable entries as reflective', () => {
    Object.values(UI_AUTHORITY_MAP).forEach((entry) => {
      if (entry.writes && entry.writes.length) {
        expect(entry.authority).not.toBe('REFLECTIVE');
      }
    });
  });
});
