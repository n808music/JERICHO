import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import {
  createElicitationEngine,
  ENTITY_SLOT_ID,
  INITIATIVE_SLOT_ID,
  SYSTEM_SLOT_ID,
  PROJECT_SLOT_ID,
  ARTIFACT_SLOT_ID,
  DEPENDENCY_SLOT_ID,
  CONVERGENCE_SLOT_ID,
  RESOURCE_PROFILE_SLOT_ID,
  BINDING_CONSTRAINT_SLOT_ID,
  BOOTSTRAP_SLOT_ID,
} from '../../domain/elicitation/elicitationEngine.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SLOT_META = {
  [ENTITY_SLOT_ID]:             { label: 'Entity',             section: '§2',  color: '#60a5fa', plural: 'entities' },
  [INITIATIVE_SLOT_ID]:         { label: 'Initiative',         section: '§3',  color: '#a78bfa', plural: 'initiatives' },
  [SYSTEM_SLOT_ID]:             { label: 'System',             section: '§4',  color: '#c084fc', plural: 'systems' },
  [PROJECT_SLOT_ID]:            { label: 'Project',            section: '§5',  color: '#34d399', plural: 'projects' },
  [ARTIFACT_SLOT_ID]:           { label: 'Artifact',           section: '§6',  color: '#fb923c', plural: 'artifacts' },
  [DEPENDENCY_SLOT_ID]:         { label: 'Dependency',         section: '§7',  color: '#f472b6', plural: 'dependencies' },
  [CONVERGENCE_SLOT_ID]:        { label: 'Convergence',        section: '§8',  color: '#e879f9', plural: 'convergences' },
  [RESOURCE_PROFILE_SLOT_ID]:   { label: 'Resource profile',  section: '§9',  color: '#4ade80', plural: 'resource profiles' },
  [BINDING_CONSTRAINT_SLOT_ID]: { label: 'Binding constraint', section: '§9b', color: '#facc15', plural: 'binding constraints' },
  [BOOTSTRAP_SLOT_ID]:          { label: 'Bootstrap plan',    section: '§10', color: '#fbbf24', plural: 'bootstrap steps' },
};

// Brief context shown above each probe (PART C)
const SECTION_FRAMING = {
  [ENTITY_SLOT_ID]:             'Who or what are the main actors, organizations, or stakeholders involved?',
  [INITIATIVE_SLOT_ID]:         'What distinct campaigns, programs, or work streams will drive this goal?',
  [SYSTEM_SLOT_ID]:             'What tools, platforms, or systems need to be built, configured, or integrated?',
  [PROJECT_SLOT_ID]:            'What specific projects or deliverable streams need to happen?',
  [ARTIFACT_SLOT_ID]:           'What tangible outputs, documents, or products will be produced?',
  [DEPENDENCY_SLOT_ID]:         'What depends on what? Map the work sequencing.',
  [CONVERGENCE_SLOT_ID]:        'Where do separate work streams merge, hand off, or combine?',
  [RESOURCE_PROFILE_SLOT_ID]:   'Who is doing the work and what resources are they working with?',
  [BINDING_CONSTRAINT_SLOT_ID]: 'What single resource or capacity is the bottleneck for the entire plan?',
  [BOOTSTRAP_SLOT_ID]:          'How does the work get started — what needs to happen first?',
};

// Relevance question before entering optional sections (Rule 5)
const SCOPE_QUESTIONS = {
  [INITIATIVE_SLOT_ID]:         'Will this goal involve multiple distinct initiatives, campaigns, or work programs running in parallel?',
  [SYSTEM_SLOT_ID]:             'Are there software systems, platforms, or tools that need to be built, configured, or integrated?',
  [ARTIFACT_SLOT_ID]:           'Will specific deliverables, products, documents, or artifacts be produced?',
  [DEPENDENCY_SLOT_ID]:         'Are there work items where one must be completed before another can start?',
  [CONVERGENCE_SLOT_ID]:        'Are there points where separate work streams merge or hand off to a shared outcome?',
  [RESOURCE_PROFILE_SLOT_ID]:   'Do you have team members with specific roles and resource allocations to map?',
  [BINDING_CONSTRAINT_SLOT_ID]: 'Is there a single resource — budget, a specific person, or capacity — that is the bottleneck for your timeline?',
};

