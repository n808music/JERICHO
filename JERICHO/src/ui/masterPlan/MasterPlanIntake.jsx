import React, { useState, useCallback } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import {
  getIntakePrompt,
  parseAnchorFromInput,
  suggestPlanHorizon,
  evaluateStructureCritic,
} from '../../domain/masterPlan/masterPlanIntakeEngine.js';
import { LANE_ACTIVATION_STATE } from '../../domain/masterPlan/masterPlanSchema.js';

const MASTER_PLAN_TEXTAREA_MAX_CHARS = 1000;

// ─── Top-level component ──────────────────────────────────────────────────────

export default function MasterPlanIntake({ profileId }) {
  const store = useIdentityStore();
  const intake = store.masterPlanIntake;

  if (!intake || intake.status === 'idle') {
    return (
      <IntakeStartScreen
        onStart={() =>
          store.masterPlanIntakeStart(profileId || store.activeProfileId)
        }
      />
    );
  }

  if (intake.status === 'complete') {
    return <IntakeCompleteScreen masterPlanId={intake.draft?.masterPlanId} />;
  }

  if (intake.status === 'error') {
    return (
      <IntakeErrorScreen
        message={intake.errorMessage}
        onRetry={() =>
          store.masterPlanIntakeStart(profileId || store.activeProfileId)
        }
      />
    );
  }

  return <IntakeActiveScreen intake={intake} store={store} />;
}

// ─── Start screen ─────────────────────────────────────────────────────────────

function IntakeStartScreen({ onStart }) {
  return (
    <div className="master-plan-intake">
      <div className="intake-start">
        <h2>Build your master plan</h2>
        <p>
          A compressed structure intake. Jericho infers the lane map first, asks only the highest-leverage execution
          questions, and carries lower-confidence detail as assumption debt instead of blocking admission.
        </p>
        <button className="intake-cta" onClick={onStart}>
          Start
        </button>
      </div>
    </div>
  );
}

// ─── Complete screen ──────────────────────────────────────────────────────────

function IntakeCompleteScreen({ masterPlanId }) {
  return (
    <div className="master-plan-intake">
      <div className="intake-complete">
        <h2>Master plan created</h2>
        <p>Your lanes, anchors, and milestones are ready.</p>
        {masterPlanId && (
          <p className="intake-plan-id">Plan ID: {masterPlanId}</p>
        )}
      </div>
    </div>
  );
}

// ─── Error screen ─────────────────────────────────────────────────────────────

function IntakeErrorScreen({ message, onRetry }) {
  return (
    <div className="master-plan-intake">
      <div className="intake-error">
        <h2>Something went wrong</h2>
        <p>{message || 'An unknown error occurred during intake.'}</p>
        <button onClick={onRetry}>Start over</button>
      </div>
    </div>
  );
}

// ─── Active intake screen ─────────────────────────────────────────────────────

