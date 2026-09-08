import { buildBlankIdentityState } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';

/**
 * SHARED HELPER: Seeded State for v3 Deliverable Testing
 *
 * Builds a state pre-populated with:
 *   - 1 verification source
 *   - 1 entity (node)
 *   - 1 initiative
 *   - 1 project (declared in the initiative)
 *   - 2 deliverables (declared in the project)
 *
 * Returns a state ready for artifact declarations that reference
 * deliverables via parentDeliverableIds (v3 intake format).
 *
 * Used by:
 *   - tests/state/matrix.artifacts.test.js (artifact intake path)
 *   - (future) artifact-related tests
 */
export function seededDeliverableState() {
  let state = buildBlankIdentityState({});

  // Step 1: Declare verification source
  state = computeDerivedState(state, {
    type: 'DECLARE_VERIFICATION_SOURCE',
    payload: { id: 'src-archive', domain: 'Project archive', source: 'Project archive workspace' },
  });

  // Step 2: Declare entity (node)
  state = computeDerivedState(state, {
    type: 'DECLARE_NODE',
    payload: { id: 'node-gs-corp', name: 'Global State Corp.', roleTags: ['Business'] },
  });

  // Step 3: Declare initiative
  state = computeDerivedState(state, {
    type: 'DECLARE_INITIATIVE',
    payload: {
      id: 'init-music-release',
      name: 'Music Release Initiative',
      owningEntityId: 'node-gs-corp',
      purpose: 'Release Romance Riot album',
      doneWhen: 'Album released on all platforms',
      function: 'ops',
      boundary_type: 'Terminating',
      completion_value: 'Initiative complete',
    },
  });

  // Step 4: Declare project
  state = computeDerivedState(state, {
    type: 'DECLARE_PROJECT',
    payload: {
      id: 'project-romance-riot',
      name: 'Romance Riot',
      owningEntityId: 'node-gs-corp',
      description: '≥10,000 first-week streams',
      verificationSourceId: 'src-archive',
      owningInitiativeId: 'init-music-release',
    },
  });

  // Step 5: Declare v3 deliverables (parent_project + executing_entity + target_date)
  state = computeDerivedState(state, {
    type: 'DECLARE_DELIVERABLE',
    payload: {
      id: 'deliv-rr-recording',
      name: 'Romance Riot recording sessions',
      parent_project: 'project-romance-riot',
      executing_entity: 'node-gs-corp',
      target_date: '2026-08-15',
      description: 'All 12 tracks recorded and mixed',
    },
  });

  state = computeDerivedState(state, {
    type: 'DECLARE_DELIVERABLE',
    payload: {
      id: 'deliv-rr-mastering',
      name: 'Romance Riot mastering',
      parent_project: 'project-romance-riot',
      executing_entity: 'node-gs-corp',
      target_date: '2026-08-25',
      description: 'Master WAV files finalized',
    },
  });

  return state;
}
