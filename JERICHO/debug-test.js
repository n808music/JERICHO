import { buildBlankIdentityState } from './src/state/identityStore.js';
import { computeDerivedState } from './src/state/identityCompute.js';

const state = buildBlankIdentityState({ nowISO: '2026-09-05T12:00:00Z' });
state.appTime = { nowISO: '2026-09-05T12:00:00Z' };

let currentState = state;

const steps = [
  { name: 'DECLARE_VERIFICATION_SOURCE', payload: { id: 'vs-test', domain: 'test', source: 'unit_test' } },
  { name: 'DECLARE_INITIATIVE', payload: { id: 'initiative-anchor', name: 'Anchor Initiative', purpose: 'test', doneWhen: 'test', function: 'ops', boundary_type: 'Terminating', completion_value: 'done' } },
  { name: 'DECLARE_ENTITY', payload: { id: 'entity-producer', name: 'Producer', purpose: 'test', formationState: 'formed', statusEvidence: 'test', foundation_initiative: 'initiative-anchor' } },
  { name: 'DECLARE_PROJECT', payload: { id: 'project-anchor', name: 'Anchor Project', executing_entity: 'entity-producer', parent_initiative: 'initiative-anchor', boundary_type: 'Terminating', terminal_date: '2026-12-31', description: 'test', verificationSourceId: 'vs-test' } },
  { name: 'DECLARE_DELIVERABLE', payload: { id: 'deliverable-anchor', name: 'Anchor Deliverable', parentProjectId: 'project-anchor', executingEntityId: 'entity-producer', description: 'test', targetDate: '2026-11-30' } },
];

for (const step of steps) {
  currentState = computeDerivedState(currentState, { type: step.name, payload: step.payload });
  if (currentState.lastPlanError) {
    console.log(`After ${step.name}: ERROR = ${currentState.lastPlanError.code}`);
  } else {
    console.log(`After ${step.name}: OK`);
  }
}

console.log('\nDeliverablesById keys:', Object.keys(currentState.matrix?.deliverablesById || {}));
console.log('Matrix check: deliverable-anchor in matrix?', 'deliverable-anchor' in (currentState.matrix?.deliverablesById || {}));
