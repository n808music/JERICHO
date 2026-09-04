import { describe, it, expect } from 'vitest';
import { DELIVERABLE_SLOT, buildDeliverableDeclarePayload, fieldNameForCode } from '../../../src/domain/elicitation/slots/deliverableSlot.js';

describe('Deliverable Intake Slot', () => {
  describe('gate sequence', () => {
    it('has 7 gates in the correct order', () => {
      expect(DELIVERABLE_SLOT.gate).toHaveLength(7);
      expect(DELIVERABLE_SLOT.gate[0].code).toBe('DELIVERABLE_NAME_MISSING');
      expect(DELIVERABLE_SLOT.gate[1].code).toBe('DELIVERABLE_NAME_NOT_HOLDABLE');
      expect(DELIVERABLE_SLOT.gate[2].code).toBe('DELIVERABLE_PROJECT_MISSING');
      expect(DELIVERABLE_SLOT.gate[3].code).toBe('DELIVERABLE_EXECUTING_ENTITY_MISSING');
      expect(DELIVERABLE_SLOT.gate[4].code).toBe('DELIVERABLE_TARGET_DATE_MISSING');
      expect(DELIVERABLE_SLOT.gate[5].code).toBe('DELIVERABLE_TARGET_DATE_INVALID');
      expect(DELIVERABLE_SLOT.gate[6].code).toBe('DELIVERABLE_BUFFER_PAIR_INCOMPLETE');
    });

    it('detects missing name', () => {
      const captured = { name: '' };
      expect(DELIVERABLE_SLOT.gate[0].detect(captured)).toBe(true);
    });

    it('detects invalid target date', () => {
      const captured = { target_date: 'not-a-date' };
      expect(DELIVERABLE_SLOT.gate[5].detect(captured)).toBe(true);
    });

    it('detects incomplete buffer pair (anchor without binding)', () => {
      const captured = { buffer_anchor: 'some-value', buffer_binding: undefined };
      expect(DELIVERABLE_SLOT.gate[6].detect(captured)).toBe(true);
    });

    it('detects incomplete buffer pair (binding without anchor)', () => {
      const captured = { buffer_anchor: undefined, buffer_binding: 'hard' };
      expect(DELIVERABLE_SLOT.gate[6].detect(captured)).toBe(true);
    });

    it('allows complete buffer pair (both present)', () => {
      const captured = { buffer_anchor: 'some-value', buffer_binding: 'hard' };
      expect(DELIVERABLE_SLOT.gate[6].detect(captured)).toBe(false);
    });

    it('allows empty buffer pair (both absent)', () => {
      const captured = { buffer_anchor: undefined, buffer_binding: undefined };
      expect(DELIVERABLE_SLOT.gate[6].detect(captured)).toBe(false);
    });
  });

  describe('fieldNameForCode', () => {
    it('maps gate codes to field names', () => {
      expect(fieldNameForCode('DELIVERABLE_NAME_MISSING')).toBe('name');
      expect(fieldNameForCode('DELIVERABLE_PROJECT_MISSING')).toBe('parent_project');
      expect(fieldNameForCode('DELIVERABLE_EXECUTING_ENTITY_MISSING')).toBe('executing_entity');
      expect(fieldNameForCode('DELIVERABLE_TARGET_DATE_MISSING')).toBe('target_date');
      expect(fieldNameForCode('DELIVERABLE_BUFFER_PAIR_INCOMPLETE')).toBe('buffer_binding');
    });

    it('returns null for unknown code', () => {
      expect(fieldNameForCode('UNKNOWN_CODE')).toBe(null);
    });
  });

  describe('buildDeliverableDeclarePayload', () => {
    it('builds payload with required fields', () => {
      const captured = {
        name: 'First Album',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };
      const payload = buildDeliverableDeclarePayload(captured);

      expect(payload.id).toBe('deliverable-first-album');
      expect(payload.name).toBe('First Album');
      expect(payload.parent_project).toBe('project-123');
      expect(payload.executing_entity).toBe('entity-456');
      expect(payload.target_date).toBe('2026-12-31');
      expect(payload.description).toBe(null);
      expect(payload.buffer_anchor).toBe(null);
      expect(payload.buffer_binding).toBe(null);
    });

    it('includes optional description when provided', () => {
      const captured = {
        name: 'First Album',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
        description: 'A stunning debut album',
      };
      const payload = buildDeliverableDeclarePayload(captured);

      expect(payload.description).toBe('A stunning debut album');
    });

    it('includes buffer fields when provided as a pair', () => {
      const captured = {
        name: 'Landing Page',
        parent_project: 'project-789',
        executing_entity: 'entity-abc',
        target_date: '2026-06-30',
        buffer_anchor: 'design-approval',
        buffer_binding: 'hard',
      };
      const payload = buildDeliverableDeclarePayload(captured);

      expect(payload.buffer_anchor).toBe('design-approval');
      expect(payload.buffer_binding).toBe('hard');
    });

    it('generates deterministic IDs from names', () => {
      const captured1 = {
        name: 'Manuscript Draft',
        parent_project: 'p1',
        executing_entity: 'e1',
        target_date: '2026-08-30',
      };
      const captured2 = {
        name: 'Manuscript Draft',
        parent_project: 'p2',
        executing_entity: 'e2',
        target_date: '2026-09-30',
      };

      const payload1 = buildDeliverableDeclarePayload(captured1);
      const payload2 = buildDeliverableDeclarePayload(captured2);

      expect(payload1.id).toBe(payload2.id);
      expect(payload1.id).toBe('deliverable-manuscript-draft');
    });

    it('handles names with special characters', () => {
      const captured = {
        name: '79th Street — Acquisition Complete',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };
      const payload = buildDeliverableDeclarePayload(captured);

      // Should normalize to lowercase alphanumeric with hyphens
      expect(payload.id).toMatch(/^deliverable-/);
      expect(payload.id).not.toContain('—');
    });
  });

  describe('DELIVERABLE_SLOT metadata', () => {
    it('declares the correct section number', () => {
      expect(DELIVERABLE_SLOT.section).toBe(6);
    });

    it('declares dependencies on Project and Entity slots', () => {
      expect(DELIVERABLE_SLOT.dependsOn).toContain('slot:project');
      expect(DELIVERABLE_SLOT.dependsOn).toContain('slot:entity');
    });

    it('declares the correct action for matrix binding', () => {
      expect(DELIVERABLE_SLOT.matrixBinding.action).toBe('DECLARE_DELIVERABLE');
    });

    it('lists all fields in matrix binding', () => {
      const fields = DELIVERABLE_SLOT.matrixBinding.fields;
      expect(fields).toContain('name');
      expect(fields).toContain('parent_project');
      expect(fields).toContain('executing_entity');
      expect(fields).toContain('target_date');
      expect(fields).toContain('description');
      expect(fields).toContain('buffer_anchor');
      expect(fields).toContain('buffer_binding');
    });
  });
});
