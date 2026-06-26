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
import { probeFor } from './reprobes.js';

export { PROJECT_SLOT_ID } from './slots/projectSlot.js';
export { VERIFICATION_SOURCE_SLOT_ID } from './slots/verificationSourceSlot.js';

const SLOT_REGISTRY = {
  [PROJECT_SLOT_ID]: PROJECT_SLOT,
  [VERIFICATION_SOURCE_SLOT_ID]: VERIFICATION_SOURCE_SLOT,
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

function firstFailingGate(slotDef, captured) {
  return slotDef.gate.find((g) => g.detect(captured)) || null;
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
  return { kind, items: [] };
}

function buildProbe({ slotId, goalType, code, matrixSnapshot }) {
  const base = probeFor(code, goalType);
  const slotDef = SLOT_REGISTRY[slotId];
  const gateEntry = slotDef.gate.find((g) => g.code === code);
  const fieldName = gateEntry?.fieldName || null;
  const probe = {
    slotId,
    fieldName,
    code: base.code,
    spine: base.spine,
    examples: base.examples,
    pickSet: null,
    dependencyGap: false,
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
  const failure = firstFailingGate(slotDef, topSlotState.captured);
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
    const failure = firstFailingGate(slotDef, topSlotState.captured);
    if (failure) break;
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
        const peek = nextProbeForCurrentSlot(currentState);
        if (peek.pendingDispatch) {
          // No probe to ask — but a slot is ready to dispatch. Run it.
          const finalized = finalizeCompletedSlots(currentState);
          // Recurse with finalized state to keep walking through dispatches
          // until either a probe is needed or the engine is done.
          return wrap(finalized.state).nextStep();
        }
        return peek;
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
  });
}