// Natural language overrides for schema-heavy probe text (Rule 2 — copy only, no gate logic changed)
const PROBE_OVERRIDES = {
  verificationSourceId:    'What confirms when this project is done — which review, milestone, or observable result?',
  completionEvidence:      'What does "done" look like for this artifact? Describe the evidence or state you can point to.',
  dependencyType:          'How does this dependency work — does one block the other, or is it a preferred ordering?',
  edgeType:                'How do these work streams connect — does one feed into the other, or do they merge into a shared output?',
  bindingDimension:        'What is the bottleneck — a specific person\'s time, budget, or something else?',
  resourceDimensionLabel:  'Name that constraint specifically — who or what exactly is the bottleneck?',
  needStatement:           'What does this person or role need to do their work? Be specific.',
  gapStatement:            'What\'s currently missing for this role? If nothing, say "none" or "not started".',
  activationState:         'Is this system currently live, actively being built, or just planned?',
  classification:          'What type of initiative is this — building something, launching a campaign, operations, or something else?',
};

// Optional sections require a scoping question before entering (Rule 5)
const OPTIONAL_SECTIONS = new Set([
  INITIATIVE_SLOT_ID,
  SYSTEM_SLOT_ID,
  ARTIFACT_SLOT_ID,
  DEPENDENCY_SLOT_ID,
  CONVERGENCE_SLOT_ID,
  RESOURCE_PROFILE_SLOT_ID,
  BINDING_CONSTRAINT_SLOT_ID,
]);

// Blocker codes: show a CTA, not an answer surface
const BLOCKER_CODES = new Set(['BINDING_COVERAGE_INCOMPLETE']);

// roleTagOptions is the only multi-select pickSet kind
const MULTI_SELECT_KINDS = new Set(['roleTagOptions']);

// Dependency-respecting slot order: spine first, then sub-structures, then edges, then bootstrap last
const FULL_SLOT_ORDER = [
  ENTITY_SLOT_ID,
  INITIATIVE_SLOT_ID,
  SYSTEM_SLOT_ID,
  PROJECT_SLOT_ID,
  ARTIFACT_SLOT_ID,
  DEPENDENCY_SLOT_ID,
  CONVERGENCE_SLOT_ID,
  RESOURCE_PROFILE_SLOT_ID,
  BINDING_CONSTRAINT_SLOT_ID,
  BOOTSTRAP_SLOT_ID,
];

