import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import ZionDashboard from '../../src/components/ZionDashboard.jsx';
import { IdentityProvider, buildBlankIdentityState, DEFAULT_PROFILE_ID } from '../../src/state/identityStore.js';
import { computeDerivedState } from '../../src/state/identityCompute.js';
import { createCoreMissionContractAction, recordCoreMissionRevisionAction } from '../../src/state/coreMissionContractStore.js';
import { buildMasterPlan } from '../../src/domain/masterPlan/masterPlanFactory.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DURABLE_OBJECTIVE = 'Build a sustainable multi-venture platform reaching 10,000 users';
const CURRENT_PHASE = 'foundation';
const REVISION_NOTE = 'Refined strategic thesis after market validation round';

function buildCoreContinuityState({ withRevision = false } = {}) {
  const state = buildBlankIdentityState();

  // 1. Create and store a core mission contract
  const createAction = createCoreMissionContractAction({
    profileId: DEFAULT_PROFILE_ID,
    durableObjective: DURABLE_OBJECTIVE,
    currentPhase: CURRENT_PHASE,
    horizonYears: 3,
    strategicThesis: 'Ship fast, validate with real users, compound on what works',
    nonNegotiables: ['Shipping over planning'],
  });
  const contract = createAction.contract;
  state.coreMissionContractsById[contract.missionId] = contract;
  state.profilesById[DEFAULT_PROFILE_ID].activeCoreMissionContractId = contract.missionId;

  // 2. Create a master plan linked to the mission contract
  const masterPlan = buildMasterPlan({
    profileId: DEFAULT_PROFILE_ID,
    title: 'Multi-Venture Execution Plan',
    northStarOutcome: DURABLE_OBJECTIVE,
    horizonStart: '2026-01-01',
    horizonEnd: '2028-12-31',
    coreMissionContractId: contract.missionId,
    anchors: [{ date: '2026-10-17', label: 'Album drop', isFixed: true }],
  });
  state.masterPlansById[masterPlan.id] = masterPlan;
  state.profilesById[DEFAULT_PROFILE_ID].activeMasterPlanId = masterPlan.id;

  // 3. Optionally record a revision without touching durableObjective
  if (withRevision) {
    const revisionAction = recordCoreMissionRevisionAction(
      contract.missionId,
      REVISION_NOTE,
      { strategicThesis: 'Double down on execution speed' }
    );
    state.coreMissionContractsById[contract.missionId] = {
      ...state.coreMissionContractsById[contract.missionId],
      revisionHistory: [revisionAction.revision],
      updatedAt: new Date().toISOString(),
    };
  }

  return { state: computeDerivedState(state, { type: 'NO_OP' }), missionId: contract.missionId };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Stability — Core Continuity panel', () => {
  it('renders durable objective and current phase from canonical state', () => {
    const { state } = buildCoreContinuityState();

    // coreContinuity should be derived as 'aligned' (mission + linked plan both present)
    expect(state.coreContinuity.state).toBe('aligned');
    expect(state.coreContinuity.activeMissionId).toBeTruthy();

    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={state}>
        <ZionDashboard initialView="stability" assistantOpen={false} />
      </IdentityProvider>
    );

    expect(html).toContain('Core Continuity');
    expect(html).toContain('Durable Objective');
    expect(html).toContain(DURABLE_OBJECTIVE);
    expect(html).toContain('Current Phase');
    expect(html).toContain(CURRENT_PHASE);
    // continuity state label rendered
    expect(html.toLowerCase()).toContain('aligned');
  });

  it('renders latest revision note when revisionHistory is present', () => {
    const { state } = buildCoreContinuityState({ withRevision: true });

    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={state}>
        <ZionDashboard initialView="stability" assistantOpen={false} />
      </IdentityProvider>
    );

    expect(html).toContain('Latest Revision');
    expect(html).toContain(REVISION_NOTE);
  });

  it('durableObjective is not overwritten after revision is recorded', () => {
    const { state, missionId } = buildCoreContinuityState({ withRevision: true });

    const contract = state.coreMissionContractsById[missionId];
    // The durable objective survives the revision unchanged
    expect(contract.durableObjective).toBe(DURABLE_OBJECTIVE);
    // The revision history was appended
    expect(contract.revisionHistory).toHaveLength(1);
    expect(contract.revisionHistory[0].note).toBe(REVISION_NOTE);

    // And the rendered HTML shows the original objective alongside the revision
    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={state}>
        <ZionDashboard initialView="stability" assistantOpen={false} />
      </IdentityProvider>
    );
    expect(html).toContain(DURABLE_OBJECTIVE);
    expect(html).toContain(REVISION_NOTE);
  });

  it('Core Continuity panel is absent when no mission contract exists', () => {
    // Blank state — no mission contract set
    const state = computeDerivedState(buildBlankIdentityState(), { type: 'NO_OP' });

    expect(state.coreContinuity.state).toBe('absent');

    const html = ReactDOMServer.renderToString(
      <IdentityProvider initialState={state}>
        <ZionDashboard initialView="stability" assistantOpen={false} />
      </IdentityProvider>
    );

    // Panel should not appear when there is no active mission
    expect(html).not.toContain('Core Continuity');
    expect(html).not.toContain('Durable Objective');
  });
});
