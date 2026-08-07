import { describe, it, expect } from 'vitest';
import { INITIATIVE_SLOT } from './initiativeSlot';

/**
 * Test: Conditional Initiative purpose questions based on role-tags.
 *
 * Verifies that PURPOSE questions conditionally fire based on roleTags:
 *   - "project" → includes completion question
 *   - "system" → includes ongoing question
 *   - ["project", "system"] → both questions fire
 *
 * Non-conditional: all initiatives answer "What does it do?" and "What is it for?"
 */

describe('Initiative slot — conditional purpose questions', () => {
  // Helper: find all failing gates for a given captured state
  function failingGates(captured: any) {
    return INITIATIVE_SLOT.gate
      .filter((g) => g.detect(captured))
      .map((g) => g.code);
  }

  describe('Project-type initiative', () => {
    it('should require project completion question, NOT system ongoing question', () => {
      const captured = {
        name: 'The Album Release',
        owningEntityId: 'entity-1',
        roleTags: ['project'],
        purpose: 'Consolidate the catalog into one release arc',
        purposeFor: 'Grow the audience from loyal listeners to industry credibility',
        // Note: purposeCompletion NOT provided yet
        classification: 'objective',
        doneWhen: 'Live on Spotify for Artists',
      };

      const failing = failingGates(captured);

      // Should NOT require the system-type ongoing question
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_MISSING');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_NOT_SUBSTANTIVE');

      // Should require the project-type completion question
      expect(failing).toContain('INITIATIVE_PURPOSE_COMPLETION_MISSING');
    });

    it('should accept valid completion answer for project', () => {
      const captured = {
        name: 'The Album Release',
        owningEntityId: 'entity-1',
        roleTags: ['project'],
        purpose: 'Consolidate catalog',
        purposeFor: 'Grow audience',
        purposeCompletion: 'The terminal album ships profitably with 100k+ streams in first week',
        classification: 'objective',
        doneWhen: 'Live on Spotify',
      };

      const failing = failingGates(captured);

      // Should NOT fail on project-type gates
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_MISSING');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_NOT_SUBSTANTIVE');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_MISSING');
    });
  });

  describe('System-type initiative', () => {
    it('should require system ongoing question, NOT project completion question', () => {
      const captured = {
        name: 'The Jericho System',
        owningEntityId: 'entity-systems',
        roleTags: ['system'],
        purpose: 'Runs live plan generation for the enterprise',
        purposeFor: 'Automate the end-to-end execution workflow',
        // Note: purposeOngoing NOT provided yet
        classification: 'objective',
        doneWhen: 'Live in production and running 10+ plans',
      };

      const failing = failingGates(captured);

      // Should NOT require the project-type completion question
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_MISSING');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_NOT_SUBSTANTIVE');

      // Should require the system-type ongoing question
      expect(failing).toContain('INITIATIVE_PURPOSE_ONGOING_MISSING');
    });

    it('should accept valid ongoing answer for system', () => {
      const captured = {
        name: 'The Jericho System',
        owningEntityId: 'entity-systems',
        roleTags: ['system'],
        purpose: 'Runs live plan generation',
        purposeFor: 'Automate execution workflow',
        purposeOngoing: 'Sustains 10+ concurrent plans and 99.9% uptime',
        classification: 'objective',
        doneWhen: 'Live in production',
      };

      const failing = failingGates(captured);

      // Should NOT fail on system-type gates
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_MISSING');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_NOT_SUBSTANTIVE');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_MISSING');
    });
  });

  describe('Dual-tagged initiative (both system and project)', () => {
    it('should require BOTH completion AND ongoing questions', () => {
      const captured = {
        name: 'The Jericho System',
        owningEntityId: 'entity-systems',
        roleTags: ['system', 'project'],
        purpose: 'Ship Jericho 1.0 and operate it as live infrastructure',
        purposeFor: 'Replace manual planning with deterministic automation',
        // Note: BOTH purposeCompletion and purposeOngoing NOT provided yet
        classification: 'objective',
        doneWhen: '1.0 live and sustaining 10+ enterprise plans',
      };

      const failing = failingGates(captured);

      // Should require BOTH conditional questions
      expect(failing).toContain('INITIATIVE_PURPOSE_COMPLETION_MISSING');
      expect(failing).toContain('INITIATIVE_PURPOSE_ONGOING_MISSING');
    });

    it('should accept valid answers for BOTH types (non-redundant)', () => {
      const captured = {
        name: 'The Jericho System',
        owningEntityId: 'entity-systems',
        roleTags: ['system', 'project'],
        purpose: 'Ship Jericho 1.0 and operate it',
        purposeFor: 'Replace manual planning with deterministic automation',
        purposeCompletion: 'Launch as enterprise standard and drive adoption across 5+ teams',
        purposeOngoing: 'Sustains 20+ concurrent plans, 99.5% uptime, 4+ feature releases/quarter',
        classification: 'objective',
        doneWhen: '1.0 live and sustaining 10+ plans',
      };

      const failing = failingGates(captured);

      // Should NOT fail on either question type
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_MISSING');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_COMPLETION_NOT_SUBSTANTIVE');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_MISSING');
      expect(failing).not.toContain('INITIATIVE_PURPOSE_ONGOING_NOT_SUBSTANTIVE');
    });
  });

  describe('Universal purpose questions (all initiatives)', () => {
    it('should require "What does it do?" for all role-tag combinations', () => {
      const testCases = [
        { roleTags: ['project'] },
        { roleTags: ['system'] },
        { roleTags: ['system', 'project'] },
      ];

      for (const tc of testCases) {
        const captured = {
          name: 'Test Initiative',
          owningEntityId: 'entity-1',
          ...tc,
          // purpose NOT provided
          purposeFor: 'Some purpose',
          classification: 'objective',
          doneWhen: 'When done',
        };

        const failing = failingGates(captured);
        expect(failing).toContain('INITIATIVE_PURPOSE_MISSING',
          `Should require "What does it do?" for roleTags=${JSON.stringify(tc.roleTags)}`
        );
      }
    });

    it('should require "What is it for?" for all role-tag combinations', () => {
      const testCases = [
        { roleTags: ['project'] },
        { roleTags: ['system'] },
        { roleTags: ['system', 'project'] },
      ];

      for (const tc of testCases) {
        const captured = {
          name: 'Test Initiative',
          owningEntityId: 'entity-1',
          ...tc,
          purpose: 'Does something',
          // purposeFor NOT provided
          classification: 'objective',
          doneWhen: 'When done',
        };

        const failing = failingGates(captured);
        expect(failing).toContain('INITIATIVE_PURPOSE_FOR_MISSING',
          `Should require "What is it for?" for roleTags=${JSON.stringify(tc.roleTags)}`
        );
      }
    });
  });

  describe('Substantiveness validation', () => {
    it('should reject vague completion answers for project-type', () => {
      const captured = {
        name: 'Test Project',
        owningEntityId: 'entity-1',
        roleTags: ['project'],
        purpose: 'Do something real',
        purposeFor: 'Achieve something real',
        purposeCompletion: 'complete the project', // Too vague
        classification: 'objective',
        doneWhen: 'When done',
      };

      const failing = failingGates(captured);
      expect(failing).toContain('INITIATIVE_PURPOSE_COMPLETION_NOT_SUBSTANTIVE');
    });

    it('should reject vague ongoing answers for system-type', () => {
      const captured = {
        name: 'Test System',
        owningEntityId: 'entity-1',
        roleTags: ['system'],
        purpose: 'Do something real',
        purposeFor: 'Achieve something real',
        purposeOngoing: 'delivers value', // Management jargon — too vague
        classification: 'objective',
        doneWhen: 'Never',
      };

      const failing = failingGates(captured);
      expect(failing).toContain('INITIATIVE_PURPOSE_ONGOING_NOT_SUBSTANTIVE');
    });
  });

  describe('Role-tag validation', () => {
    it('should require at least one role-tag', () => {
      const captured = {
        name: 'Test Initiative',
        owningEntityId: 'entity-1',
        roleTags: [], // Empty array
        purpose: 'Something',
        purposeFor: 'Something',
        classification: 'objective',
        doneWhen: 'When',
      };

      const failing = failingGates(captured);
      expect(failing).toContain('INITIATIVE_ROLETAGS_MISSING');
    });

    it('should reject invalid role-tags', () => {
      const captured = {
        name: 'Test Initiative',
        owningEntityId: 'entity-1',
        roleTags: ['project', 'invalid-tag'],
        purpose: 'Something',
        purposeFor: 'Something',
        classification: 'objective',
        doneWhen: 'When',
      };

      const failing = failingGates(captured);
      expect(failing).toContain('INITIATIVE_ROLETAGS_INVALID');
    });

    it('should accept both "system" and "project" role-tags', () => {
      const captured = {
        name: 'Dual Initiative',
        owningEntityId: 'entity-1',
        roleTags: ['system', 'project'],
        purpose: 'Does both',
        purposeFor: 'Is both',
        purposeCompletion: 'Completion value here',
        purposeOngoing: 'Ongoing value here',
        classification: 'objective',
        doneWhen: 'Eventually',
      };

      const failing = failingGates(captured);
      expect(failing).not.toContain('INITIATIVE_ROLETAGS_MISSING');
      expect(failing).not.toContain('INITIATIVE_ROLETAGS_INVALID');
    });
  });
});
