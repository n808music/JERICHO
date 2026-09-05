import { describe, it, expect } from 'vitest';
import { ARTIFACT_SLOT, buildArtifactDeclarePayload } from './artifactSlot';

describe('ARTIFACT_SLOT gates', () => {
  describe('ARTIFACT_NAME_MISSING', () => {
    it('detects when name is missing', () => {
      const gate = ARTIFACT_SLOT.gate.find((g) => g.code === 'ARTIFACT_NAME_MISSING')!;
      expect(gate.detect({})).toBe(true);
      expect(gate.detect({ name: '' })).toBe(true);
      expect(gate.detect({ name: null })).toBe(true);
    });

    it('passes when name is present', () => {
      const gate = ARTIFACT_SLOT.gate.find((g) => g.code === 'ARTIFACT_NAME_MISSING')!;
      expect(gate.detect({ name: 'My Artifact' })).toBe(false);
    });
  });

  describe('ARTIFACT_NAME_NOT_HOLDABLE', () => {
    it('detects when name is not a holdable noun', () => {
      const gate = ARTIFACT_SLOT.gate.find((g) => g.code === 'ARTIFACT_NAME_NOT_HOLDABLE')!;
      // Imperative phrase: "Build the API" fails because it has a determiner
      expect(gate.detect({ name: 'build the api' })).toBe(true);
      // Gerund with determiner: "Building the app" fails
      expect(gate.detect({ name: 'building the app' })).toBe(true);
      // Past participle: "Completed analysis" fails
      expect(gate.detect({ name: 'completed analysis' })).toBe(true);
    });

    it('passes when name is a holdable noun', () => {
      const gate = ARTIFACT_SLOT.gate.find((g) => g.code === 'ARTIFACT_NAME_NOT_HOLDABLE')!;
      // "document" is a holdable noun
      expect(gate.detect({ name: 'document' })).toBe(false);
      // "authentication module" is holdable
      expect(gate.detect({ name: 'authentication module' })).toBe(false);
      // "run" is a holdable noun (no determiner after it)
      expect(gate.detect({ name: 'run' })).toBe(false);
      // "Release notes" is holdable (noun compound, no determiner)
      expect(gate.detect({ name: 'release notes' })).toBe(false);
    });
  });

  describe('ARTIFACT_SLUG_EMPTY', () => {
    it('detects when name slugifies to empty string', () => {
      const gate = ARTIFACT_SLOT.gate.find((g) => g.code === 'ARTIFACT_SLUG_EMPTY')!;
      // Special characters only
      expect(gate.detect({ name: '!@#$%' })).toBe(true);
      expect(gate.detect({ name: '---' })).toBe(true);
      expect(gate.detect({ name: '   ' })).toBe(true);
      expect(gate.detect({ name: '!!! ??? +++' })).toBe(true);
    });

    it('passes when name slugifies to non-empty string', () => {
      const gate = ARTIFACT_SLOT.gate.find((g) => g.code === 'ARTIFACT_SLUG_EMPTY')!;
      expect(gate.detect({ name: 'my-artifact' })).toBe(false);
      expect(gate.detect({ name: 'My Artifact' })).toBe(false);
      expect(gate.detect({ name: 'artifact123' })).toBe(false);
      // Leading/trailing special chars are stripped but alphanumeric survives
      expect(gate.detect({ name: '!!!document!!!' })).toBe(false);
      expect(gate.detect({ name: 'a' })).toBe(false);
    });

    it('gate position: runs after ARTIFACT_NAME_NOT_HOLDABLE', () => {
      // Gate order matters: C should run after B
      const gates = ARTIFACT_SLOT.gate.map((g) => g.code);
      const aIdx = gates.indexOf('ARTIFACT_NAME_MISSING');
      const bIdx = gates.indexOf('ARTIFACT_NAME_NOT_HOLDABLE');
      const cIdx = gates.indexOf('ARTIFACT_SLUG_EMPTY');

      expect(aIdx).toBeLessThan(bIdx);
      expect(bIdx).toBeLessThan(cIdx);
    });
  });

  describe('buildArtifactDeclarePayload', () => {
    it('generates valid slug from name', () => {
      const payload = buildArtifactDeclarePayload({ name: 'My Authentication Module' });
      expect(payload.id).toBe('my-authentication-module');
    });

    it('removes special characters from slug', () => {
      const payload = buildArtifactDeclarePayload({ name: 'API & Database (v2)' });
      expect(payload.id).toBe('api-database-v2');
    });

    it('truncates slug to 64 characters', () => {
      const longName = 'a'.repeat(100);
      const payload = buildArtifactDeclarePayload({ name: longName });
      expect(payload.id).toBe('a'.repeat(64));
      expect(payload.id.length).toBe(64);
    });

    it('generates empty slug (no fallback) for special-char-only name', () => {
      const payload = buildArtifactDeclarePayload({ name: '!@#$%' });
      // This will be an empty string (the gate should catch it before reaching here)
      expect(payload.id).toBe('');
    });

    it('includes all fields in payload', () => {
      const payload = buildArtifactDeclarePayload({
        name: 'Test Artifact',
        producingProjectId: 'proj-1',
        consumingProjectIds: ['proj-2', 'proj-3'],
        completionEvidence: 'Test passed',
        verificationSourceId: 'source-1',
        operatorAttestationMethod: 'I verified this',
        notes: 'Some notes',
      });

      expect(payload).toMatchObject({
        id: 'test-artifact',
        name: 'Test Artifact',
        producingProjectId: 'proj-1',
        consumingProjectIds: ['proj-2', 'proj-3'],
        completionEvidence: 'Test passed',
        verificationSourceId: 'source-1',
        operatorAttestationMethod: 'I verified this',
        notes: 'Some notes',
      });
    });
  });

  // ── Step 3: Artifact intake fields ────────────────────────────────
  //
  // These four gates exist so the operator cannot declare an artifact whose
  // satisfaction is undefined or whose deadline is unenforceable. An artifact
  // with no satisfaction_mode cannot be told "done"; one with a past or absent
  // targetDate cannot contribute a real deadline to scheduling; and a buffer
  // anchor without a binding (or the reverse) describes a buffer the scheduler
  // has no rule for. Each test below names the consequence, not just the branch.

  const gateOf = (code: string) => ARTIFACT_SLOT.gate.find((g) => g.code === code)!;

  describe('ARTIFACT_SATISFACTION_MODE_MISSING', () => {
    it('detects when satisfaction_mode is absent — artifact could never be declared satisfied', () => {
      expect(gateOf('ARTIFACT_SATISFACTION_MODE_MISSING').detect({ name: 'Master WAV' })).toBe(true);
    });

    it('detects when satisfaction_mode is an empty string', () => {
      expect(gateOf('ARTIFACT_SATISFACTION_MODE_MISSING').detect({ satisfaction_mode: '' })).toBe(true);
    });

    it('passes when satisfaction_mode is present', () => {
      expect(gateOf('ARTIFACT_SATISFACTION_MODE_MISSING').detect({ satisfaction_mode: 'AND' })).toBe(false);
    });

    it('offers a pickSet so the operator selects rather than free-types the mode', () => {
      expect(gateOf('ARTIFACT_SATISFACTION_MODE_MISSING').pickSet).toBe('artifactSatisfactionModeOptions');
    });

    // Documents a real gap between the two enforcement layers. The slot gate
    // checks presence only; the frozen 'AND' literal is enforced solely by the
    // declareArtifact reducer (ARTIFACT_SATISFACTION_MODE_NOT_YET_SUPPORTED). An
    // operator can therefore clear every slot gate with a bogus mode and still be
    // rejected at dispatch. Asserting it here means the day someone closes that
    // gap, this test fails and forces the decision to be deliberate.
    it('does NOT constrain the value at the slot layer (reducer owns the freeze)', () => {
      expect(gateOf('ARTIFACT_SATISFACTION_MODE_MISSING').detect({ satisfaction_mode: 'MAYBE' })).toBe(false);
      expect(gateOf('ARTIFACT_SATISFACTION_MODE_MISSING').detect({ satisfaction_mode: 'OR' })).toBe(false);
    });
  });

  describe('ARTIFACT_TARGET_DATE_MISSING', () => {
    it('detects when targetDate is absent — artifact contributes no deadline to scheduling', () => {
      expect(gateOf('ARTIFACT_TARGET_DATE_MISSING').detect({ name: 'Master WAV' })).toBe(true);
    });

    it('passes when targetDate is present', () => {
      expect(gateOf('ARTIFACT_TARGET_DATE_MISSING').detect({ targetDate: '2099-01-01' })).toBe(false);
    });
  });

  describe('ARTIFACT_TARGET_DATE_NOT_FUTURE', () => {
    it('stays silent when targetDate is absent so MISSING reports first', () => {
      // Both gates are live at once; without this deferral the operator would be
      // told the date is "not in the future" when they never supplied one.
      expect(gateOf('ARTIFACT_TARGET_DATE_NOT_FUTURE').detect({})).toBe(false);
    });

    it('detects a past date — a deadline already elapsed cannot be planned against', () => {
      expect(gateOf('ARTIFACT_TARGET_DATE_NOT_FUTURE').detect({ targetDate: '2020-01-01' })).toBe(true);
    });

    it('detects an unparseable date rather than silently admitting it', () => {
      expect(gateOf('ARTIFACT_TARGET_DATE_NOT_FUTURE').detect({ targetDate: 'not-a-date' })).toBe(true);
    });

    it('passes for a future date', () => {
      expect(gateOf('ARTIFACT_TARGET_DATE_NOT_FUTURE').detect({ targetDate: '2099-12-31' })).toBe(false);
    });
  });

  describe('ARTIFACT_BUFFER_BINDING_MISMATCH', () => {
    it('passes when both buffer fields are absent — buffers are optional', () => {
      expect(gateOf('ARTIFACT_BUFFER_BINDING_MISMATCH').detect({})).toBe(false);
    });

    it('passes when both buffer fields are present', () => {
      expect(
        gateOf('ARTIFACT_BUFFER_BINDING_MISMATCH').detect({
          buffer_anchor: 'deliv-mastering',
          buffer_binding: 'hard',
        }),
      ).toBe(false);
    });

    it('detects anchor without binding — a buffer the scheduler has no rule for', () => {
      expect(
        gateOf('ARTIFACT_BUFFER_BINDING_MISMATCH').detect({ buffer_anchor: 'deliv-mastering' }),
      ).toBe(true);
    });

    it('detects binding without anchor — a rule with nothing to anchor to', () => {
      expect(gateOf('ARTIFACT_BUFFER_BINDING_MISMATCH').detect({ buffer_binding: 'hard' })).toBe(true);
    });

    it('treats whitespace-only values as absent, so " " cannot fake a pairing', () => {
      expect(
        gateOf('ARTIFACT_BUFFER_BINDING_MISMATCH').detect({
          buffer_anchor: 'deliv-mastering',
          buffer_binding: '   ',
        }),
      ).toBe(true);
    });
  });

  describe('intake gate ladder ordering', () => {
    const codes = ARTIFACT_SLOT.gate.map((g) => g.code);

    it('reports a missing targetDate before judging whether it is in the future', () => {
      expect(codes.indexOf('ARTIFACT_TARGET_DATE_MISSING')).toBeLessThan(
        codes.indexOf('ARTIFACT_TARGET_DATE_NOT_FUTURE'),
      );
    });

    it('places intake gates after the pre-existing identity and evidence gates', () => {
      // Intake questions are only worth asking once the artifact is a real,
      // attributable thing; asking for a target date on an unnamed artifact
      // inverts the interview.
      expect(codes.indexOf('ARTIFACT_ATTESTATION_METHOD_NOT_SUBSTANTIVE')).toBeLessThan(
        codes.indexOf('ARTIFACT_SATISFACTION_MODE_MISSING'),
      );
    });

    it('declares all four Step 3 gates exactly once', () => {
      const step3 = [
        'ARTIFACT_SATISFACTION_MODE_MISSING',
        'ARTIFACT_TARGET_DATE_MISSING',
        'ARTIFACT_TARGET_DATE_NOT_FUTURE',
        'ARTIFACT_BUFFER_BINDING_MISMATCH',
      ];
      step3.forEach((code) => {
        expect(codes.filter((c) => c === code)).toHaveLength(1);
      });
    });
  });

  describe('matrixBinding carries the intake fields', () => {
    it('binds all four Step 3 fields so DECLARE_ARTIFACT receives them', () => {
      // Without these in the binding the gates pass, the operator answers, and
      // the answers are dropped before reaching the reducer.
      expect(ARTIFACT_SLOT.matrixBinding.fields).toEqual(
        expect.arrayContaining(['satisfaction_mode', 'targetDate', 'buffer_anchor', 'buffer_binding']),
      );
    });

    it('dispatches DECLARE_ARTIFACT', () => {
      expect(ARTIFACT_SLOT.matrixBinding.action).toBe('DECLARE_ARTIFACT');
    });
  });

  describe('buildArtifactDeclarePayload — intake fields', () => {
    it('carries all four intake fields through to the payload', () => {
      const payload = buildArtifactDeclarePayload({
        name: 'Master WAV',
        satisfaction_mode: 'AND',
        targetDate: '2099-12-31',
        buffer_anchor: 'deliv-mastering',
        buffer_binding: 'hard',
      });
      expect(payload).toMatchObject({
        satisfaction_mode: 'AND',
        targetDate: '2099-12-31',
        buffer_anchor: 'deliv-mastering',
        buffer_binding: 'hard',
      });
    });

    it('normalises absent buffer fields to null, not empty string', () => {
      // The reducer pairs on truthiness; '' and null behave alike there, but the
      // stored matrix distinguishes them and downstream buffer computation reads
      // null as "no buffer declared".
      const payload = buildArtifactDeclarePayload({ name: 'Master WAV' });
      expect(payload.buffer_anchor).toBeNull();
      expect(payload.buffer_binding).toBeNull();
    });

    it('trims whitespace from intake values', () => {
      const payload = buildArtifactDeclarePayload({
        name: 'Master WAV',
        satisfaction_mode: '  AND  ',
        targetDate: '  2099-12-31  ',
      });
      expect(payload.satisfaction_mode).toBe('AND');
      expect(payload.targetDate).toBe('2099-12-31');
    });
  });
});