function IntakeActiveScreen({ intake, store }) {
  const { phase, step, extractedLanes, anchors, currentLaneIdx, clarifyingQuestionIdx } = intake;
  const nowISO = store.appTime?.nowISO || new Date().toISOString();

  // Use goal text (step_1 or step_2) to detect multi-year plans; anchor date is a launch milestone, not the horizon.
  const goalText = intake.answers?.step_1 || intake.answers?.step_2 || '';
  const suggestedHorizon = suggestPlanHorizon(goalText, anchors, nowISO);
  const currentLane = extractedLanes?.[currentLaneIdx] || null;
  const currentLaneAssessment = intake.answers?.[`lane_${currentLaneIdx}_system_assessment`] || null;

  const context = {
    anchors,
    extractedLanes,
    currentLaneIdx,
    clarifyingQuestionIdx,
    suggestedHorizon,
    currentLane,
    currentLaneAssessment,
    questionPlan: intake.questionPlan || null,
  };

  const question = getIntakePrompt(phase, step, context);

  function submitAnswer(value) {
    store.masterPlanIntakeAnswer(value);
  }

  function completeIntake() {
    store.masterPlanIntakeComplete();
  }

  return (
    <div className="master-plan-intake">
      <div className="intake-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <IntakeProgressBar phase={phase} step={step} />
        <button
          className="intake-cancel"
          onClick={() => store.masterPlanIntakeReset()}
          style={{ fontSize: '11px', color: 'var(--color-muted, #888)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginTop: '4px' }}
        >
          Cancel
        </button>
      </div>
      <IntakeQuestion
        question={question}
        phase={phase}
        step={step}
        intake={intake}
        nowISO={nowISO}
        onSubmit={submitAnswer}
        onComplete={completeIntake}
      />
      {extractedLanes.length > 0 && phase >= 2 && (
        <ExtractedLanesSidebar lanes={extractedLanes} currentLaneIdx={phase === 3 ? currentLaneIdx : null} />
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const PHASE_LABELS = ['Orient', 'Constrain', 'Calibrate', 'Generate'];

function IntakeProgressBar({ phase, step }) {
  return (
    <div className="intake-progress">
      {PHASE_LABELS.map((label, i) => (
        <div
          key={label}
          className={`intake-phase ${i + 1 === phase ? 'active' : i + 1 < phase ? 'done' : ''}`}
        >
          {label}
        </div>
      ))}
      <span className="intake-step-label">Step {step} of 13</span>
    </div>
  );
}

// ─── Question renderer ────────────────────────────────────────────────────────

function IntakeQuestion({ question, phase, step, intake, nowISO, onSubmit, onComplete }) {
  if (!question.prompt) return null;

  return (
    <div className="intake-question">
      <p className="intake-prompt">{question.prompt}</p>
      {question.subtext && <p className="intake-subtext">{question.subtext}</p>}
      {question.reason && question.reason !== question.subtext ? (
        <div className="space-y-2">
          <p className="intake-subtext">
            {question.diagnosticMode ? 'Diagnostic · ' : ''}
            Reason: {question.reason}
            {question.whyNeeded ? ` · Needed because ${question.whyNeeded}` : ''}
          </p>
          <p className="intake-subtext">
            {question.resolvesField ? `Resolves ${question.resolvesField}` : 'Execution substrate question'}
            {Array.isArray(question.affects) && question.affects.length > 0 ? ` · Affects ${question.affects.join(', ')}` : ''}
            {question.criticality ? ` · ${question.criticality}` : ''}
            {typeof question.canDefer === 'boolean' ? ` · ${question.canDefer ? 'can defer later' : 'needed before admission'}` : ''}
          </p>
          {Array.isArray(question.examples) && question.examples.length > 0 ? (
            <div className="rounded-md border border-line/50 bg-jericho-bg px-3 py-2 text-xs text-muted">
              <p className="mb-1 font-medium text-jericho-text">Answer examples</p>
              <ul className="list-disc space-y-1 pl-4">
                {question.examples.slice(0, 2).map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {question.fallbackBehavior ? (
            <div className="rounded-md border border-line/40 bg-jericho-surface/70 px-3 py-2 text-xs text-muted">
              <span className="font-medium text-jericho-text">If you are unsure:</span> {question.fallbackBehavior}
            </div>
          ) : null}
        </div>
      ) : null}
      <IntakeInput
        inputType={question.inputType}
        question={question}
        phase={phase}
        step={step}
        intake={intake}
        nowISO={nowISO}
        onSubmit={onSubmit}
        onComplete={onComplete}
      />
    </div>
  );
}

// ─── Input selector ───────────────────────────────────────────────────────────

function IntakeInput({ inputType, question, phase, step, intake, nowISO, onSubmit, onComplete }) {
  switch (inputType) {
    case 'textarea':
      return <TextareaInput question={question} onSubmit={onSubmit} />;

    case 'text':
      return <TextInput question={question} onSubmit={onSubmit} />;

    case 'anchor_input':
      return <AnchorInput nowISO={nowISO} onSubmit={onSubmit} />;

    case 'horizon_confirm':
      return (
        <HorizonConfirmInput suggested={question.suggested} nowISO={nowISO} onSubmit={onSubmit} />
      );

    case 'confirm_or_correct':
      return <ConfirmOrCorrectInput onSubmit={onSubmit} />;

    case 'activation_select':
      return <ActivationSelectInput options={question.options} onSubmit={onSubmit} />;

    case 'loading':
      return <LoadingStep onSubmit={onSubmit} />;

    case 'timeline_review':
      return <TimelineReviewInput intake={intake} onSubmit={onSubmit} />;

    case 'schedule_confirm':
      return (
        <ScheduleConfirmInput
          intake={intake}
          onSubmit={() => onComplete()}
        />
      );

    default:
      return <TextInput question={question} onSubmit={onSubmit} />;
  }
}

// ─── Input components ─────────────────────────────────────────────────────────

function AssumptionButton({ question, onSubmit }) {
  if (!question?.fallbackBehavior) {
    return null;
  }
  return (
    <button
      type="button"
      className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
      onClick={() => onSubmit('Not sure — use system assumption')}
    >
      Use system assumption
    </button>
  );
}

function TextareaInput({ question, onSubmit }) {
  const [value, setValue] = useState('');
  const charCount = value.length;
  const isTooLong = charCount > MASTER_PLAN_TEXTAREA_MAX_CHARS;
  const submit = useCallback(() => {
    if (!value.trim() || isTooLong) return;
    onSubmit(value.trim());
    setValue('');
  }, [value, isTooLong, onSubmit]);

  return (
    <div className="intake-input-row">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Type your answer…"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
        }}
      />
      <div className="intake-character-meta" aria-live="polite">
        <p className={`text-xs ${isTooLong ? 'text-red-500' : 'text-muted'}`}>
          {charCount}/{MASTER_PLAN_TEXTAREA_MAX_CHARS} characters
        </p>
        {isTooLong && (
          <p className="text-xs text-red-500">
            Keep this answer under {MASTER_PLAN_TEXTAREA_MAX_CHARS} characters to continue.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={submit} disabled={!value.trim() || isTooLong}>
          Continue
        </button>
        <AssumptionButton question={question} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function TextInput({ question, onSubmit }) {
  const [value, setValue] = useState('');
  const submit = useCallback(() => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  }, [value, onSubmit]);

  return (
    <div className="intake-input-row">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer…"
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="flex flex-wrap gap-2">
        <button onClick={submit} disabled={!value.trim()}>
          Continue
        </button>
        <AssumptionButton question={question} onSubmit={onSubmit} />
      </div>
    </div>
  );
}

function AnchorInput({ nowISO, onSubmit }) {
  const [text, setText] = useState('');
  const [parsedAnchor, setParsedAnchor] = useState(null);

  function handleTextChange(e) {
    const val = e.target.value;
    setText(val);
    const anchor = parseAnchorFromInput(val, nowISO);
    setParsedAnchor(anchor);
  }

  function addAnchor(hasMore) {
    if (!parsedAnchor) return;
    onSubmit({ anchor: parsedAnchor, hasMore });
    setText('');
    setParsedAnchor(null);
  }

  return (
    <div className="intake-anchor-input">
      <input
        type="text"
        value={text}
        onChange={handleTextChange}
        placeholder="October 17 · album drop · Q4 launch…"
      />
      {parsedAnchor && (
        <div className="anchor-preview">
          <span className="anchor-date">{parsedAnchor.date}</span>
          <span className="anchor-fixed">{parsedAnchor.isFixed ? 'Fixed' : 'Internal target'}</span>
        </div>
      )}
      <div className="anchor-buttons">
        <button onClick={() => addAnchor(true)} disabled={!parsedAnchor}>
          Add and continue
        </button>
        <button onClick={() => addAnchor(false)} disabled={!parsedAnchor}>
          Add — no more dates
        </button>
        <button
          className="anchor-skip"
          onClick={() => onSubmit({ anchor: null, hasMore: false })}
        >
          No fixed dates
        </button>
      </div>
    </div>
  );
}

function HorizonConfirmInput({ suggested, nowISO, onSubmit }) {
  const [months, setMonths] = useState(suggested?.months || 12);

  function confirm() {
    const end = new Date(nowISO || new Date());
    end.setMonth(end.getMonth() + months);
    onSubmit({ horizonEnd: end.toISOString().slice(0, 10), horizonMonths: months });
  }

  return (
    <div className="intake-horizon-input">
      <div className="horizon-months">
        <label>Months out:</label>
        <input
          type="number"
          min={1}
          max={120}
          value={months}
          onChange={(e) => setMonths(parseInt(e.target.value, 10) || 12)}
        />
      </div>
      <button onClick={confirm}>Confirm horizon</button>
    </div>
  );
}

function ConfirmOrCorrectInput({ onSubmit }) {
  const [correcting, setCorrecting] = useState(false);
  const [correctedStage, setCorrectedStage] = useState('');

  if (!correcting) {
    return (
      <div className="intake-confirm-row">
        <button onClick={() => onSubmit({ confirmed: true })}>That is correct</button>
        <button onClick={() => setCorrecting(true)}>Correct it</button>
      </div>
    );
  }

  return (
    <div className="intake-correct-row">
      <input
        type="text"
        value={correctedStage}
        onChange={(e) => setCorrectedStage(e.target.value)}
        placeholder="Describe the actual stage…"
      />
      <button
        onClick={() => onSubmit({ confirmed: false, correctedStage })}
        disabled={!correctedStage.trim()}
      >
        Submit correction
      </button>
    </div>
  );
}

function ActivationSelectInput({ options, onSubmit }) {
  const labels = {
    [LANE_ACTIVATION_STATE.ACTIVE]: 'Active — schedule daily actions',
    [LANE_ACTIVATION_STATE.INCUBATING]: 'Incubating — plan but do not schedule yet',
    [LANE_ACTIVATION_STATE.PARKED]: 'Parked — watch only',
  };

  return (
    <div className="intake-activation-select">
      {(options || Object.values(LANE_ACTIVATION_STATE)).map((opt) => (
        <button key={opt} className="activation-option" onClick={() => onSubmit(opt)}>
          {labels[opt] || opt}
        </button>
      ))}
    </div>
  );
}

function LoadingStep({ onSubmit }) {
  React.useEffect(() => {
    // Auto-advance once the system would have generated milestones.
    // In production this fires after the LLM or deterministic generator resolves.
    const timer = setTimeout(() => onSubmit({ generated: true }), 800);
    return () => clearTimeout(timer);
  }, [onSubmit]);

  return <div className="intake-loading">Generating…</div>;
}

function TimelineReviewInput({ intake, onSubmit }) {
  const critic = evaluateStructureCritic(
    intake.questionPlan,
    intake.answers || {},
    intake.extractedLanes || []
  );
  const userConfirmedCount = Object.entries(intake.answers || {}).filter(([key, value]) => {
    if (key.includes('system_assessment')) {
      return false;
    }
    if (value == null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return true;
  }).length;
  const systemInferred = [
    intake.extractedLanes?.length ? `${intake.extractedLanes.length} inferred lane${intake.extractedLanes.length === 1 ? '' : 's'}` : null,
    intake.anchors?.length ? `${intake.anchors.length} inferred anchor${intake.anchors.length === 1 ? '' : 's'}` : null,
    critic?.derivedReasonCodes?.length ? `${critic.derivedReasonCodes.length} derived risk signal${critic.derivedReasonCodes.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="intake-timeline-review">
      <p className="timeline-placeholder">
        {intake.extractedLanes.length} lane{intake.extractedLanes.length !== 1 ? 's' : ''} ·{' '}
        {intake.anchors.length} anchor{intake.anchors.length !== 1 ? 's' : ''}
      </p>
      <div className="rounded-md border border-line/50 bg-jericho-bg px-3 py-3 text-xs text-muted space-y-1">
        <p>
          <span className="font-medium text-jericho-text">User-confirmed:</span> {userConfirmedCount} answer
          {userConfirmedCount === 1 ? '' : 's'}
        </p>
        <p>
          <span className="font-medium text-jericho-text">System-inferred:</span> {systemInferred || 'none yet'}
        </p>
        <p>
          <span className="font-medium text-jericho-text">Assumed due to uncertainty:</span>{' '}
          {critic?.unresolvedQuestions?.length || 0}
        </p>
        <p>
          <span className="font-medium text-jericho-text">Unresolved assumption debt:</span>{' '}
          {critic?.unresolvedReasonCodes?.length
            ? critic.unresolvedReasonCodes.slice(0, 4).join(' · ')
            : 'none'}
        </p>
      </div>
      <button onClick={() => onSubmit({ approved: true })}>Looks good</button>
    </div>
  );
}

function ScheduleConfirmInput({ intake, onSubmit }) {
  const horizon = intake?.answers?.step_3 || {};
  const masterPlanHorizon =
    horizon?.horizonEnd && horizon?.horizonMonths
      ? `${horizon.horizonMonths} months · through ${horizon.horizonEnd}`
      : horizon?.horizonEnd || 'Long-horizon plan preserved';
  return (
    <div className="intake-schedule-confirm">
      <p>This creates the Master Plan and then schedules only the first Sprint inside the first Operating Cycle.</p>
      <div className="rounded-md border border-line/50 bg-jericho-bg px-3 py-3 text-xs text-muted space-y-1">
        <p>
          <span className="font-medium text-jericho-text">Master Plan horizon:</span> {masterPlanHorizon}
        </p>
        <p>
          <span className="font-medium text-jericho-text">First Sprint:</span> default 2-week schedule window
        </p>
        <p>
          <span className="font-medium text-jericho-text">Why this slice comes first:</span> Jericho schedules the
          nearest executable window now, then reassesses before extending the calendar.
        </p>
      </div>
      <button onClick={onSubmit}>Confirm and create plan</button>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ExtractedLanesSidebar({ lanes, currentLaneIdx }) {
  return (
    <div className="intake-lanes-sidebar">
      <h4>Extracted lanes</h4>
      <ul>
        {lanes.map((lane, idx) => (
          <li
            key={idx}
            className={`intake-lane-item ${idx === currentLaneIdx ? 'current' : ''}`}
          >
            <span className="lane-title">{lane.title}</span>
            <span className="lane-domain">{lane.domain}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
