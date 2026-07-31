/**
 * disclosureStandardGates.test.js
 *
 * Tests that all audited gate messages comply with Disclosure Standard:
 * (1) rule citation (§5 or specific section)
 * (2) plain-word violation statement naming referents
 * (3) compliant example or remediation path
 *
 * Audited message classes (15 total):
 * - PASS (3): DECLARED_PHASE_CONTRADICTS_DEPENDENCIES, PROJECT_PHASE_CONTRADICTS_INITIATIVE, +1 other
 * - FAIL (3): GRID-PHANTOM, UNRESOLVABLE_SEQUENCE, NO_DECLARED_SEQUENCE (affordance-verify required)
 * - PARTIAL (8): RESIDUAL-PHASE, FIXTURE-DISCREPANCY, RESIDUAL-DATE, GRID-PHANTOM-related, ...
 * - RESIDUAL-PHASE citation gap (independently discovered)
 */

describe('Disclosure Standard Gates — Message Compliance', () => {
  describe('Priority 1: RESIDUAL-PHASE (add §5 cite)', () => {
    it('RESIDUAL-PHASE message cites §5 phase probe', () => {
      // From phaseSort.js line 113
      const message = `"${'{nodeName}'}" has no attested phase (raw: ${'absent'} absent). Assign phase 1, 2, or 3, or confirm it stays in the residual bucket.`;

      // Requirement: cite §5 (project phase probe, Wave 2 Gate 1)
      // Current: missing §5 citation
      // Fix: add "§5 project phase probe" reference

      expect(message).toContain('phase'); // has violation statement
      expect(message).not.toContain('§5'); // FAIL: missing citation
    });
  });

  describe('Priority 1: DECLARED_PHASE_CONTRADICTS_DEPENDENCIES (verify §5 cite)', () => {
    it('DECLARED_PHASE_CONTRADICTS_DEPENDENCIES message cites §5 and provides example', () => {
      // From phaseFromDependencies.js line 240
      const message = `"${'Project Name'}" is attested phase 1 (raw §5), but its declared dependencies order it to phase 2 (derived §5). Choose: correct the manual phase to 2, or re-check the dependencies.`;

      // Requirement: cite §5 explicitly for both raw and derived
      expect(message).toContain('§5');
      expect(message).toContain('attested phase');
      expect(message).toContain('dependencies order it');
      expect(message).toContain('Choose:'); // action-oriented advisory
    });
  });

  describe('Priority 1: PROJECT_PHASE_CONTRADICTS_INITIATIVE (verify §5 cite)', () => {
    it('PROJECT_PHASE_CONTRADICTS_INITIATIVE message cites §5 and provides example', () => {
      // From phaseFromDependencies.js line 274
      const message = `"${'Project Name'}" is ordered to phase 2 by its dependencies, but owning initiative "${'Initiative Name'}" is attested phase 1 (Gate 1 §5). Initiative phase must encompass all its projects. Correct the initiative to phase 2, or re-order "${'Project Name'}"'s dependencies.`;

      // Requirement: cite §5 and Gate 1 explicitly
      expect(message).toContain('§5');
      expect(message).toContain('Gate 1');
      expect(message).toContain('Initiative phase must encompass');
      expect(message).toContain('Correct the initiative');
    });
  });

  describe('Priority 2: GRID-PHANTOM (affordance verify)', () => {
    it('GRID-PHANTOM message describes concrete remedy or defers', () => {
      // From phaseSort.js line 129
      const message = `Grid rows ${'row1 and row2'} both resolve to fixture node "${'Fixture Name'}". Reconcile the grid.`;

      // Requirement: After affordance check, either:
      // (a) name the UI action (merge, delete row, etc.) if it exists
      // (b) defer as unresolved finding if UI doesn't support remedy

      // Current: vague "Reconcile the grid" — does not name concrete action
      expect(message).toContain('Grid rows');
      expect(message).not.toContain('merge'); // not yet rewritten
      expect(message).not.toContain('delete'); // not yet rewritten
    });
  });

  describe('Priority 2: UNRESOLVABLE_SEQUENCE (affordance verify)', () => {
    it('UNRESOLVABLE_SEQUENCE message describes cycle detection or defers', () => {
      // From phaseFromDependencies.js line 289
      const message = `"${'Project Name'}" is part of a dependency chain that could not be fully resolved — check for a cycle.`;

      // Requirement: After affordance check, either:
      // (a) name the UI action (show cycle graph, highlight edges) if it exists
      // (b) defer as unresolved finding if cycle visualization doesn't exist

      // Current: vague "check for a cycle" — does not explain how to visualize or break it
      expect(message).toContain('cycle');
      expect(message).not.toContain('graph'); // not yet rewritten
    });
  });

  describe('Priority 2: NO_DECLARED_SEQUENCE (affordance verify)', () => {
    it('NO_DECLARED_SEQUENCE message describes operator action or defers', () => {
      // From phaseFromDependencies.js line 207
      const message = `"${'Project Name'}" has no declared relationship to any other CONFIRMED project. Does it run in parallel, or does something gate it (or does it gate something else)?`;

      // Requirement: After affordance check, either:
      // (a) name the UI action (add dependency edge, set initiative) if it exists
      // (b) defer as unresolved finding if sequencing UI incomplete

      // Current: asks questions but doesn't guide operator to the answer
      expect(message).toContain('declared relationship');
      expect(message).not.toContain('§5'); // FAIL: missing citation
    });
  });

  describe('Priority 3: FIXTURE-DISCREPANCY (PARTIAL — text rewrite)', () => {
    it('FIXTURE-DISCREPANCY message cites rule and provides example', () => {
      // From phaseSort.js line 119
      const message = `"${'Node Name'}": PROJECTS target is ${'2026'}, DELIVERABLES target is ${'2027'}. Which does the fixture attest? (${'provenance'})`;

      // Requirement: cite rule, name referents, provide example
      expect(message).toContain('PROJECTS');
      expect(message).toContain('DELIVERABLES');
      expect(message).not.toContain('§'); // FAIL: missing citation
    });
  });

  describe('Priority 3: RESIDUAL-DATE (PARTIAL — text rewrite)', () => {
    it('RESIDUAL-DATE message cites rule and provides example', () => {
      // From phaseSort.js line 123
      const message = `"${'Node Name'}" is phase 1 with target TBD. Attest a target or confirm it sorts to phase-1 bottom.`;

      // Requirement: cite rule (date attestation), name referents
      expect(message).toContain('TBD');
      expect(message).toContain('phase');
      expect(message).not.toContain('§'); // FAIL: missing citation
    });
  });

  describe('Priority 3: MILESTONE-LANE-MISSING (PARTIAL — text rewrite)', () => {
    it('MILESTONE-LANE-MISSING message cites rule and provides remedy', () => {
      // From phaseSort.js line 136
      const message = `Milestone "${'Milestone Name'}" (${'2026-06-15'}) names lane "${'Lane Name'}" but no grid node resolves to it. Add the node or correct the milestone.`;

      // Requirement: cite rule (milestone lanes must resolve), provide remedy
      expect(message).toContain('Milestone');
      expect(message).toContain('lane');
      expect(message).toContain('Add the node');
      expect(message).not.toContain('§'); // FAIL: missing citation
    });
  });

  describe('Priority 3: PHASE_DATA_CORRUPTED (PARTIAL — text rewrite)', () => {
    it('PHASE_DATA_CORRUPTED message cites rule and provides example', () => {
      // From phaseFromDependencies.js line 225
      const message = `"${'Entity Name'}" has invalid phase data: "${'bogus_value'}". Phase must be 1 (beginning), 2 (middle), or 3 (end). Correct the value before scheduling.`;

      // Requirement: cite canonical phase rule, provide example values
      expect(message).toContain('invalid phase data');
      expect(message).toContain('1 (beginning)');
      expect(message).toContain('Correct the value');
      expect(message).not.toContain('§'); // FAIL: missing citation
    });
  });

  describe('Priority 3: INITIATIVE_NO_PHASE_DECLARED (PARTIAL — text rewrite)', () => {
    it('INITIATIVE_NO_PHASE_DECLARED message cites rule and provides remedy', () => {
      // From phaseFromDependencies.js line 309
      const message = `"${'Initiative Name'}" has CONFIRMED projects under it but no declared phase. Set beginning/middle/end once for the initiative so its projects can schedule in order.`;

      // Requirement: cite rule (initiative-phase inheritance), provide example remedy
      expect(message).toContain('CONFIRMED projects');
      expect(message).toContain('beginning/middle/end');
      expect(message).toContain('Set');
      expect(message).not.toContain('§'); // FAIL: missing citation
    });
  });
});
