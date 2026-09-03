import { describe, it, expect, beforeEach } from 'vitest';
import {
  DELIVERABLE_SLOT,
  buildDeliverableDeclarePayload,
} from '../../../src/domain/elicitation/slots/deliverableSlot.js';
import { DELIVERABLE_REPROBES } from '../../../src/domain/elicitation/deliverableReprobes.js';

describe('Deliverable Intake — Acceptance Tests', () => {
  describe('Happy Path: All Gates Pass', () => {
    it('accepts a complete deliverable with all required fields', () => {
      const captured = {
        name: 'Marketing Campaign Landing Page',
        parent_project: 'project-marketing-2026',
        executing_entity: 'entity-design-team',
        target_date: '2026-12-15',
        description: 'Single-page responsive landing page for Q4 campaign',
      };

      // All gates should pass
      const gateFailures = DELIVERABLE_SLOT.gate.filter(gate => gate.detect(captured));
      expect(gateFailures).toHaveLength(0);

      // Payload builder should succeed
      const payload = buildDeliverableDeclarePayload(captured);
      expect(payload).toBeDefined();
      expect(payload.id).toMatch(/^deliverable-/);
      expect(payload.name).toBe('Marketing Campaign Landing Page');
      expect(payload.parent_project).toBe('project-marketing-2026');
      expect(payload.executing_entity).toBe('entity-design-team');
      expect(payload.target_date).toBe('2026-12-15');
      expect(payload.description).toBe('Single-page responsive landing page for Q4 campaign');
      expect(payload.buffer_anchor).toBe(null);
      expect(payload.buffer_binding).toBe(null);
    });

    it('accepts a complete deliverable with buffer pairing', () => {
      const captured = {
        name: 'Album Artwork Package',
        parent_project: 'project-music-album-2026',
        executing_entity: 'entity-art-direction',
        target_date: '2026-10-30',
        description: 'Complete artwork suite for album release',
        buffer_anchor: 'client-final-approval',
        buffer_binding: 'hard',
      };

      // All gates should pass
      const gateFailures = DELIVERABLE_SLOT.gate.filter(gate => gate.detect(captured));
      expect(gateFailures).toHaveLength(0);

      // Payload should preserve buffer fields
      const payload = buildDeliverableDeclarePayload(captured);
      expect(payload.buffer_anchor).toBe('client-final-approval');
      expect(payload.buffer_binding).toBe('hard');
    });
  });

  describe('Gate A: Name Validation', () => {
    it('fails when name is missing', () => {
      const captured = {
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_NAME_MISSING');
      expect(gate.detect(captured)).toBe(true);
      expect(DELIVERABLE_REPROBES.DELIVERABLE_NAME_MISSING).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_NAME_MISSING.spine).toContain('name of this deliverable');
    });

    it('fails when name is not a holdable noun', () => {
      const captured = {
        name: 'Build the landing page',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_NAME_NOT_HOLDABLE');
      expect(gate.detect(captured)).toBe(true);
      expect(DELIVERABLE_REPROBES.DELIVERABLE_NAME_NOT_HOLDABLE).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_NAME_NOT_HOLDABLE.spine).toContain('action, not a deliverable');
    });
  });

  describe('Gate B: Parent Project Validation', () => {
    it('fails when parent_project is missing', () => {
      const captured = {
        name: 'Landing Page',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_PROJECT_MISSING');
      expect(gate.detect(captured)).toBe(true);
      expect(gate.pickSet).toBe('declaredProjects');
      expect(DELIVERABLE_REPROBES.DELIVERABLE_PROJECT_MISSING).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_PROJECT_MISSING.spine).toContain('parent project');
    });
  });

  describe('Gate C: Executing Entity Validation', () => {
    it('fails when executing_entity is missing', () => {
      const captured = {
        name: 'Landing Page',
        parent_project: 'project-123',
        target_date: '2026-12-31',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_EXECUTING_ENTITY_MISSING');
      expect(gate.detect(captured)).toBe(true);
      expect(gate.pickSet).toBe('declaredEntities');
      expect(DELIVERABLE_REPROBES.DELIVERABLE_EXECUTING_ENTITY_MISSING).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_EXECUTING_ENTITY_MISSING.spine).toContain('execute');
    });
  });

  describe('Gate D: Target Date Validation', () => {
    it('fails when target_date is missing', () => {
      const captured = {
        name: 'Landing Page',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_TARGET_DATE_MISSING');
      expect(gate.detect(captured)).toBe(true);
      expect(DELIVERABLE_REPROBES.DELIVERABLE_TARGET_DATE_MISSING).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_TARGET_DATE_MISSING.spine).toContain('due');
    });

    it('fails when target_date is not a valid ISO date', () => {
      const captured = {
        name: 'Landing Page',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: 'not-a-date',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_TARGET_DATE_INVALID');
      expect(gate.detect(captured)).toBe(true);
      expect(DELIVERABLE_REPROBES.DELIVERABLE_TARGET_DATE_INVALID).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_TARGET_DATE_INVALID.spine).toContain('YYYY-MM-DD');
    });

    it('accepts valid ISO date formats', () => {
      const validDates = ['2026-12-31', '2026-01-01', '2027-06-15'];
      for (const date of validDates) {
        const captured = {
          name: 'Test',
          parent_project: 'project-123',
          executing_entity: 'entity-456',
          target_date: date,
        };
        const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_TARGET_DATE_INVALID');
        expect(gate.detect(captured)).toBe(false);
      }
    });
  });

  describe('Gate E: Buffer Pair Constraint (Conditional)', () => {
    it('passes when both buffer fields are present', () => {
      const captured = {
        name: 'Test',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
        buffer_anchor: 'some-anchor',
        buffer_binding: 'hard',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_BUFFER_PAIR_INCOMPLETE');
      expect(gate.detect(captured)).toBe(false);
    });

    it('passes when neither buffer field is present', () => {
      const captured = {
        name: 'Test',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_BUFFER_PAIR_INCOMPLETE');
      expect(gate.detect(captured)).toBe(false);
    });

    it('fails when buffer_anchor is present but buffer_binding is missing', () => {
      const captured = {
        name: 'Test',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
        buffer_anchor: 'some-anchor',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_BUFFER_PAIR_INCOMPLETE');
      expect(gate.detect(captured)).toBe(true);
      expect(DELIVERABLE_REPROBES.DELIVERABLE_BUFFER_PAIR_INCOMPLETE).toBeDefined();
      expect(DELIVERABLE_REPROBES.DELIVERABLE_BUFFER_PAIR_INCOMPLETE.spine).toContain('must be paired');
    });

    it('fails when buffer_binding is present but buffer_anchor is missing', () => {
      const captured = {
        name: 'Test',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
        buffer_binding: 'hard',
      };

      const gate = DELIVERABLE_SLOT.gate.find(g => g.code === 'DELIVERABLE_BUFFER_PAIR_INCOMPLETE');
      expect(gate.detect(captured)).toBe(true);
    });
  });

  describe('Field Mapping and Casing', () => {
    it('preserves field casing for name', () => {
      const captured = {
        name: 'Release Notes — Q4 2026',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
      };

      const payload = buildDeliverableDeclarePayload(captured);
      expect(payload.name).toBe('Release Notes — Q4 2026');
    });

    it('normalizes ID to lowercase with hyphens', () => {
      const testCases = [
        { input: 'First Album', expected: 'deliverable-first-album' },
        { input: 'AI Training Model v2', expected: 'deliverable-ai-training-model-v2' },
        { input: 'API  Documentation', expected: 'deliverable-api-documentation' },
      ];

      for (const { input, expected } of testCases) {
        const captured = {
          name: input,
          parent_project: 'project-123',
          executing_entity: 'entity-456',
          target_date: '2026-12-31',
        };
        const payload = buildDeliverableDeclarePayload(captured);
        expect(payload.id).toBe(expected);
      }
    });

    it('stores description field (formerly what_ships)', () => {
      const captured = {
        name: 'Marketing Materials',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
        description: 'Social media assets, email templates, landing page copy',
      };

      const payload = buildDeliverableDeclarePayload(captured);
      expect(payload.description).toBe('Social media assets, email templates, landing page copy');
    });

    it('uses ?? null for missing optional fields (not || null)', () => {
      const captured = {
        name: 'Test',
        parent_project: 'project-123',
        executing_entity: 'entity-456',
        target_date: '2026-12-31',
        description: '', // Empty string should be preserved as empty, not default to null
      };

      const payload = buildDeliverableDeclarePayload(captured);
      // Builder uses ?? null, so empty string should be preserved as-is
      expect(payload.description).toBe(''); // Empty string, not null
    });
  });

  describe('Slot Metadata and Dependencies', () => {
    it('declares Section 6', () => {
      expect(DELIVERABLE_SLOT.section).toBe(6);
    });

    it('declares matrix binding action as DECLARE_DELIVERABLE', () => {
      expect(DELIVERABLE_SLOT.matrixBinding.action).toBe('DECLARE_DELIVERABLE');
    });

    it('declares all intake fields in matrix binding', () => {
      const { fields } = DELIVERABLE_SLOT.matrixBinding;
      expect(fields).toContain('name');
      expect(fields).toContain('parent_project');
      expect(fields).toContain('executing_entity');
      expect(fields).toContain('target_date');
      expect(fields).toContain('description');
      expect(fields).toContain('buffer_anchor');
      expect(fields).toContain('buffer_binding');
    });

    it('declares dependencies on Project and Entity slots', () => {
      expect(DELIVERABLE_SLOT.dependsOn).toContain('slot:project');
      expect(DELIVERABLE_SLOT.dependsOn).toContain('slot:entity');
    });
  });

  describe('Reprobes coverage', () => {
    it('has reprobe messages for every gate failure code', () => {
      for (const gate of DELIVERABLE_SLOT.gate) {
        const reprobe = DELIVERABLE_REPROBES[gate.code];
        expect(reprobe).toBeDefined();
        expect(reprobe.spine).toBeDefined();
        expect(typeof reprobe.spine).toBe('string');
        expect(reprobe.spine.length).toBeGreaterThan(0);
      }
    });
  });
});
