import { describe, it, expect, beforeEach } from 'vitest';
import { buildBlankIdentityState } from '../identityStore.js';
import { computeDerivedState } from '../identityCompute.js';
import { ARTIFACT_REPROBES } from '../../domain/elicitation/artifactReprobes.ts';
import { reconcileDeferredAnchors } from '../../domain/masterGrid/loadReferenceMatrix.js';

describe('Artifact Buffer Directive (Item 6): Buffer anchor resolution & validation', () => {
  let state;

  beforeEach(() => {
    state = buildBlankIdentityState({ nowISO: '2026-09-05T12:00:00Z' });
    state.appTime = { nowISO: '2026-09-05T12:00:00Z' };

    // Minimal setup: verification source, initiative, entity, project, deliverable
    state = computeDerivedState(state, {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: { id: 'vs-test', domain: 'test', source: 'unit_test' },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_INITIATIVE',
      payload: {
        id: 'initiative-anchor',
        name: 'Anchor Initiative',
        purpose: 'test',
        doneWhen: 'test',
        function: 'ops',
        boundary_type: 'Terminating',
        completion_value: 'done',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ENTITY',
      payload: {
        id: 'entity-producer',
        name: 'Producer',
        purpose: 'test',
        formationState: 'formed',
        statusEvidence: 'test',
        foundation_initiative: 'initiative-anchor',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_PROJECT',
      payload: {
        id: 'project-anchor',
        name: 'Anchor Project',
        owningEntityId: 'entity-producer',
        executing_entity: 'entity-producer',
        parent_initiative: 'initiative-anchor',
        boundary_type: 'Terminating',
        terminal_date: '2026-12-31',
        description: 'test',
        verificationSourceId: 'vs-test',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_DELIVERABLE',
      payload: {
        id: 'deliverable-anchor',
        name: 'Anchor Deliverable',
        parent_project: 'project-anchor',
        executing_entity: 'entity-producer',
        description: 'test',
        target_date: '2026-11-30',
      },
    });

    state = computeDerivedState(state, {
      type: 'DECLARE_ARTIFACT',
      payload: {
        id: 'artifact-anchor',
        name: 'Anchor Artifact',
        parentDeliverableIds: ['deliverable-anchor'],
        producedByEntityId: 'entity-producer',
        completionEvidence: 'test',
        verificationSourceId: 'vs-test',
        operatorAttestationMethod: 'test',
        targetDate: '2026-11-20',
        satisfaction_mode: 'AND',
      },
    });
  });

  describe('Buffer anchor resolution (name → grain-scoped ID)', () => {
    it('Resolves when buffer_anchor matches a declared Artifact', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-uses-artifact-anchor',
          name: 'Artifact Using Artifact Anchor',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'artifact-anchor',
          buffer_binding: 'hard',
        },
      });
      expect(state.lastPlanError).toBeNull();
      const artifact = state.matrix.artifactsById['artifact-uses-artifact-anchor'];
      expect(artifact?.buffer_anchor).toBe('artifact-anchor');
    });

    it('Resolves when buffer_anchor matches a declared Deliverable', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-uses-deliverable-anchor',
          name: 'Artifact Using Deliverable Anchor',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'deliverable-anchor',
          buffer_binding: 'advisory',
        },
      });
      expect(state.lastPlanError).toBeNull();
      expect(state.matrix.artifactsById['artifact-uses-deliverable-anchor'].buffer_anchor).toBe('deliverable-anchor');
    });

    it('Resolves when buffer_anchor matches a declared Project', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-uses-project-anchor',
          name: 'Artifact Using Project Anchor',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'project-anchor',
          buffer_binding: 'hard',
        },
      });
      expect(state.lastPlanError).toBeNull();
      expect(state.matrix.artifactsById['artifact-uses-project-anchor'].buffer_anchor).toBe('project-anchor');
    });

    it('Resolves when buffer_anchor matches a declared Initiative', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-uses-initiative-anchor',
          name: 'Artifact Using Initiative Anchor',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'initiative-anchor',
          buffer_binding: 'advisory',
        },
      });
      expect(state.lastPlanError).toBeNull();
      expect(state.matrix.artifactsById['artifact-uses-initiative-anchor'].buffer_anchor).toBe('initiative-anchor');
    });
  });

  describe('Validation: ARTIFACT_BUFFER_ANCHOR_UNKNOWN', () => {
    it('Rejects buffer_anchor that does not resolve to any declared node', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-bad-anchor',
          name: 'Artifact Bad Anchor',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'nonexistent-node',
          buffer_binding: 'hard',
        },
      });
      expect(state.lastPlanError?.code).toBe('ARTIFACT_BUFFER_ANCHOR_UNKNOWN');
      expect(state.matrix.artifactsById['artifact-bad-anchor']).toBeUndefined();
    });

    it('Accepts null buffer_anchor with null buffer_binding (optional pairing)', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-no-buffer',
          name: 'Artifact No Buffer',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: null,
          buffer_binding: null,
        },
      });
      expect(state.lastPlanError).toBeNull();
      const artifact = state.matrix.artifactsById['artifact-no-buffer'];
      expect(artifact?.buffer_anchor).toBeNull();
      expect(artifact?.buffer_binding).toBeNull();
    });

    it('Honours deferBufferAnchorValidation for batch loaders (opt-out, not default)', () => {
      // Batch loaders legitimately declare forward references in pass 1 and revalidate in
      // pass 2. The opt-out must be explicit; omitting it must yield the guard (see the
      // rejection test above), so that a caller who forgets gets a rejection, not a hole.
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-deferred-anchor',
          name: 'Artifact Deferred Anchor',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'not-yet-declared',
          buffer_binding: 'hard',
          deferBufferAnchorValidation: true,
        },
      });
      expect(state.lastPlanError).toBeNull();
      expect(state.matrix.artifactsById['artifact-deferred-anchor']).toBeDefined();
    });
  });

  describe('Validation: DELIVERABLE_BUFFER_ANCHOR_UNKNOWN', () => {
    it('Rejects buffer_anchor that does not resolve to any declared node', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliverable-bad-anchor',
          name: 'Deliverable Bad Anchor',
          parent_project: 'project-anchor',
          executing_entity: 'entity-producer',
          description: 'test',
          target_date: '2026-11-30',
          buffer_anchor: 'nonexistent-node',
          buffer_binding: 'hard',
        },
      });
      expect(state.lastPlanError?.code).toBe('DELIVERABLE_BUFFER_ANCHOR_UNKNOWN');
      expect(state.matrix.deliverablesById['deliverable-bad-anchor']).toBeUndefined();
    });

    it('Accepts buffer_anchor that resolves to a declared node', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliverable-good-anchor',
          name: 'Deliverable Good Anchor',
          parent_project: 'project-anchor',
          executing_entity: 'entity-producer',
          description: 'test',
          target_date: '2026-11-30',
          buffer_anchor: 'project-anchor',
          buffer_binding: 'hard',
        },
      });
      expect(state.lastPlanError).toBeNull();
      // Deliverable storage normalized to camelCase by 71e95e9 — the key pass 2 must also use.
      expect(state.matrix.deliverablesById['deliverable-good-anchor']?.bufferAnchor).toBe('project-anchor');
    });

    it('Honours deferBufferAnchorValidation for batch loaders', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_DELIVERABLE',
        payload: {
          id: 'deliverable-deferred-anchor',
          name: 'Deliverable Deferred Anchor',
          parent_project: 'project-anchor',
          executing_entity: 'entity-producer',
          description: 'test',
          target_date: '2026-11-30',
          buffer_anchor: 'not-yet-declared',
          buffer_binding: 'hard',
          deferBufferAnchorValidation: true,
        },
      });
      expect(state.lastPlanError).toBeNull();
      expect(state.matrix.deliverablesById['deliverable-deferred-anchor']).toBeDefined();
    });
  });

  describe('Field storage verification', () => {
    it('Stores buffer_anchor and buffer_binding together', () => {
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-stored',
          name: 'Artifact Stored Buffer',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'project-anchor',
          buffer_binding: 'hard',
        },
      });
      expect(state.lastPlanError).toBeNull();
      const artifact = state.matrix.artifactsById['artifact-stored'];
      expect(artifact.buffer_anchor).toBe('project-anchor');
      expect(artifact.buffer_binding).toBe('hard');
    });

    it('Stores both binding types: hard and advisory', () => {
      // Hard binding
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-hard-binding',
          name: 'Hard Binding',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'project-anchor',
          buffer_binding: 'hard',
        },
      });
      expect(state.matrix.artifactsById['artifact-hard-binding'].buffer_binding).toBe('hard');

      // Advisory binding
      state = computeDerivedState(state, {
        type: 'DECLARE_ARTIFACT',
        payload: {
          id: 'artifact-advisory-binding',
          name: 'Advisory Binding',
          parentDeliverableIds: ['deliverable-anchor'],
          producedByEntityId: 'entity-producer',
          completionEvidence: 'test',
          verificationSourceId: 'vs-test',
          operatorAttestationMethod: 'test',
          targetDate: '2026-11-20',
          satisfaction_mode: 'AND',
          buffer_anchor: 'initiative-anchor',
          buffer_binding: 'advisory',
        },
      });
      expect(state.matrix.artifactsById['artifact-advisory-binding'].buffer_binding).toBe('advisory');
    });
  });

  describe('Validation: BUFFER_ANCHOR_DEFERRAL_UNRECONCILED', () => {
    // Guards the guard. deferBufferAnchorValidation is a deliberate hole in the reducer's
    // default protection; this invariant is what stops that hole becoming permanent if pass 2
    // ever fails to revalidate what pass 1 deferred.
    const entry = (id) => ({ kind: 'Artifact', id, anchorName: 'anchor-' + id });

    it('Returns null when pass 2 reconciled every deferred anchor', () => {
      const a = entry('a');
      const b = entry('b');
      expect(reconcileDeferredAnchors([a, b], new Set([a, b]))).toBeNull();
    });

    it('Returns null when nothing was deferred', () => {
      expect(reconcileDeferredAnchors([], new Set())).toBeNull();
    });

    it('Rejects when pass 2 left a deferred anchor unvalidated', () => {
      const a = entry('a');
      const b = entry('b');
      const err = reconcileDeferredAnchors([a, b], new Set([a])); // b never revalidated

      expect(err?.code).toBe('BUFFER_ANCHOR_DEFERRAL_UNRECONCILED');
      expect(err.meta.deferred).toBe(2);
      expect(err.meta.reconciled).toBe(1);
      expect(err.meta.outstanding).toEqual([{ kind: 'Artifact', id: 'b', anchorName: 'anchor-b' }]);
    });

    it('Names every outstanding anchor, not just the first', () => {
      const a = entry('a');
      const b = entry('b');
      const c = entry('c');
      const err = reconcileDeferredAnchors([a, b, c], new Set([a]));

      expect(err?.code).toBe('BUFFER_ANCHOR_DEFERRAL_UNRECONCILED');
      expect(err.meta.outstanding.map((e) => e.id)).toEqual(['b', 'c']);
    });
  });

  describe('Reprobe authorization', () => {
    it('ARTIFACT_BUFFER_ANCHOR_UNKNOWN reprobe is authorized', () => {
      // Previously `expect(true).toBe(true)` — a false green sitting beside the test that
      // caught a real regression. Assert what the comment always claimed: the reprobe is
      // registered, and carries the spine + pickSet the UI layer needs to recover from
      // the rejection this gate emits.
      const reprobe = ARTIFACT_REPROBES.ARTIFACT_BUFFER_ANCHOR_UNKNOWN;
      expect(reprobe).toBeDefined();
      expect(typeof reprobe.spine).toBe('string');
      expect(reprobe.spine.length).toBeGreaterThan(0);
      expect(reprobe.pickSet).toBe('allDeclaredNodeOptions');
    });
  });
});
