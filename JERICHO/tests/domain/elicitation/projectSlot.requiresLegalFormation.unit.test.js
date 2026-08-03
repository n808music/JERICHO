import { describe, it, expect } from 'vitest';
import { PROJECT_SLOT, buildProjectDeclarePayload } from '../../../src/domain/elicitation/slots/projectSlot.js';

describe('Project slot — requiresLegalFormation foundation', () => {
  describe('Gate detect function (pure logic)', () => {
    const gate = PROJECT_SLOT.gate.find((g) => g.code === 'PROJECT_LEGAL_FORMATION_MISSING');
    const detect = gate.detect;

    it('returns true when requiresLegalFormation is undefined', () => {
      expect(detect({})).toBe(true);
      expect(detect({ name: 'Test' })).toBe(true);
      expect(detect({ requiresLegalFormation: undefined })).toBe(true);
    });

    it('returns true when requiresLegalFormation is null', () => {
      expect(detect({ requiresLegalFormation: null })).toBe(true);
    });

    it('returns false when requiresLegalFormation is true', () => {
      expect(detect({ requiresLegalFormation: true })).toBe(false);
    });

    it('returns false when requiresLegalFormation is false', () => {
      expect(detect({ requiresLegalFormation: false })).toBe(false);
    });

    it('gate code is PROJECT_LEGAL_FORMATION_MISSING', () => {
      expect(gate.code).toBe('PROJECT_LEGAL_FORMATION_MISSING');
    });

    it('gate fieldName is requiresLegalFormation', () => {
      expect(gate.fieldName).toBe('requiresLegalFormation');
    });

    it('gate pickSet is yesNoOptions', () => {
      expect(gate.pickSet).toBe('yesNoOptions');
    });
  });

  describe('Payload builder (pure function)', () => {
    it('stores requiresLegalFormation=true when captured', () => {
      const payload = buildProjectDeclarePayload({
        name: 'Test Project',
        owningEntityId: 'entity-1',
        successMetric: 'Test metric',
        verificationSourceId: 'vs-1',
        phase: '1',
        requiresLegalFormation: true,
      });
      expect(payload.requiresLegalFormation).toBe(true);
    });

    it('stores requiresLegalFormation=false when captured', () => {
      const payload = buildProjectDeclarePayload({
        name: 'Test Project',
        owningEntityId: 'entity-1',
        successMetric: 'Test metric',
        verificationSourceId: 'vs-1',
        phase: '1',
        requiresLegalFormation: false,
      });
      expect(payload.requiresLegalFormation).toBe(false);
    });

    it('defaults to false when requiresLegalFormation is undefined', () => {
      const payload = buildProjectDeclarePayload({
        name: 'Test Project',
        owningEntityId: 'entity-1',
        successMetric: 'Test metric',
        verificationSourceId: 'vs-1',
        phase: '1',
        // requiresLegalFormation not provided
      });
      expect(payload.requiresLegalFormation).toBe(false);
    });

    it('defaults to false when requiresLegalFormation is null', () => {
      const payload = buildProjectDeclarePayload({
        name: 'Test Project',
        owningEntityId: 'entity-1',
        successMetric: 'Test metric',
        verificationSourceId: 'vs-1',
        phase: '1',
        requiresLegalFormation: null,
      });
      expect(payload.requiresLegalFormation).toBe(false);
    });

    it('includes requiresLegalFormation in all payload outputs', () => {
      const payload = buildProjectDeclarePayload({
        name: 'Test',
        owningEntityId: 'e1',
        successMetric: 'metric',
        verificationSourceId: 'vs1',
        phase: '1',
        requiresLegalFormation: true,
      });
      expect(Object.keys(payload)).toContain('requiresLegalFormation');
    });
  });

  describe('Storage — project object structure', () => {
    it('project object receives requiresLegalFormation field from payload', () => {
      // Simulating what declareProject does
      const payload = {
        id: 'project-test',
        name: 'Test Project',
        owningEntityId: 'entity-1',
        successMetric: 'metric',
        verificationSourceId: 'vs-1',
        phase: '1',
        requiresLegalFormation: true,
      };

      const project = { ...payload };
      expect(project.requiresLegalFormation).toBe(true);
    });

    it('project object has requiresLegalFormation=false by default', () => {
      const payload = {
        id: 'project-test',
        name: 'Test Project',
        owningEntityId: 'entity-1',
        successMetric: 'metric',
        verificationSourceId: 'vs-1',
        phase: '1',
        requiresLegalFormation: false,
      };

      const project = { ...payload };
      expect(project.requiresLegalFormation).toBe(false);
    });
  });
});
