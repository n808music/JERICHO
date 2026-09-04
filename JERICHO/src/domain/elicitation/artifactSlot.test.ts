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
});
