// Jericho Deterministic Elicitation Engine — Spec v1 implementation.
//
// Pure state machine. Zero external runtime. No external completeness call.
// The engine's only output is `DECLARE_*` dispatch payloads consumed by the
// matrix reducers already shipped in `identityCompute.js`.
//
// Architecture decisions for v1:
//   - DIAL: field-at-a-time zero-model. Each probe asks for exactly one
//     named field; the operator's answer maps directly to that field
//     (no `parseToFields` step). This is the most-deterministic end of
//     the spec's recommended dial.
//   - SCOPE: Project slot (Section 5) is the proving ground. The
//     verification-source slot (Section 1A) is spawned when an undeclared
//     source is named, fulfilling §6 and §9.
//   - EXTRACT-NOT-RECALL: the engine carries `capturedFields` for the
//     current session only. It never reads operator-prior state or the
//     ENTERPRISE_IDENTITY_MAP constant as an answer source. The only
//     external read is `matrixSnapshot`, which is host-supplied registry
//     content used for pickSet membership and source-spawn detection.

import { PROJECT_SLOT, PROJECT_SLOT_ID, buildProjectDeclarePayload } from './slots/projectSlot.js';
import {
  VERIFICATION_SOURCE_SLOT,
  VERIFICATION_SOURCE_SLOT_ID,
  buildVerificationSourceDeclarePayload,
} from './slots/verificationSourceSlot.js';
import {
  ENTITY_SLOT,
  ENTITY_SLOT_ID,
  buildEntityDeclarePayload,
  ENTITY_ROLE_TAGS,
  ROLE_TAG_DISPLAY_LABELS,
  FORMATION_STATES,
} from './entitySlot';
import {
  INITIATIVE_SLOT,
  INITIATIVE_SLOT_ID,
  buildInitiativeDeclarePayload,
  INITIATIVE_OWNER_ENTITY_LESS,
  INITIATIVE_CLASSIFICATIONS,
} from './initiativeSlot';
import {
  SYSTEM_SLOT,
  SYSTEM_SLOT_ID,
  buildSystemDeclarePayload,
  SYSTEM_OWNER_ENTITY_LESS,
  SYSTEM_ACTIVATION_STATES,
} from './systemSlot';
import {
  ARTIFACT_SLOT,
  ARTIFACT_SLOT_ID,
  buildArtifactDeclarePayload,
} from './artifactSlot';
import {
  DEPENDENCY_SLOT,
  DEPENDENCY_SLOT_ID,
  buildDependencyDeclarePayload,
} from './dependencySlot';
import {
  CONVERGENCE_SLOT,
  CONVERGENCE_SLOT_ID,
  buildConvergenceDeclarePayload,
} from './convergenceSlot';
import {
  RESOURCE_PROFILE_SLOT,
  RESOURCE_PROFILE_SLOT_ID,
  BINDING_CONSTRAINT_SLOT,
  BINDING_CONSTRAINT_SLOT_ID,
  buildResourceProfileDeclarePayload,
  buildBindingConstraintDeclarePayload,
  unprofiledInitiatives,
} from './resourceProfileSlot';
import { RESOURCE_DIMENSIONS } from './resourceDimensions';
import {
  BOOTSTRAP_SLOT,
  BOOTSTRAP_SLOT_ID,
  buildBootstrapDeclarePayload,
  computeBootstrapCandidates,
} from './bootstrapSlot';
import { probeFor } from './reprobes.js';

// Byte-identical for identical inputs — no interpolation, no randomness.
function buildReadbackSentence(captured) {
  const source = String(captured.verificationSource || '').trim();
  const metric = String(captured.successMetric || '').trim();
  return `Your done-when will read: 'Open ${source} and confirm ${metric}.' Is that the check you'll perform?`;
}

