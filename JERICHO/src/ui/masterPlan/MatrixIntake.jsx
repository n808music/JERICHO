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
import { RoleTagGlossaryButton } from './RoleTagGlossaryPanel';

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
// One ask per line. Compound framings (Defect C) rewritten to a single concept;
// the five already-single-ask framings are left unchanged.
const SECTION_FRAMING = {
  [ENTITY_SLOT_ID]:             'The parts of your operation',
  [INITIATIVE_SLOT_ID]:         'The work streams driving this goal',
  [SYSTEM_SLOT_ID]:             'The systems involved',
  [PROJECT_SLOT_ID]:            'What specific projects or deliverable streams need to happen?',
  [ARTIFACT_SLOT_ID]:           "What you'll produce",
  [DEPENDENCY_SLOT_ID]:         'What depends on what? Map the work sequencing.',
  [CONVERGENCE_SLOT_ID]:        'Where work streams meet',
  [RESOURCE_PROFILE_SLOT_ID]:   'Who is doing the work and what resources are they working with?',
  [BINDING_CONSTRAINT_SLOT_ID]: 'What single resource or capacity is the bottleneck for the entire plan?',
  [BOOTSTRAP_SLOT_ID]:          'How does the work get started — what needs to happen first?',
};

// Relevance question before entering optional sections (Rule 5)
// Affirmative relevance gate (Rule 5): "Yes" enters the section, "Skip" bypasses
// it — branch polarity lives in the buttons, not the wording. Compound questions
// (Defect C) rewritten to a single ask while preserving that affirmative polarity.
const SCOPE_QUESTIONS = {
  [INITIATIVE_SLOT_ID]:         'Will this goal run several work streams in parallel?',
  [SYSTEM_SLOT_ID]:             'Are there software systems to set up?',
  [ARTIFACT_SLOT_ID]:           'Will this produce specific deliverables?',
  [DEPENDENCY_SLOT_ID]:         'Are there work items where one must be completed before another can start?',
  [CONVERGENCE_SLOT_ID]:        'Are there points where separate work streams merge or hand off to a shared outcome?',
  [RESOURCE_PROFILE_SLOT_ID]:   'Do you have team members with specific roles and resource allocations to map?',
  [BINDING_CONSTRAINT_SLOT_ID]: 'Is one resource the bottleneck for your timeline?',
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

// Multi-select pickSet kinds. initiativeOwnerOptions joined 2026-07-10 (an
// initiative can be owned by several entities); convergenceSourceOptions the
// same day (several parts of an operation often feed one destination).
const MULTI_SELECT_KINDS = new Set([
  'roleTagOptions',
  'initiativeOwnerOptions',
  'initiativeRoleTagOptions',
  'convergenceSourceOptions',
]);

// Dependency-respecting slot order: spine first, then sub-structures, then edges, then bootstrap last.
// 2026-07-10 (operator decision): Projects and Deliverables are asked BEFORE
// Systems, matching the canonical reference workbook tab order (ENTITIES →
// INITIATIVES → PROJECTS → DELIVERABLES → SYSTEMS). Dependency-safe: systems
// reference entities only; artifacts stay after the projects they attach to.
// The § pills keep their canonical matrix section ids (§5 Project precedes
// §4 System on screen by design).
const FULL_SLOT_ORDER = [
  ENTITY_SLOT_ID,
  INITIATIVE_SLOT_ID,
  PROJECT_SLOT_ID,
  ARTIFACT_SLOT_ID,
  SYSTEM_SLOT_ID,
  DEPENDENCY_SLOT_ID,
  CONVERGENCE_SLOT_ID,
  RESOURCE_PROFILE_SLOT_ID,
  BINDING_CONSTRAINT_SLOT_ID,
  BOOTSTRAP_SLOT_ID,
];

function makeSlotEngine(matrix, slotId, restoreState = null) {
  return createElicitationEngine({
    goalType: 'generic',
    matrixSnapshot: matrix || {},
    scope: [slotId],
    restoreState,
  });
}

// Node-declaring slots whose first field is a free-text NAME. These are
// list-capture: the operator declares several. Instead of a free-text name box
// (which stored an entire pasted list as one item — Defect E), these use a chip
// roster (names as an array by construction), then fan out one detail pass per
// name. Relational slots (dependency/convergence/resource) and the singletons
// (binding constraint, bootstrap) are NOT rostered — they pick from declared
// nodes or capture exactly one.
const NODE_ROSTER_SLOTS = new Set([
  ENTITY_SLOT_ID,
  INITIATIVE_SLOT_ID,
  SYSTEM_SLOT_ID,
  PROJECT_SLOT_ID,
  ARTIFACT_SLOT_ID,
]);

// Seed a single-slot engine with the item name already captured, so the fan-out
// drives only the remaining fields (referent-bound to that name). Reuses the
// Defect-B restore path — no freeform parsing anywhere.
function seedNodeEngine(matrix, slotId, name) {
  return createElicitationEngine({
    goalType: 'generic',
    matrixSnapshot: matrix || {},
    scope: [slotId],
    restoreState: {
      goalType: 'generic',
      slotStack: [{ slotId, captured: { name: String(name).trim() } }],
      completedSlotIds: [],
    },
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

// Cross-registry pick lists group by node type (2026-07-10): a flat wall of
// 40 chips made the operator scan every declared thing to find one. Grouping
// uses the nodeType the engine already attaches; ungrouped sets render flat.
const NODE_TYPE_GROUPS = [
  ['entity', 'Companies / entities'],
  ['initiative', 'Initiatives'],
  ['project', 'Projects'],
  ['artifact', 'Deliverables'],
  ['system', 'Systems'],
];

function PickSetInput({ pickSet, selected, onChange }) {
  const isMulti = MULTI_SELECT_KINDS.has(pickSet.kind);
  const toggle = (id) => {
    if (isMulti) {
      onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    } else {
      onChange([id]);
    }
  };
  const chip = (item) => {
    const active = selected.includes(item.id);
    return (
      <button
        key={item.id}
        type="button"
        data-testid="pickset-option"
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
  };

  const typed = pickSet.items.filter((i) => i.nodeType);
  if (typed.length > 0) {
    const groups = NODE_TYPE_GROUPS
      .map(([type, heading]) => [heading, pickSet.items.filter((i) => i.nodeType === type)])
      .filter(([, items]) => items.length > 0);
    const untyped = pickSet.items.filter((i) => !i.nodeType);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
        {groups.map(([heading, items]) => (
          <div key={heading} data-testid="pickset-group">
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#71717a', marginBottom: 6 }}>
              {heading}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{items.map(chip)}</div>
          </div>
        ))}
        {untyped.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{untyped.map(chip)}</div>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
      {pickSet.items.map(chip)}
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

// Inline "queue another item" input — used mid fan-out ("+ add another
// project") and on the compound-readback advisory ("queue as separate
// project"). Inserts the name right after the current item so it's described
// next; nothing already answered is touched.
function AddAnotherInline({ label, onAdd, ctaText }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [added, setAdded] = React.useState(null);
  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    if (onAdd(v)) {
      setAdded(v);
      setDraft('');
      setOpen(false);
    }
  };
  if (!open) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          data-testid="add-another-toggle"
          onClick={() => { setAdded(null); setOpen(true); }}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12,
            background: 'transparent', border: '1px dashed #52525b', color: '#a1a1aa', cursor: 'pointer',
          }}
        >
          {ctaText || `+ add another ${label}`}
        </button>
        {added ? (
          <span data-testid="add-another-confirmation" style={{ fontSize: 12, color: '#34d399' }}>
            "{added}" queued next — finish this one first.
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        data-testid="add-another-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        placeholder={`Name the ${label}`}
        style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 12, minWidth: 220,
          background: '#18181b', border: '1px solid #3f3f46', color: '#f4f4f5', outline: 'none',
        }}
      />
      <button
        type="button"
        data-testid="add-another-submit"
        onClick={submit}
        style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          background: '#1e3a5f', border: '1px solid #3b82f6', color: '#93c5fd', cursor: 'pointer',
        }}
      >
        Queue it
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setDraft(''); }}
        style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12, background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}
      >
        cancel
      </button>
    </span>
  );
}