function makeSlotEngine(matrix, slotId) {
  return createElicitationEngine({
    goalType: 'generic',
    matrixSnapshot: matrix || {},
    scope: [slotId],
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionPill({ slotId }) {
  const meta = SLOT_META[slotId] || { label: slotId, section: '', color: '#71717a' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
        color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}40`,
        padding: '2px 8px', borderRadius: 4,
      }}>
        {meta.section}
      </span>
      <span style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {meta.label}
      </span>
    </div>
  );
}

function PickSetInput({ pickSet, selected, onChange }) {
  const isMulti = MULTI_SELECT_KINDS.has(pickSet.kind);
  const toggle = (id) => {
    if (isMulti) {
      onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    } else {
      onChange([id]);
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
      {pickSet.items.map(item => {
        const active = selected.includes(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: active ? 600 : 400,
              border: `1px solid ${active ? '#60a5fa' : '#3f3f46'}`,
              background: active ? '#1e3a5f' : '#18181b',
              color: active ? '#93c5fd' : '#a1a1aa',
              cursor: 'pointer', transition: 'all 0.12s',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({ value, onChange, onEnter, rows = 2 }) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(); }
      }}
      placeholder="Type your answer…"
      style={{
        width: '100%', boxSizing: 'border-box', padding: '10px 12px',
        background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8,
        color: '#f4f4f5', fontSize: 13, lineHeight: 1.6, resize: 'vertical',
        fontFamily: 'inherit', outline: 'none',
      }}
    />
  );
}

function ReadbackScreen({ readback, onConfirm, onReopen }) {
  return (
    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Confirm — Project
      </div>
      <div style={{
        background: '#0c1a2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '16px 20px',
      }}>
        <p style={{ fontSize: 14, color: '#e2e8f0', lineHeight: 1.7, margin: 0 }}>{readback.sentence}</p>
      </div>
      {readback.fields && (
        <div>
          <p style={{ fontSize: 11, color: '#71717a', marginBottom: 8 }}>Reopen a field:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(readback.fields).map(([field, val]) => (
              <button
                key={field}
                type="button"
                onClick={() => onReopen(field)}
                style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12,
                  border: '1px solid #3f3f46', background: '#18181b', color: '#a1a1aa', cursor: 'pointer',
                }}
              >
                {field}: <span style={{ color: '#60a5fa' }}>{String(val || '—').slice(0, 40)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={onConfirm}
        style={{
          alignSelf: 'flex-start', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: '#064e3b', border: '1px solid #047857', color: '#6ee7b7', cursor: 'pointer',
        }}
      >
        Looks right — confirm
      </button>
    </div>
  );
}

// ── Phase screens ─────────────────────────────────────────────────────────────

function GoalEntryScreen({ onAdmit, admissionError }) {
  const [goalText, setGoalText] = useState('');
  const [deadlineDateStr, setDeadlineDateStr] = useState('');
  const [localError, setLocalError] = useState(null);

  const handleSubmit = () => {
    const text = goalText.trim();
    if (!text) { setLocalError('Describe your goal to continue.'); return; }
    if (!deadlineDateStr) { setLocalError('A target deadline is required for planning.'); return; }
    setLocalError(null);
    onAdmit({ goalText: text, deadlineDayKey: deadlineDateStr });
  };

  const isClarityReprobe = !localError && admissionError?.codes?.includes?.('NO_DEFINITE_END_STATE');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          {isClarityReprobe ? 'Name the recognizable outcome' : 'Describe your goal'}
        </div>
        <textarea
          value={goalText}
          rows={4}
          onChange={e => setGoalText(e.target.value)}
          placeholder="What are you trying to accomplish? Be specific about the outcome and scale."
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px',
            background: '#18181b',
            border: isClarityReprobe ? '1px solid #d97706' : '1px solid #3f3f46',
            borderRadius: 8,
            color: '#f4f4f5', fontSize: 14, lineHeight: 1.7, resize: 'vertical',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Target deadline
        </div>
        <input
          type="date"
          value={deadlineDateStr}
          onChange={e => setDeadlineDateStr(e.target.value)}
          style={{
            padding: '8px 12px', background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 8, color: '#f4f4f5', fontSize: 13, fontFamily: 'inherit',
            outline: 'none', colorScheme: 'dark',
          }}
        />
      </div>
      {isClarityReprobe && (
        <div style={{
          fontSize: 13, color: '#fcd34d', background: '#1c1407',
          border: '1px solid #d97706', borderRadius: 6, padding: '10px 14px',
          lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600 }}>↩ What specifically would be true if you achieved this?</span>
          {' '}Name the recognizable outcome — the thing you'd point to and say <em>"done."</em>
        </div>
      )}
      {!isClarityReprobe && localError && (
        <div style={{
          fontSize: 12, color: '#fca5a5', background: '#1c0a0a',
          border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px',
        }}>
          {localError}
        </div>
      )}
      {!isClarityReprobe && !localError && admissionError && (
        <div style={{
          fontSize: 12, color: '#fca5a5', background: '#1c0a0a',
          border: '1px solid #7f1d1d', borderRadius: 6, padding: '8px 12px',
        }}>
          {admissionError.message}
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        style={{
          alignSelf: 'flex-start', padding: '10px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600,
          background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd',
          cursor: 'pointer', transition: 'all 0.12s',
        }}
      >
        Begin matrix intake →
      </button>
    </div>
  );
}

function ScopeScreen({ slotId, onYes, onSkip }) {
  const meta = SLOT_META[slotId] || { label: slotId, color: '#71717a' };
  const question = SCOPE_QUESTIONS[slotId] || `Does this goal involve ${meta.label.toLowerCase()}?`;
  return (
    <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionPill slotId={slotId} />
      <p style={{ fontSize: 15, fontWeight: 500, color: '#f4f4f5', lineHeight: 1.6, margin: 0 }}>
        {question}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onYes}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd', cursor: 'pointer',
          }}
        >
          Yes, include this
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 400,
            background: '#18181b', border: '1px solid #3f3f46', color: '#71717a', cursor: 'pointer',
          }}
        >
          Not for this goal — skip
        </button>
      </div>
    </div>
  );
}

function LoopCheckScreen({ slotId, onAddMore, onContinue }) {
  const meta = SLOT_META[slotId] || { label: slotId, plural: 'items', color: '#71717a' };
  return (
    <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionPill slotId={slotId} />
      <p style={{ fontSize: 15, fontWeight: 500, color: '#f4f4f5', lineHeight: 1.6, margin: 0 }}>
        Is there another {meta.label.toLowerCase()} to capture?
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onAddMore}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd', cursor: 'pointer',
          }}
        >
          Yes, add another {meta.label.toLowerCase()}
        </button>
        <button
          type="button"
          onClick={onContinue}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 400,
            background: '#18181b', border: '1px solid #3f3f46', color: '#a1a1aa', cursor: 'pointer',
          }}
        >
          No, continue →
        </button>
      </div>
    </div>
  );
}

function DoneScreen({ onAddMore }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#f4f4f5', marginBottom: 4 }}>
        Intake complete
      </p>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>
        Matrix populated. Routing to plan view…
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: '+ Entity',     slotId: ENTITY_SLOT_ID },
          { label: '+ Initiative', slotId: INITIATIVE_SLOT_ID },
          { label: '+ Project',    slotId: PROJECT_SLOT_ID },
          { label: '+ Artifact',   slotId: ARTIFACT_SLOT_ID },
        ].map(({ label, slotId }) => (
          <button
            key={slotId}
            type="button"
            onClick={() => onAddMore(slotId)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12,
              border: '1px solid #3f3f46', background: '#18181b', color: '#a1a1aa', cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatrixIntake({ onSurveyStarted, onComplete } = {}) {
  const store = useIdentityStore();
  const activeCycle = store.activeCycleId ? store.cyclesById?.[store.activeCycleId] : null;
  const hasAdmittedGoal = Boolean(activeCycle?.goalContract);

  // INSTRUMENTATION — mount/unmount lifecycle
  useEffect(() => {
    console.log('[MatrixIntake] MOUNT — hasAdmittedGoal on mount:', hasAdmittedGoal);
    return () => console.log('[MatrixIntake] UNMOUNT');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase machine: goal → scope → engine → loop → [scope|engine|done]
  const [phase, setPhase] = useState(() => hasAdmittedGoal ? 'entering' : 'goal');

  // Remaining slots to process (front of queue = current)
  const [slotQueue, setSlotQueue] = useState(() =>
    hasAdmittedGoal ? [...FULL_SLOT_ORDER] : []
  );

  // Engine state
  const [engine, setEngine] = useState(null);
  const [step, setStep] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [selected, setSelected] = useState([]);
  const [isReprobe, setIsReprobe] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const prevFieldRef = useRef(null);

  // Goal admission error (shown in Phase 0)
  const [admissionError, setAdmissionError] = useState(null);

  // ── Slot advancement helper ──────────────────────────────────────────────────
  // Walks forward through queue, skipping empty slots, until it finds work to do.
  // Sets phase to 'scope' (optional section), 'engine' (mandatory or confirmed), or 'done'.
  const enterQueue = useCallback((queue, matrix) => {
    let remaining = [...queue];
    while (remaining.length > 0) {
      const slotId = remaining[0];
      if (OPTIONAL_SECTIONS.has(slotId)) {
        setSlotQueue(remaining);
        setPhase('scope');
        return;
      }
      const eng = makeSlotEngine(matrix, slotId);
      const s = eng.nextStep();
      if (!s.done) {
        setSlotQueue(remaining);
        setEngine(eng);
        setStep(s);
        setInputValue('');
        setSelected([]);
        setIsReprobe(false);
        prevFieldRef.current = null;
        setPendingRefresh(false);
        setPhase('engine');
        return;
      }
      remaining = remaining.slice(1);
    }
    setSlotQueue([]);
    setPhase('done');
  }, []);

  // Enter the current head of slotQueue after the user confirmed relevance (scope → engine)
  const enterCurrentSlot = useCallback((matrix) => {
    const slotId = slotQueue[0];
    if (!slotId) { setPhase('done'); return; }
    const eng = makeSlotEngine(matrix || store.matrix, slotId);
    const s = eng.nextStep();
    if (s.done) {
      enterQueue(slotQueue.slice(1), matrix || store.matrix);
      return;
    }
    setEngine(eng);
    setStep(s);
    setInputValue('');
    setSelected([]);
    setIsReprobe(false);
    prevFieldRef.current = null;
    setPendingRefresh(false);
    setPhase('engine');
  }, [slotQueue, store.matrix, enterQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  const advanceSlot = useCallback(() => {
    const nextQueue = slotQueue.slice(1);
    setEngine(null);
    setStep(null);
    setInputValue('');
    setSelected([]);
    setIsReprobe(false);
    prevFieldRef.current = null;
    setPendingRefresh(false);
    enterQueue(nextQueue, store.matrix);
  }, [slotQueue, store.matrix, enterQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  // On mount with admitted goal (remount after Phase 0 completes and store updates)
  useEffect(() => {
    if (phase === 'entering') {
      enterQueue([...FULL_SLOT_ORDER], store.matrix);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Transition: when the store admits the goal (Phase 0 → scope/engine)
  const prevAdmittedRef = useRef(hasAdmittedGoal);
  useEffect(() => {
    console.log('[MatrixIntake] hasAdmittedGoal effect — prev:', prevAdmittedRef.current, 'current:', hasAdmittedGoal);
    if (!prevAdmittedRef.current && hasAdmittedGoal) {
      prevAdmittedRef.current = true;
      console.log('[MatrixIntake] → calling enterQueue (transition to survey)');
      enterQueue([...FULL_SLOT_ORDER], store.matrix);
    }
  }, [hasAdmittedGoal]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a dispatch fires and store.matrix updates, refresh the engine
  useEffect(() => {
    if (!pendingRefresh || !engine) return;
    const refreshed = engine.refreshMatrix(store.matrix);
    const s = refreshed.nextStep();
    setPendingRefresh(false);
    setInputValue('');
    setSelected([]);
    setIsReprobe(false);
    prevFieldRef.current = null;
    if (s.done) {
      setEngine(null);
      setStep(null);
      setPhase('loop');
    } else {
      setEngine(refreshed);
      setStep(s);
    }
  }, [pendingRefresh, store.matrix]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to plan tab when done
  useEffect(() => {
    if (phase === 'done') {
      store.markMatrixIntakeComplete?.();
      onComplete?.();
      const t = setTimeout(() => { window.location.hash = '#/plan'; }, 1200);
      return () => clearTimeout(t);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ──────────────────────────────────────────────────────────

  const handleGoalAdmit = useCallback(({ goalText, deadlineDayKey }) => {
    setAdmissionError(null);
    onSurveyStarted?.(); // signal parent to keep MODULE 1 alive through admission + survey
    console.log('[MatrixIntake] handleGoalAdmit — dispatching attemptGoalAdmission');
    const goalId = crypto?.randomUUID?.() ?? `goal-${Date.now()}`;
    const result = store.attemptGoalAdmission?.({
      contract: {
        goalId,
        goalText,
        goalLabel: goalText,
        terminalOutcome: { text: goalText },
        deadline: { dayKey: deadlineDayKey },
        goalDraftV2: { goalText, goalLabel: goalText },
      },
      goalDraftV2: { goalText, goalLabel: goalText },
    });
    console.log('[MatrixIntake] attemptGoalAdmission result:', result?.status, result?.rejectionCodes);
    if (result?.status === 'REJECTED') {
      setAdmissionError({
        codes: result.rejectionCodes || [],
        message: result.rejectionReason || `Could not admit goal: ${(result.rejectionCodes || []).join(', ')}`,
      });
    }
    // On success: store update → hasAdmittedGoal flips → useEffect above transitions to scope
  }, [store]);

  const handleSubmit = useCallback(() => {
    if (!engine || !step?.probe) return;
    const { probe } = step;
    const fieldName = probe.fieldName;
    if (!fieldName) return;

    const isMulti = MULTI_SELECT_KINDS.has(probe.pickSet?.kind);
    let value;
    if (probe.pickSet) {
      value = isMulti ? [...selected] : (selected[0] ?? null);
    } else {
      value = inputValue.trim() || null;
    }
    if (value === null || (Array.isArray(value) && value.length === 0)) return;

    const { engine: next, dispatches } = engine.consumeAnswer({ [fieldName]: value });
    if (dispatches.length > 0) {
      dispatches.forEach(action => store.matrixDispatch(action));
      setEngine(next);
      setPendingRefresh(true);
    } else {
      const nextStep = next.nextStep();
      const wasReprobe = nextStep.probe?.fieldName === fieldName;
      setIsReprobe(wasReprobe);
      prevFieldRef.current = fieldName;
      setEngine(next);
      setStep(nextStep);
      setInputValue('');
      setSelected([]);
    }
  }, [engine, step, inputValue, selected, store]);

  const handleReadbackConfirm = useCallback((confirmed, reopenField = null) => {
    if (!engine) return;
    const { engine: next, dispatches } = engine.confirmReadback({ confirmed, reopen: reopenField });
    if (dispatches.length > 0) {
      dispatches.forEach(action => store.matrixDispatch(action));
      setEngine(next);
      setPendingRefresh(true);
    } else {
      const s = next.nextStep();
      setEngine(next);
      setStep(s);
      setInputValue('');
      setSelected([]);
    }
  }, [engine, store]);

  const handleLoopAddMore = useCallback(() => {
    // Re-enter same slot with fresh engine and updated matrix
    const slotId = slotQueue[0];
    if (!slotId) return;
    const eng = makeSlotEngine(store.matrix, slotId);
    const s = eng.nextStep();
    if (s.done) { advanceSlot(); return; }
    setEngine(eng);
    setStep(s);
    setInputValue('');
    setSelected([]);
    setIsReprobe(false);
    prevFieldRef.current = null;
    setPendingRefresh(false);
    setPhase('engine');
  }, [slotQueue, store.matrix, advanceSlot]);

  const handleBlockerAddResource = useCallback(() => {
    // Re-insert RESOURCE_PROFILE_SLOT_ID at the front of the queue, then continue
    const withResource = [RESOURCE_PROFILE_SLOT_ID, ...slotQueue];
    setEngine(null);
    setStep(null);
    enterQueue(withResource, store.matrix);
  }, [slotQueue, store.matrix, enterQueue]);

  const handleAddMoreFromDone = useCallback((slotId) => {
    enterQueue([slotId], store.matrix);
  }, [store.matrix, enterQueue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ───────────────────────────────────────────────────────────────────

  if (phase === 'goal') {
    return (
      <div>
        <div style={{ fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 20 }}>
          Goal · Matrix Intake
        </div>
        <GoalEntryScreen onAdmit={handleGoalAdmit} admissionError={admissionError} />
      </div>
    );
  }

  if (phase === 'done') {
    return <DoneScreen onAddMore={handleAddMoreFromDone} />;
  }

  if (phase === 'entering' || (!slotQueue.length && phase !== 'done')) {
    return <div style={{ padding: 24, color: '#71717a', fontSize: 13 }}>Initializing…</div>;
  }

  const currentSlotId = slotQueue[0];

  if (phase === 'scope' && currentSlotId && OPTIONAL_SECTIONS.has(currentSlotId)) {
    return (
      <ScopeScreen
        slotId={currentSlotId}
        onYes={() => enterCurrentSlot(store.matrix)}
        onSkip={advanceSlot}
      />
    );
  }

  if (phase === 'loop' && currentSlotId) {
    return (
      <LoopCheckScreen
        slotId={currentSlotId}
        onAddMore={handleLoopAddMore}
        onContinue={advanceSlot}
      />
    );
  }

  if (!engine || !step) {
    return <div style={{ padding: 24, color: '#71717a', fontSize: 13 }}>Loading…</div>;
  }

  if (step.readback) {
    return (
      <ReadbackScreen
        readback={step.readback}
        onConfirm={() => handleReadbackConfirm(true, null)}
        onReopen={(field) => handleReadbackConfirm(false, field)}
      />
    );
  }

  const { probe } = step;
  const isBlocker = BLOCKER_CODES.has(probe.code);

  if (isBlocker) {
    const remaining = probe.pickSet?.items || [];
    return (
      <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionPill slotId={probe.slotId} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#18181b', lineHeight: 1.45 }}>
          {probe.spine}
        </div>
        {remaining.length > 0 && (
          <div style={{ fontSize: 12, color: '#52525b' }}>
            Still needs profiling:{' '}
            <span style={{ color: '#fbbf24' }}>{remaining.map(i => i.label).join(', ')}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleBlockerAddResource}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: '#052e16', border: '1px solid #047857', color: '#6ee7b7', cursor: 'pointer',
            }}
          >
            Add resource profile →
          </button>
          <button
            type="button"
            onClick={advanceSlot}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 400,
              background: '#18181b', border: '1px solid #3f3f46', color: '#71717a', cursor: 'pointer',
            }}
          >
            Skip binding constraint
          </button>
        </div>
      </div>
    );
  }

  const isMulti = MULTI_SELECT_KINDS.has(probe.pickSet?.kind);
  const canSubmit = probe.pickSet ? selected.length > 0 : inputValue.trim().length > 0;
  const framingText = SECTION_FRAMING[probe.slotId];
  const displaySpine = PROBE_OVERRIDES[probe.fieldName] || probe.spine;

  return (
    <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionPill slotId={probe.slotId} />

      {/* Section intent framing — eyebrow, first probe of slot only (PART C).
          Muted but readable on the light card. */}
      {framingText && probe.isFirstField && (
        <div data-testid="intake-framing" style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.4 }}>
          {framingText}
        </div>
      )}

      {/* Question — the primary text: largest, boldest, near-black full-contrast
          on the light card. (Gap 1: was near-white #f4f4f5 → invisible on white.) */}
      <div data-testid="intake-question" style={{ fontSize: 18, fontWeight: 700, color: '#18181b', lineHeight: 1.45 }}>
        {displaySpine}
      </div>

      {/* Examples — smaller than the question but fully legible near-black. */}
      {probe.examples && (
        <div data-testid="intake-examples" style={{
          fontSize: 13, color: '#3f3f46', lineHeight: 1.6, borderLeft: '2px solid #d4d4d8', paddingLeft: 10,
        }}>
          {probe.examples}
        </div>
      )}

      {/* Reprobe — visually distinct from new questions (PART C, Rule 6 hint) */}
      {isReprobe && (
        <div style={{
          fontSize: 12, background: '#1c1007', border: '1px solid #78350f',
          borderRadius: 6, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start',
        }}>
          <span style={{ color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>↩</span>
          <span style={{ color: '#fbbf24' }}>
            That answer needs more specificity. If you don't know yet, say "not started" or "unknown" — that's fine.
          </span>
        </div>
      )}

      {/* Dependency gap: prerequisites not yet declared */}
      {probe.dependencyGap && (
        <div style={{
          fontSize: 12, color: '#94a3b8', background: '#0f172a',
          border: '1px solid #1e3a5f', borderRadius: 6, padding: '8px 12px',
        }}>
          No options available yet — declare the required records first, then this field will unlock.
        </div>
      )}

      {/* Answer surface */}
      {probe.pickSet && !probe.dependencyGap ? (
        <>
          {isMulti && <div style={{ fontSize: 11, color: '#71717a' }}>Select all that apply</div>}
          <PickSetInput pickSet={probe.pickSet} selected={selected} onChange={setSelected} />
        </>
      ) : !probe.pickSet ? (
        <TextInput value={inputValue} onChange={setInputValue} onEnter={handleSubmit} />
      ) : null}

      {/* Actions: Next + Skip section (Rule 7 — never trap) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || probe.dependencyGap}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: canSubmit && !probe.dependencyGap ? '#1e3a5f' : '#18181b',
            border: `1px solid ${canSubmit && !probe.dependencyGap ? '#3b82f6' : '#3f3f46'}`,
            color: canSubmit && !probe.dependencyGap ? '#93c5fd' : '#52525b',
            cursor: canSubmit && !probe.dependencyGap ? 'pointer' : 'not-allowed',
            transition: 'all 0.12s',
          }}
        >
          Next →
        </button>
        {probe.dependencyGap && (
          <span style={{ fontSize: 11, color: '#52525b' }}>Declare prerequisites first</span>
        )}
        <button
          type="button"
          onClick={advanceSlot}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12,
            background: 'transparent', border: 'none', color: '#52525b', cursor: 'pointer',
          }}
        >
          Skip this section →
        </button>
      </div>
    </div>
  );
}