export { PROJECT_SLOT_ID } from './slots/projectSlot.js';
export { VERIFICATION_SOURCE_SLOT_ID } from './slots/verificationSourceSlot.js';
export { ENTITY_SLOT_ID } from './entitySlot';
export { INITIATIVE_SLOT_ID } from './initiativeSlot';
export { SYSTEM_SLOT_ID } from './systemSlot';
export { ARTIFACT_SLOT_ID } from './artifactSlot';
export { DEPENDENCY_SLOT_ID } from './dependencySlot';
export { CONVERGENCE_SLOT_ID } from './convergenceSlot';
export { RESOURCE_PROFILE_SLOT_ID, BINDING_CONSTRAINT_SLOT_ID } from './resourceProfileSlot';
export { BOOTSTRAP_SLOT_ID } from './bootstrapSlot';

const SLOT_REGISTRY = {
  [PROJECT_SLOT_ID]: PROJECT_SLOT,
  [VERIFICATION_SOURCE_SLOT_ID]: VERIFICATION_SOURCE_SLOT,
  [ENTITY_SLOT_ID]: ENTITY_SLOT,
  [INITIATIVE_SLOT_ID]: INITIATIVE_SLOT,
  [SYSTEM_SLOT_ID]: SYSTEM_SLOT,
  [ARTIFACT_SLOT_ID]: ARTIFACT_SLOT,
  [DEPENDENCY_SLOT_ID]: DEPENDENCY_SLOT,
  [CONVERGENCE_SLOT_ID]: CONVERGENCE_SLOT,
  [RESOURCE_PROFILE_SLOT_ID]: RESOURCE_PROFILE_SLOT,
  [BINDING_CONSTRAINT_SLOT_ID]: BINDING_CONSTRAINT_SLOT,
  [BOOTSTRAP_SLOT_ID]: BOOTSTRAP_SLOT,
};

function freshSlotState(slotId) {
  return {
    slotId,
    captured: {},
    completed: false,
    lastFailureCode: null,
  };
}