// Persistent queue visibility (2026-07-10): after queueing a split/added item
// the operator had NO way to see whether it landed — the per-add confirmation
// was transient. This line always shows what's queued after the current item,
// with × to remove a not-yet-described name (e.g. an accidental duplicate).
function QueuedNextLine({ names, startIndex, onRemove }) {
  const pending = (names || []).slice(startIndex + 1);
  if (!pending.length) return null;
  return (
    <div
      data-testid="roster-queued-line"
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12, color: '#71717a' }}
    >
      <span>Up next:</span>
      {pending.map((n, i) => (
        <span
          key={`${n}-${i}`}
          data-testid="roster-queued-chip"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
            borderRadius: 999, background: '#18181b', border: '1px solid #3f3f46', color: '#a1a1aa',
          }}
        >
          {n}
          {onRemove ? (
            <button
              type="button"
              aria-label={`Remove ${n}`}
              data-testid="roster-queued-remove"
              onClick={() => onRemove(startIndex + 1 + i)}
              style={{ border: 'none', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function ReadbackScreen({
  readback, onConfirm, onReopen, onAddRosterName, rosterLabel,
  rosterNames = [], rosterIndex = 0, onRemoveRosterName,
}) {
  const queuedCount = Math.max(0, (rosterNames || []).length - rosterIndex - 1);
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
      {/* Compound-attestation advisory: both the metric and the source join
          two things with 'and' — the shape of two checks welded into one
          record. Advisory only; the operator's judgment is authoritative. */}
      {readback.compoundSuspected && (
        <div
          data-testid="readback-compound-advisory"
          style={{
            fontSize: 13, color: '#fcd34d', background: '#1c1407',
            border: '1px solid #d97706', borderRadius: 6, padding: '10px 14px', lineHeight: 1.6,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          {queuedCount > 0 ? (
            <span data-testid="compound-advisory-queued">
              <span style={{ fontWeight: 700 }}>
                {queuedCount} {rosterLabel || 'item'}{queuedCount > 1 ? 's' : ''} queued below.
              </span>{' '}
              Now trim THIS record to its first deliverable: tap the description and
              verificationSource chips underneath to re-enter each one, then confirm.
              Confirm is never blocked — it declares this record exactly as read back.
            </span>
          ) : (
            <span>
              <span style={{ fontWeight: 700 }}>This reads like two checks in one.</span>{' '}
              If these are two deliverables — each with its own place you'd verify it — split them:
              name the second one below (it's asked right after this one), then use the field chips
              to trim this record down to the first. Confirm only if it's truly a single check.
            </span>
          )}
          {onAddRosterName ? (
            <AddAnotherInline
              label={rosterLabel || 'item'}
              onAdd={onAddRosterName}
              ctaText={`Split — queue a separate ${rosterLabel || 'item'}`}
            />
          ) : null}
        </div>
      )}
      {/* Always-visible queue of items waiting after this one (removable). */}
      <QueuedNextLine names={rosterNames} startIndex={rosterIndex} onRemove={onRemoveRosterName} />
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
      <p style={{ fontSize: 18, fontWeight: 700, color: '#18181b', lineHeight: 1.5, margin: 0 }}>
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
      <p style={{ fontSize: 18, fontWeight: 700, color: '#18181b', lineHeight: 1.5, margin: 0 }}>
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

// Roster chip entry for list-capture node slots (Defect E). Names are added one
// at a time as removable chips → an array by construction. No freeform prose
// parsing; the fan-out then describes each named item in turn.
function RosterScreen({ slotId, onSubmit, onSkip, initialNames = [] }) {
  const meta = SLOT_META[slotId] || { label: slotId, plural: 'items', color: '#71717a' };
  const framingText = SECTION_FRAMING[slotId];
  // initialNames repopulates the chips when the user navigates Back to this
  // screen — their typed roster is never lost to a remount.
  const [chips, setChips] = React.useState(() =>
    (Array.isArray(initialNames) ? initialNames : []).map((n) => String(n).trim()).filter(Boolean)
  );
  const [draft, setDraft] = React.useState('');

  const finalNames = () => {
    const v = draft.trim();
    if (v && !chips.some((c) => c.toLowerCase() === v.toLowerCase())) return [...chips, v];
    return chips;
  };
  const addChip = () => {
    const v = draft.trim();
    if (!v) return;
    if (!chips.some((c) => c.toLowerCase() === v.toLowerCase())) setChips([...chips, v]);
    setDraft('');
  };
  const removeChip = (i) => setChips(chips.filter((_, idx) => idx !== i));
  const canContinue = finalNames().length > 0;

  return (
    <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionPill slotId={slotId} />
      {framingText && (
        <div data-testid="intake-framing" style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.4 }}>
          {framingText}
        </div>
      )}
      <div data-testid="roster-question" style={{ fontSize: 18, fontWeight: 700, color: '#18181b', lineHeight: 1.45 }}>
        Add each {meta.label.toLowerCase()} by name.
      </div>
      <div data-testid="roster-subtext" style={{ fontSize: 13, color: '#3f3f46', lineHeight: 1.6 }}>
        Type a name and press Enter to add it. You'll describe each one next.
      </div>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {chips.map((c, i) => (
            <span key={`${c}-${i}`} data-testid="roster-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: '#eef2ff', border: '1px solid #c7d2fe', color: '#3730a3', fontSize: 13 }}>
              {c}
              <button type="button" aria-label={`Remove ${c}`} onClick={() => removeChip(i)} style={{ border: 'none', background: 'transparent', color: '#6366f1', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        data-testid="roster-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip(); } }}
        placeholder={`Name a ${meta.label.toLowerCase()}, then press Enter`}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: '#ffffff', border: '1px solid #d4d4d8', borderRadius: 8, color: '#18181b', fontSize: 14, outline: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onSubmit(finalNames())}
          disabled={!canContinue}
          style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: canContinue ? '#1e3a5f' : '#e4e4e7',
            border: `1px solid ${canContinue ? '#3b82f6' : '#d4d4d8'}`,
            color: canContinue ? '#93c5fd' : '#a1a1aa',
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          Continue — describe each →
        </button>
        <button type="button" onClick={onSkip} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
          Skip this section →
        </button>
      </div>
    </div>
  );
}

function DoneScreen({ onAddMore }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#18181b', marginBottom: 4 }}>
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
          { label: '+ System',     slotId: SYSTEM_SLOT_ID },
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
  const activeCycleId = store.activeCycleId;
  const activeCycle = activeCycleId ? store.cyclesById?.[activeCycleId] : null;
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

  // Resume (Defect B): true when this mount rehydrated a persisted in-flight
  // session rather than starting fresh — drives the "Resume intake" affordance.
  const [resumedFromSession, setResumedFromSession] = useState(false);

  // Roster fan-out (Defect E): while a node slot is being detailed, rosterNames
  // is the array of chip names, rosterIndex is the one currently being described,
  // and rosterSlotId marks that we're mid fan-out (vs the singular/loop flow).
  const [rosterNames, setRosterNames] = useState([]);
  const [rosterIndex, setRosterIndex] = useState(0);
  const [rosterSlotId, setRosterSlotId] = useState(null);

  // Back navigation: a stack of full pre-transition snapshots (UI state +
  // engine reference + the store matrix reference from before the transition).
  // Engines are immutable (each consumeAnswer returns a new instance) and
  // computeDerivedState structuredClones state, so retained references are
  // safe to restore verbatim. historyDepth mirrors the stack length in React
  // state so the Back button's visibility re-renders.
  const historyRef = useRef([]);
  const [historyDepth, setHistoryDepth] = useState(0);

  // Latest inputValue held in a ref so we can persist the in-flight text on
  // unmount (back-gesture) WITHOUT persisting on every keystroke.
  const inputValueRef = useRef('');
  inputValueRef.current = inputValue;

  // Live snapshot writer, reassigned each render over current state. Called on
  // step transitions and on unmount — never per keystroke — so captured answers
  // are never lost while in-flight typed text is best-effort.
  const persistSessionRef = useRef(() => {});
  persistSessionRef.current = () => {
    if (!hasAdmittedGoal || !activeCycleId) return;
    if (phase !== 'engine' || !engine) return;
    store.setIntakeSession?.(activeCycleId, {
      phase,
      slotQueue,
      currentSlotId: slotQueue[0] || null,
      engineSnapshot: engine.snapshotState(),
      inputValue: inputValueRef.current,
      rosterNames,
      rosterIndex,
      rosterSlotId,
    });
  };

  // Back-history writer, reassigned each render over current state (same
  // pattern as persistSessionRef) so handlers with narrower useCallback deps
  // always push the CURRENT state, never a stale closure. `overrides` lets a
  // caller amend fields the transition is about to consume (e.g. beginFanOut
  // records the roster names so Back restores the chips).
  const pushHistoryRef = useRef(() => {});
  pushHistoryRef.current = (overrides = {}) => {
    historyRef.current.push({
      phase,
      slotQueue,
      engine,
      step,
      inputValue,
      selected,
      isReprobe,
      rosterNames,
      rosterIndex,
      rosterSlotId,
      matrix: store.matrix,
      ...overrides,
    });
    setHistoryDepth(historyRef.current.length);
  };

  // Pop one snapshot and restore it wholesale: UI state, engine, and the store
  // matrix (RESTORE_MATRIX_SNAPSHOT undoes any DECLARE_* that fired since the
  // snapshot — this is what lets Back cross an already-declared entity).
  const goBack = () => {
    const entry = historyRef.current.pop();
    if (!entry) { return; }
    setHistoryDepth(historyRef.current.length);
    store.matrixDispatch({ type: 'RESTORE_MATRIX_SNAPSHOT', payload: { matrix: entry.matrix } });
    setPendingRefresh(false);
    setResumedFromSession(false);
    setSlotQueue(entry.slotQueue);
    setRosterNames(entry.rosterNames);
    setRosterIndex(entry.rosterIndex);
    setRosterSlotId(entry.rosterSlotId);
    setEngine(entry.engine);
    setStep(entry.step);
    setInputValue(entry.inputValue);
    setSelected(entry.selected);
    setIsReprobe(entry.isReprobe);
    prevFieldRef.current = null;
    setPhase(entry.phase);
    // The persisted resume session only models the engine phase; if Back lands
    // on a non-engine screen, drop the now-stale session so resume can't jump
    // forward past where the user deliberately went back to.
    if (entry.phase !== 'engine' && activeCycleId) {
      store.clearIntakeSession?.(activeCycleId);
    }
  };

  // Insert a new roster name right after the item currently being described —
  // the "split"/"add another" affordance. Uses the existing fan-out machinery:
  // nothing already answered is touched; the new item is asked next.
  const addRosterName = (name) => {
    const clean = String(name || '').trim();
    if (!clean || !rosterSlotId) return false;
    if (rosterNames.some((n) => n.toLowerCase() === clean.toLowerCase())) return false;
    const next = [...rosterNames];
    next.splice(rosterIndex + 1, 0, clean);
    setRosterNames(next);
    return true;
  };

  // Remove a queued (not-yet-described) roster name — e.g. an accidental
  // duplicate added while splitting. Only names AFTER the current index are
  // removable; described items are already declared records.
  const removeRosterName = (index) => {
    if (!rosterSlotId) return;
    if (index <= rosterIndex || index >= rosterNames.length) return;
    setRosterNames(rosterNames.filter((_, i) => i !== index));
  };

  // Discard the item CURRENTLY being described and move to the next roster
  // name (2026-07-10: a duplicate that had already become current could only
  // be escaped by skipping the WHOLE section — losing every queued item
  // behind it). Nothing is declared for the skipped item; Back undoes it.
  const skipCurrentRosterItem = () => {
    if (!rosterSlotId) return;
    pushHistoryRef.current();
    const nextIndex = rosterIndex + 1;
    if (nextIndex < rosterNames.length) {
      const eng = seedNodeEngine(store.matrix, rosterSlotId, rosterNames[nextIndex]);
      setRosterIndex(nextIndex);
      setEngine(eng);
      setStep(eng.nextStep());
      setInputValue('');
      setSelected([]);
      setIsReprobe(false);
      prevFieldRef.current = null;
      setPendingRefresh(false);
      setPhase('engine');
    } else {
      setRosterSlotId(null);
      setRosterNames([]);
      setRosterIndex(0);
      setEngine(null);
      setStep(null);
      enterQueue(slotQueue.slice(1), store.matrix);
    }
  };

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
      if (NODE_ROSTER_SLOTS.has(slotId)) {
        // List-capture node slot → collect names as chips first (Defect E).
        setSlotQueue(remaining);
        setRosterSlotId(slotId);
        setRosterNames([]);
        setRosterIndex(0);
        setEngine(null);
        setStep(null);
        setInputValue('');
        setSelected([]);
        setIsReprobe(false);
        prevFieldRef.current = null;
        setPendingRefresh(false);
        setPhase('roster');
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
    if (NODE_ROSTER_SLOTS.has(slotId)) {
      setRosterSlotId(slotId);
      setRosterNames([]);
      setRosterIndex(0);
      setEngine(null);
      setStep(null);
      setInputValue('');
      setSelected([]);
      setIsReprobe(false);
      prevFieldRef.current = null;
      setPendingRefresh(false);
      setPhase('roster');
      return;
    }
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

  // Roster → fan-out: begin describing the first named item. Each name is seeded
  // into a single-slot engine; on completion the pendingRefresh effect advances
  // to the next name (Defect E). Empty roster → skip the section.
  const beginFanOut = useCallback((names) => {
    const clean = (Array.isArray(names) ? names : []).map((n) => String(n).trim()).filter(Boolean);
    const slotId = rosterSlotId || slotQueue[0];
    if (clean.length === 0 || !slotId) { advanceSlot(); return; }
    // Record the roster screen WITH its typed names so Back restores the chips.
    pushHistoryRef.current({ phase: 'roster', rosterNames: clean, rosterSlotId: slotId });
    onSurveyStarted?.();
    const eng = seedNodeEngine(store.matrix, slotId, clean[0]);
    const s = eng.nextStep();
    setRosterSlotId(slotId);
    setRosterNames(clean);
    setRosterIndex(0);
    setEngine(eng);
    setStep(s);
    setInputValue('');
    setSelected([]);
    setIsReprobe(false);
    prevFieldRef.current = null;
    setPendingRefresh(false);
    setResumedFromSession(false);
    setPhase('engine');
  }, [rosterSlotId, slotQueue, store.matrix, advanceSlot, onSurveyStarted]);

  // On mount with admitted goal (remount after Phase 0 completes and store
  // updates) — OR resume a persisted in-flight session after a back-gesture /
  // refresh / route change (Defect B). A saved session wins over a fresh start.
  useEffect(() => {
    const saved =
      hasAdmittedGoal && activeCycleId ? store.intakeSessionByCycleId?.[activeCycleId] : null;
    if (saved?.engineSnapshot && saved?.currentSlotId) {
      const eng = makeSlotEngine(store.matrix, saved.currentSlotId, saved.engineSnapshot);
      const s = eng.nextStep();
      const savedQueue =
        Array.isArray(saved.slotQueue) && saved.slotQueue.length
          ? saved.slotQueue
          : [saved.currentSlotId];
      const restoreRoster = () => {
        if (saved.rosterSlotId && Array.isArray(saved.rosterNames) && saved.rosterNames.length) {
          setRosterSlotId(saved.rosterSlotId);
          setRosterNames(saved.rosterNames);
          setRosterIndex(saved.rosterIndex || 0);
        }
      };

      // Rebuild Back history from the fields already answered on the current
      // slot (2026-07-10 defect: history was in-memory only, so after a reload
      // the operator had "only Next" and no way to double-check answers).
      // Each entry re-opens one answered field with its value prefilled —
      // Back now steps question-by-question through the current item.
      const answered = (typeof eng.answeredGateFields === 'function' ? eng.answeredGateFields() : [])
        // The name of a rostered item is seeded, not asked — skip it.
        .filter((f) => !(saved.rosterSlotId && f.fieldName === 'name'));
      const entries = [];
      for (const { fieldName, value } of answered) {
        const reopened = eng.reopenFieldAndLater(fieldName);
        const st = reopened.engine.nextStep();
        if (st.done || !st.probe) continue;
        entries.push({
          phase: 'engine',
          slotQueue: savedQueue,
          engine: reopened.engine,
          step: st,
          inputValue: typeof value === 'string' ? value : '',
          selected: Array.isArray(value) ? value : (st.probe.pickSet && value ? [value] : []),
          isReprobe: false,
          rosterNames: Array.isArray(saved.rosterNames) ? saved.rosterNames : [],
          rosterIndex: saved.rosterIndex || 0,
          rosterSlotId: saved.rosterSlotId || null,
          matrix: store.matrix,
        });
      }

      if (!s.done) {
        onSurveyStarted?.(); // keep the intake mounted through resume
        // Resuming INTO a readback: nextStep() computes the readback
        // transiently, but the restored engine's internal state doesn't carry
        // it — confirm/reopen would throw 'no readback pending' and every
        // button on the readback dies silently (2026-07-10: unresponsive
        // description chips after reload). finalizePending() returns the
        // engine WITH the readback registered; no dispatches fire because the
        // readback is precisely what gates them.
        let resumedEngine = eng;
        if (s.readback && typeof eng.finalizePending === 'function') {
          const fin = eng.finalizePending();
          if (fin.dispatches.length === 0) resumedEngine = fin.engine;
        }
        historyRef.current = entries;
        setHistoryDepth(entries.length);
        setSlotQueue(savedQueue);
        setEngine(resumedEngine);
        setStep(s);
        setInputValue(saved.inputValue || '');
        restoreRoster();
        setResumedFromSession(true);
        setPhase('engine');
        return;
      }
      // s.done on a restored snapshot: the slot ALREADY passes every gate
      // under CURRENT rules — e.g. a validator was loosened between save and
      // resume, so an answer that was mid-reprobe now clears. NEVER auto-
      // submit it (the operator never confirmed that answer): land them ON
      // the last question they were answering, answer prefilled, with Back
      // history for the earlier fields. Pressing Next re-submits it through
      // the normal flow.
      if (entries.length > 0) {
        const current = entries.pop();
        onSurveyStarted?.();
        historyRef.current = entries;
        setHistoryDepth(entries.length);
        setSlotQueue(savedQueue);
        setEngine(current.engine);
        setStep(current.step);
        setInputValue(current.inputValue);
        setSelected(current.selected);
        restoreRoster();
        setResumedFromSession(true);
        setPhase('engine');
        return;
      }
      // Boundary snapshot with nothing re-openable (no answered fields):
      // finalize so the record isn't lost, then advance via pendingRefresh.
      onSurveyStarted?.();
      const fin = eng.finalizePending
        ? eng.finalizePending()
        : { engine: eng, dispatches: [] };
      setSlotQueue(savedQueue);
      restoreRoster();
      fin.dispatches.forEach((action) => store.matrixDispatch(action));
      setEngine(fin.engine);
      setResumedFromSession(true);
      setPhase('engine');
      setPendingRefresh(true);
      return;
    }
    if (phase === 'entering') {
      enterQueue([...FULL_SLOT_ORDER], store.matrix);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the in-flight session on every step transition (engine/queue/phase
  // change) and on unmount — captured answers are never lost. inputValue is
  // read from a ref, so this does NOT fire per keystroke.
  useEffect(() => {
    persistSessionRef.current();
    // rosterNames/rosterIndex included (2026-07-10): queueing or removing an
    // item mid fan-out must survive a reload — previously only question
    // transitions persisted, so a split queued at the readback was lost.
  }, [engine, phase, slotQueue, rosterNames, rosterIndex]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => persistSessionRef.current(), []); // persist on unmount

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
      if (rosterSlotId) {
        // Fan-out (Defect E): move to the next named item, or finish the section.
        const nextIndex = rosterIndex + 1;
        if (nextIndex < rosterNames.length) {
          const eng = seedNodeEngine(store.matrix, rosterSlotId, rosterNames[nextIndex]);
          setRosterIndex(nextIndex);
          setEngine(eng);
          setStep(eng.nextStep());
          setPhase('engine');
        } else {
          setRosterSlotId(null);
          setRosterNames([]);
          setRosterIndex(0);
          setEngine(null);
          setStep(null);
          enterQueue(slotQueue.slice(1), store.matrix);
        }
      } else {
        setEngine(null);
        setStep(null);
        setPhase('loop');
      }
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
    setResumedFromSession(false); // first interaction retires the resume banner
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
    pushHistoryRef.current();

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
    pushHistoryRef.current();
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

  // "← Back" — pops one snapshot: returns to the previous question, restores
  // the typed answer, and rolls back any entity/node declared in between.
  const backButton = historyDepth > 0 ? (
    <button
      type="button"
      data-testid="intake-back"
      onClick={goBack}
      style={{
        alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8, fontSize: 12,
        background: '#18181b', border: '1px solid #3f3f46', color: '#a1a1aa', cursor: 'pointer',
      }}
    >
      ← Back
    </button>
  ) : null;

  if (phase === 'scope' && currentSlotId && OPTIONAL_SECTIONS.has(currentSlotId)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backButton}
        <ScopeScreen
          slotId={currentSlotId}
          onYes={() => { pushHistoryRef.current(); enterCurrentSlot(store.matrix); }}
          onSkip={() => { pushHistoryRef.current(); advanceSlot(); }}
        />
      </div>
    );
  }

  if (phase === 'roster' && rosterSlotId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backButton}
        <RosterScreen
          slotId={rosterSlotId}
          initialNames={rosterNames}
          onSubmit={beginFanOut}
          onSkip={() => { pushHistoryRef.current(); advanceSlot(); }}
        />
      </div>
    );
  }

  if (phase === 'loop' && currentSlotId) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backButton}
        <LoopCheckScreen
          slotId={currentSlotId}
          onAddMore={() => { pushHistoryRef.current(); handleLoopAddMore(); }}
          onContinue={() => { pushHistoryRef.current(); advanceSlot(); }}
        />
      </div>
    );
  }

  if (!engine || !step) {
    return <div style={{ padding: 24, color: '#71717a', fontSize: 13 }}>Loading…</div>;
  }

  if (step.readback) {
    const rosterMeta = rosterSlotId ? SLOT_META[rosterSlotId] : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {backButton}
        <ReadbackScreen
          readback={step.readback}
          onConfirm={() => handleReadbackConfirm(true, null)}
          onReopen={(field) => handleReadbackConfirm(false, field)}
          onAddRosterName={rosterSlotId ? addRosterName : null}
          rosterLabel={rosterMeta ? rosterMeta.label.toLowerCase() : 'item'}
          rosterNames={rosterNames}
          rosterIndex={rosterIndex}
          onRemoveRosterName={rosterSlotId ? removeRosterName : null}
        />
      </div>
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
          {backButton}
          <button
            type="button"
            onClick={() => { pushHistoryRef.current(); handleBlockerAddResource(); }}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: '#052e16', border: '1px solid #047857', color: '#6ee7b7', cursor: 'pointer',
            }}
          >
            Add resource profile →
          </button>
          <button
            type="button"
            onClick={() => { pushHistoryRef.current(); advanceSlot(); }}
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

      {/* Items queued after the one being described — always visible so a
          split/add is never a leap of faith (2026-07-10). Removable via ×. */}
      {rosterSlotId ? (
        <QueuedNextLine names={rosterNames} startIndex={rosterIndex} onRemove={removeRosterName} />
      ) : null}

      {/* Resume affordance (Defect B): shown when this session was rehydrated
          after a route change / back-gesture, so the user knows their place and
          answers were kept. */}
      {resumedFromSession && (
        <div
          data-testid="intake-resume-banner"
          style={{
            fontSize: 12, color: '#3f3f46', background: '#eef2ff',
            border: '1px solid #c7d2fe', borderRadius: 6, padding: '8px 12px',
            display: 'flex', gap: 8, alignItems: 'center',
          }}
        >
          <span style={{ fontWeight: 700, color: '#4f46e5' }}>↩ Resumed intake</span>
          <span>— picked up right where you left off; your answers were kept.</span>
        </div>
      )}

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
          {probe.pickSet.kind === 'roleTagOptions' && <RoleTagGlossaryButton />}
        </>
      ) : !probe.pickSet ? (
        <TextInput value={inputValue} onChange={setInputValue} onEnter={handleSubmit} />
      ) : null}

      {/* Actions: Back + Next + Skip section (Rule 7 — never trap) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {backButton}
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
          onClick={() => { pushHistoryRef.current(); advanceSlot(); }}
          style={{
            padding: '8px 14px', borderRadius: 8, fontSize: 12,
            background: 'transparent', border: 'none', color: '#52525b', cursor: 'pointer',
          }}
        >
          Skip this section →
        </button>
        {/* Mid fan-out escape hatches: discard just the CURRENT item (e.g. a
            duplicate) without losing the queue, or queue another item —
            asked right after the current one. */}
        {rosterSlotId ? (
          <>
            <button
              type="button"
              data-testid="skip-current-item"
              onClick={skipCurrentRosterItem}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12,
                background: 'transparent', border: 'none', color: '#52525b', cursor: 'pointer',
              }}
            >
              skip this {(SLOT_META[rosterSlotId]?.label || 'item').toLowerCase()} →
            </button>
            <AddAnotherInline
              label={(SLOT_META[rosterSlotId]?.label || 'item').toLowerCase()}
              onAdd={addRosterName}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
