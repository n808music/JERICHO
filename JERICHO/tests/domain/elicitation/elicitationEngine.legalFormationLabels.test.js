import { describe, it, expect } from 'vitest';
import { PROJECT_SLOT } from '../../../src/domain/elicitation/slots/projectSlot.js';
import { REPROBES } from '../../../src/domain/elicitation/reprobes.js';
import { ENTITY_SLOT } from '../../../src/domain/elicitation/entitySlot';

describe('Legal Formation Gate vs Status Label Separation', () => {
  it('PROJECT_LEGAL_FORMATION_MISSING gate uses legalFormationPrerequisiteOptions pickSet', () => {
    // Find the legal formation gate in PROJECT_SLOT
    const legalFormationGate = PROJECT_SLOT.gate.find(
      (g) => g.code === 'PROJECT_LEGAL_FORMATION_MISSING'
    );
    expect(legalFormationGate).toBeDefined();
    // This is the key constraint: the gate must NOT use yesNoOptions (which are status labels)
    expect(legalFormationGate.pickSet).toBe('legalFormationPrerequisiteOptions');
  });

  it('PROJECT_LEGAL_FORMATION_MISSING reprobe uses legalFormationPrerequisiteOptions pickSet', () => {
    const reprobe = REPROBES.PROJECT_LEGAL_FORMATION_MISSING;
    expect(reprobe).toBeDefined();
    expect(reprobe.pickSet).toBe('legalFormationPrerequisiteOptions');
  });

  it('entity legallyFormed status field STILL uses yesNoOptions (not the new prerequisite set)', () => {
    // Find the legal status gate in ENTITY_SLOT
    const entityLegalStatusGate = ENTITY_SLOT.gate.find(
      (g) => g.code === 'ENTITY_LEGAL_STATUS_MISSING'
    );
    expect(entityLegalStatusGate).toBeDefined();
    // Verify that entitySlot was NOT changed to use the new prerequisite pickSet
    // It should still use yesNoOptions for status
    expect(entityLegalStatusGate.pickSet).toBe('yesNoOptions');
  });

  it('gate and status pickSets are NOT the same (preventing conflation)', () => {
    const gatePickSetName = PROJECT_SLOT.gate.find(
      (g) => g.code === 'PROJECT_LEGAL_FORMATION_MISSING'
    )?.pickSet;

    const statusPickSetName = ENTITY_SLOT.gate.find(
      (g) => g.code === 'ENTITY_LEGAL_STATUS_MISSING'
    )?.pickSet;

    // This constraint prevents future refactoring from accidentally re-conflating the two
    expect(gatePickSetName).not.toBe(statusPickSetName);
  });
});