function topOfStack(stack) {
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

function firstFailingGate(slotDef, captured, ctx) {
  return slotDef.gate.find((g) => g.detect(captured, ctx)) || null;
}

function buildPickSet(kind, matrixSnapshot) {
  if (kind === 'declaredEntities') {
    const entries = Object.values(matrixSnapshot?.entitiesById || {});
    return {
      kind,
      items: entries.map((entity) => ({ id: entity.id, label: entity.name || entity.id })),
    };
  }
  if (kind === 'declaredSources') {
    const entries = Object.values(matrixSnapshot?.verificationSourcesById || {});
    return {
      kind,
      items: entries.map((s) => ({ id: s.id, label: s.source || s.id })),
    };
  }
  if (kind === 'roleTagOptions') {
    return {
      kind,
      items: [...ENTITY_ROLE_TAGS].map((v) => ({ id: v, label: ROLE_TAG_DISPLAY_LABELS[v] || v })),
    };
  }
  if (kind === 'formationStateOptions') {
    return {
      kind,
      items: [...FORMATION_STATES].map((v) => ({ id: v, label: v })),
    };
  }
  if (kind === 'initiativeOwnerOptions') {
    const entries = Object.values(matrixSnapshot?.entitiesById || {});
    const capable = entries.filter(
      (e) => Array.isArray(e.roleTags) && e.roleTags.includes('initiative')
    );
    const items = capable.map((e) => ({ id: e.id, label: e.name || e.id }));
    items.push({ id: INITIATIVE_OWNER_ENTITY_LESS, label: 'entity-less / cross-cutting' });
    return { kind, items };
  }
  if (kind === 'classificationOptions') {
    const LABELS = {
      objective: 'the plan works toward it',
      constraint: 'the plan works around it',
    };
    return {
      kind,
      items: [...INITIATIVE_CLASSIFICATIONS].map((v) => ({ id: v, label: LABELS[v] })),
    };
  }
  if (kind === 'systemOwnerOptions') {
    const entries = Object.values(matrixSnapshot?.entitiesById || {});
    const capable = entries.filter(
      (e) => Array.isArray(e.roleTags) && e.roleTags.includes('system')
    );
    const items = capable.map((e) => ({ id: e.id, label: e.name || e.id }));
    items.push({ id: SYSTEM_OWNER_ENTITY_LESS, label: 'entity-less / cross-cutting' });
    return { kind, items };
  }
  if (kind === 'producingProjectOptions') {
    const entries = Object.values(matrixSnapshot?.projectsById || {});
    return {
      kind,
      items: entries.map((p) => ({ id: p.id, label: p.name || p.id })),
    };
  }
  if (kind === 'activationStateOptions') {
    const LABELS = {
      running: 'running now',
      missing: 'not yet in place',
      planned: 'planned, not started',
    };
    return {
      kind,
      items: [...SYSTEM_ACTIVATION_STATES].map((v) => ({ id: v, label: LABELS[v] })),
    };
  }
  if (kind === 'declaredNodeOptions') {
    // Cross-registry: artifact-only per canonical matrix Section 7.
    const entries = Object.values(matrixSnapshot?.artifactsById || {});
    return {
      kind,
      items: entries.map((a) => ({ id: a.id, label: a.name || a.id, nodeType: 'artifact' })),
    };
  }
  if (kind === 'dependencyTypeOptions') {
    const LABELS = {
      hard_gate: 'hard gate — downstream is blocked until upstream exists',
      directional: 'directional — upstream informs or shapes downstream',
      informational: 'informational — awareness link only, no blocking',
    };
    return {
      kind,
      items: ['hard_gate', 'directional', 'informational'].map((v) => ({ id: v, label: LABELS[v] })),
    };
  }
  if (kind === 'allDeclaredNodeOptions') {
    // Cross-registry: all declared node types (entities, initiatives, systems, projects, artifacts).
    const snap = matrixSnapshot || {};
    const items = [];
    const registries = [
      ['entitiesById', 'entity'],
      ['initiativesById', 'initiative'],
      ['systemsById', 'system'],
      ['projectsById', 'project'],
      ['artifactsById', 'artifact'],
    ];
    for (const [reg, nodeType] of registries) {
      for (const node of Object.values(snap[reg] || {})) {
        items.push({ id: node.id, label: node.name || node.id, nodeType });
      }
    }
    return { kind, items };
  }
  if (kind === 'unprofiledInitiativeOptions') {
    // Subtractive: initiatives that do not yet have a resource profile.
    const ids = unprofiledInitiatives(matrixSnapshot);
    const initiatives = matrixSnapshot?.initiativesById || {};
    return {
      kind,
      items: ids.map((id) => ({ id, label: initiatives[id]?.name || id })),
    };
  }
  if (kind === 'resourceDimensionOptions') {
    const LABELS = {
      money: 'money — capital, costs, funding',
      time: 'time — hours per week, duration',
      skills: 'skills — capabilities, knowledge, expertise',
      tech: 'tech — tools, software, infrastructure',
    };
    return {
      kind,
      items: [...RESOURCE_DIMENSIONS].map((v) => ({ id: v, label: LABELS[v] })),
    };
  }
  if (kind === 'bootstrapCandidateOptions') {
    // First computed pickSet — runs a graph traversal, not a registry read.
    const ranked = computeBootstrapCandidates(matrixSnapshot);
    const artifacts = matrixSnapshot?.artifactsById || {};
    const STATUS_LABEL = {
      'no-gap': 'no gap on binding dimension',
      unknown: 'binding status unknown',
      gap: 'gap on binding dimension',
    };
    return {
      kind,
      items: ranked.map((c) => ({
        id: c.artifactId,
        label: `${artifacts[c.artifactId]?.name || c.artifactId} (${STATUS_LABEL[c.bindingStatus] || c.bindingStatus})`,
        tier: c.tier,
        bindingStatus: c.bindingStatus,
      })),
    };
  }
  return { kind, items: [] };
}

// Slot-type placeholders used in reproe spines, and the captured field that names the item.
// When the name field is already captured, probe text binds to the specific item.
const REFERENT_PLACEHOLDER = {
  [ENTITY_SLOT_ID]:    'this entity',
  [INITIATIVE_SLOT_ID]: 'this initiative',
  [SYSTEM_SLOT_ID]:    'this system',
  [PROJECT_SLOT_ID]:   'this project',
  [ARTIFACT_SLOT_ID]:  'this artifact',
};

function applyReferentBinding(spine, slotId, captured) {
  const placeholder = REFERENT_PLACEHOLDER[slotId];
  if (!placeholder) return spine;
  const capturedName = String(captured?.name || '').trim();
  if (!capturedName) return spine;
  // Replace all occurrences so multi-sentence spines bind fully.
  return spine.split(placeholder).join(`**${capturedName}**`);
}

function buildProbe({ slotId, goalType, code, matrixSnapshot, captured }) {
  const base = probeFor(code, goalType);
  const slotDef = SLOT_REGISTRY[slotId];
  const gateEntry = slotDef.gate.find((g) => g.code === code);
  const fieldName = gateEntry?.fieldName || null;
  const probe = {
    slotId,
    fieldName,
    code: base.code,
    spine: applyReferentBinding(base.spine, slotId, captured),
    examples: base.examples,
    pickSet: null,
    dependencyGap: false,
    isFirstField: Object.keys(captured || {}).length === 0,
  };
  const pickKind = gateEntry?.pickSet || base.pickSet;
  if (pickKind) {
    probe.pickSet = buildPickSet(pickKind, matrixSnapshot);
    if (probe.pickSet.items.length === 0) {
      probe.dependencyGap = true;
    }
  }
  return probe;
}

function nextProbeForCurrentSlot(state) {
  const topSlotState = topOfStack(state.slotStack);
  if (!topSlotState) return { done: true };
  const slotDef = SLOT_REGISTRY[topSlotState.slotId];
  const failure = firstFailingGate(slotDef, topSlotState.captured, { matrixSnapshot: state.matrixSnapshot });
  if (!failure) {
    // Slot fields all present — caller should run dispatch path.
    return {
      done: false,
      pendingDispatch: true,
      probe: null,
    };
  }
  return {
    done: false,
    pendingDispatch: false,
    probe: buildProbe({
      slotId: topSlotState.slotId,
      goalType: state.goalType,
      code: failure.code,
      matrixSnapshot: state.matrixSnapshot,
      captured: topSlotState.captured,
    }),
  };
}

function dispatchForCompletedSlot(state, topSlotState) {
  const slotDef = SLOT_REGISTRY[topSlotState.slotId];
  if (slotDef.slotId === VERIFICATION_SOURCE_SLOT_ID) {
    return {
      type: 'DECLARE_VERIFICATION_SOURCE',
      payload: buildVerificationSourceDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === PROJECT_SLOT_ID) {
    return {
      type: 'DECLARE_PROJECT',
      payload: buildProjectDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === ENTITY_SLOT_ID) {
    return {
      type: 'DECLARE_ENTITY',
      payload: buildEntityDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === INITIATIVE_SLOT_ID) {
    return {
      type: 'DECLARE_INITIATIVE',
      payload: buildInitiativeDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === SYSTEM_SLOT_ID) {
    return {
      type: 'DECLARE_SYSTEM',
      payload: buildSystemDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === ARTIFACT_SLOT_ID) {
    return {
      type: 'DECLARE_ARTIFACT',
      payload: buildArtifactDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === DEPENDENCY_SLOT_ID) {
    return {
      type: 'DECLARE_DEPENDENCY',
      payload: buildDependencyDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === CONVERGENCE_SLOT_ID) {
    return {
      type: 'DECLARE_CONVERGENCE',
      payload: buildConvergenceDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === RESOURCE_PROFILE_SLOT_ID) {
    return {
      type: 'DECLARE_RESOURCE_PROFILE',
      payload: buildResourceProfileDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === BINDING_CONSTRAINT_SLOT_ID) {
    return {
      type: 'DECLARE_BINDING_CONSTRAINT',
      payload: buildBindingConstraintDeclarePayload(topSlotState.captured),
    };
  }
  if (slotDef.slotId === BOOTSTRAP_SLOT_ID) {
    return {
      type: 'DECLARE_BOOTSTRAP',
      payload: buildBootstrapDeclarePayload(topSlotState.captured, state.matrixSnapshot),
    };
  }
  throw new Error(`No dispatch builder registered for slot: ${slotDef.slotId}`);
}

function applyAnswerToCurrentSlot(state, answer) {
  const topSlotState = topOfStack(state.slotStack);
  if (!topSlotState) {
    return { state, dispatches: [] };
  }
  const slotDef = SLOT_REGISTRY[topSlotState.slotId];
  // The operator's answer is a `{ fieldName: value }` bag for the field(s)
  // the probe asked about. We merge it onto captured fields directly
  // (zero-model: no parse step).
  const merged = { ...topSlotState.captured, ...answer };
  const nextSlotState = { ...topSlotState, captured: merged };
  let nextStack = [...state.slotStack.slice(0, -1), nextSlotState];

  // Special case: Project's PROJECT_SOURCE_MISSING gate.
  // If the answer carries `verificationSource` (the source label) and that
  // label is not yet declared in matrixSnapshot, we SPAWN the Section 1A
  // slot. The spawn captures `source` from this answer and asks for the
  // `domain` next. When the VS slot completes and dispatches, we pop back
  // to Project and set `verificationSourceId` to the new source's id.
  if (
    nextSlotState.slotId === PROJECT_SLOT_ID &&
    merged.verificationSource &&
    !merged.verificationSourceId
  ) {
    const labelToMatch = String(merged.verificationSource || '').trim().toLowerCase();
    const declared = Object.values(state.matrixSnapshot?.verificationSourcesById || {});
    const found = declared.find(
      (s) => String(s.source || '').trim().toLowerCase() === labelToMatch
    );
    if (found) {
      // Already declared — bind directly, no spawn needed.
      const bound = { ...nextSlotState, captured: { ...merged, verificationSourceId: found.id } };
      nextStack = [...state.slotStack.slice(0, -1), bound];
    } else {
      // Spawn Section 1A with source pre-captured (from this same answer).
      const spawned = {
        ...freshSlotState(VERIFICATION_SOURCE_SLOT_ID),
        captured: { source: merged.verificationSource, ...(answer.domain ? { domain: answer.domain } : {}) },
      };
      nextStack = [...state.slotStack.slice(0, -1), nextSlotState, spawned];
    }
  }

  return {
    state: { ...state, slotStack: nextStack },
    dispatches: [],
  };
}

function finalizeCompletedSlots(state) {
  // Walk from top of stack: any slot whose gate passes gets dispatched and
  // popped. When a VS slot pops, attach its new id to its parent's
  // verificationSourceId so the parent's gate now passes too.
  let nextState = state;
  const dispatches = [];
  let safety = 0;
  while (safety++ < 10) {
    const topSlotState = topOfStack(nextState.slotStack);
    if (!topSlotState) break;
    const slotDef = SLOT_REGISTRY[topSlotState.slotId];
    const failure = firstFailingGate(slotDef, topSlotState.captured, { matrixSnapshot: nextState.matrixSnapshot });
    if (failure) break;
    // PROJECT_SLOT requires operator confirmation before dispatching.
    if (topSlotState.slotId === PROJECT_SLOT_ID) {
      if (!nextState.readbackPending) {
        const sentence = buildReadbackSentence(topSlotState.captured);
        nextState = {
          ...nextState,
          readbackPending: {
            sentence,
            fields: {
              name: topSlotState.captured.name,
              successMetric: topSlotState.captured.successMetric,
              verificationSource: topSlotState.captured.verificationSource,
            },
          },
        };
      }
      break;
    }
    const action = dispatchForCompletedSlot(nextState, topSlotState);
    dispatches.push(action);
    let poppedStack = nextState.slotStack.slice(0, -1);
    // If the completed slot was a VS spawn, write its new id back to the
    // parent Project's `verificationSourceId` so the parent gate passes.
    if (
      topSlotState.slotId === VERIFICATION_SOURCE_SLOT_ID &&
      poppedStack.length > 0
    ) {
      const parent = poppedStack[poppedStack.length - 1];
      if (parent.slotId === PROJECT_SLOT_ID) {
        const parentNext = {
          ...parent,
          captured: {
            ...parent.captured,
            verificationSourceId: action.payload.id,
          },
        };
        poppedStack = [...poppedStack.slice(0, -1), parentNext];
      }
    }
    nextState = {
      ...nextState,
      slotStack: poppedStack,
      completedSlotIds: new Set([...nextState.completedSlotIds, topSlotState.slotId]),
    };
  }
  return { state: nextState, dispatches };
}

export function createElicitationEngine({ goalType, matrixSnapshot, scope = [PROJECT_SLOT_ID] }) {
  const initialStack = scope.map((slotId) => freshSlotState(slotId)).reverse();
  // Engine state is captured in closure; methods return *new* engine
  // instances. Determinism property: same goalType + same answer sequence →
  // identical probe sequence and dispatch set.
  function wrap(currentState) {
    return {
      goalType: currentState.goalType,
      openingStep() {
        return nextProbeForCurrentSlot(currentState);
      },
      nextStep() {
        if (currentState.readbackPending) {
          return { done: false, readback: currentState.readbackPending };
        }
        const peek = nextProbeForCurrentSlot(currentState);
        if (peek.pendingDispatch) {
          // No probe to ask — but a slot is ready to dispatch. Run it.
          const finalized = finalizeCompletedSlots(currentState);
          if (finalized.state.readbackPending) {
            return { done: false, readback: finalized.state.readbackPending };
          }
          // Recurse with finalized state to keep walking through dispatches
          // until either a probe is needed or the engine is done.
          return wrap(finalized.state).nextStep();
        }
        return peek;
      },
      confirmReadback({ confirmed, reopen }) {
        if (!currentState.readbackPending) {
          throw new Error('confirmReadback called with no readback pending');
        }
        const topSlotState = topOfStack(currentState.slotStack);
        if (confirmed) {
          const action = dispatchForCompletedSlot(currentState, topSlotState);
          const poppedStack = currentState.slotStack.slice(0, -1);
          const nextState = {
            ...currentState,
            slotStack: poppedStack,
            readbackPending: null,
            completedSlotIds: new Set([...currentState.completedSlotIds, topSlotState.slotId]),
          };
          return { engine: wrap(nextState), dispatches: [action] };
        }
        // confirmed: false — clear the named field, preserve all siblings
        const nextCaptured = { ...topSlotState.captured };
        delete nextCaptured[reopen];
        const nextSlotState = { ...topSlotState, captured: nextCaptured };
        const nextStack = [...currentState.slotStack.slice(0, -1), nextSlotState];
        const nextState = {
          ...currentState,
          slotStack: nextStack,
          readbackPending: null,
        };
        return { engine: wrap(nextState), dispatches: [] };
      },
      consumeAnswer(answer) {
        const applied = applyAnswerToCurrentSlot(currentState, answer);
        const finalized = finalizeCompletedSlots(applied.state);
        return {
          engine: wrap(finalized.state),
          dispatches: [...applied.dispatches, ...finalized.dispatches],
        };
      },
      refreshMatrix(nextSnapshot) {
        return wrap({ ...currentState, matrixSnapshot: nextSnapshot });
      },
      snapshotCapturedFields() {
        const top = topOfStack(currentState.slotStack);
        return top ? { ...top.captured } : {};
      },
      snapshotState() {
        return {
          goalType: currentState.goalType,
          slotStack: currentState.slotStack.map((s) => ({ ...s, captured: { ...s.captured } })),
          completedSlotIds: [...currentState.completedSlotIds],
        };
      },
    };
  }
  return wrap({
    goalType,
    matrixSnapshot: matrixSnapshot || {},
    slotStack: initialStack,
    completedSlotIds: new Set(),
    readbackPending: null,
  });
}
