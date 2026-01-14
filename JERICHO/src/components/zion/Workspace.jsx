import React, { useEffect, useMemo, useState } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import { traceAction, traceNoop } from '../../dev/uiWiringTrace.ts';

const MODULES = {
  'Definite Goal': GoalLens
};

export default function Workspace({ modules = [] }) {
  const {
    activeCycleId,
    cyclesById,
    aspirationsByCycleId,
    setDefiniteGoal,
    setPatternTargets,
    startNewCycle,
    compileGoalEquation,
    setStrategy,
    generateColdPlan,
    rebaseColdPlan,
    appTime,
    cycle,
    today
  } = useIdentityStore();
  const activeCycle =
    activeCycleId && cyclesById ? cyclesById[activeCycleId] : null;
  const cycleAspirations =
    activeCycleId && aspirationsByCycleId
      ? aspirationsByCycleId[activeCycleId] || []
      : [];
  const activeStart = activeCycle?.startedAtDayKey || '—';
  const activeGoal = activeCycle?.definiteGoal?.outcome || '—';
  const activeDeadline = activeCycle?.definiteGoal?.deadlineDayKey || '—';
  const isReviewMode = activeCycle?.status && activeCycle.status !== 'active';

  if (!modules.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm uppercase tracking-[0.14em] text-muted">
        Identity Workspace — Refine the structure shaping your days.
      </h3>
      <p className="text-[11px] text-muted">
        Active cycle: {activeStart} · {activeGoal} · Deadline {activeDeadline}
      </p>
      <div className="grid gap-3">
        {modules.map((m) => {
          const Renderer =
            MODULES[m] ||
            (() => <div className="text-sm text-muted">Module</div>);
          const anchorId = m.replace(' ', '-').toLowerCase();
          return (
            <React.Fragment key={m}>
              <div
                id={anchorId}
                data-testid={`lens-${anchorId}`}
                className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{m}</span>
                </div>
                <Renderer
                  title={m}
                  disciplines={{}}
                  activeCycle={activeCycle}
                  cycleDays={cycle}
                  today={today}
                  aspirations={cycleAspirations}
                  onSetGoal={setDefiniteGoal}
                  onCompileGoalEquation={compileGoalEquation}
                  onSetPattern={setPatternTargets}
                  onStartNewCycle={startNewCycle}
                />
              </div>
              {m === 'Definite Goal' ? (
                <>
                  <TruthPanel today={today} />
                  <StrategyPanel
                    cycle={activeCycle}
                    timeZone={appTime?.timeZone}
                    onSetStrategy={setStrategy}
                    onGenerate={generateColdPlan}
                    onRebase={rebaseColdPlan}
                    readOnly={isReviewMode}
                  />
                </>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function StrategyPanel({
  cycle,
  timeZone,
  onSetStrategy,
  onGenerate,
  onRebase,
  readOnly = false
}) {
  const strategy = cycle?.strategy;
  const coldPlan = cycle?.coldPlan;
  const [routeOption, setRouteOption] = useState(
    strategy?.routeOption || 'FLAT'
  );
  const [deliverables, setDeliverables] = useState(
    strategy?.deliverables || []
  );
  const [maxPerDay, setMaxPerDay] = useState(
    strategy?.constraints?.maxBlocksPerDay || ''
  );
  const [maxPerWeek, setMaxPerWeek] = useState(
    strategy?.constraints?.maxBlocksPerWeek || ''
  );
  const [preferredDays, setPreferredDays] = useState(
    strategy?.constraints?.preferredDaysOfWeek || []
  );
  const [blackouts, setBlackouts] = useState(
    (strategy?.constraints?.blackoutDayKeys || []).join(', ')
  );

  useEffect(() => {
    setRouteOption(strategy?.routeOption || 'FLAT');
    setDeliverables(strategy?.deliverables || []);
    setMaxPerDay(strategy?.constraints?.maxBlocksPerDay || '');
    setMaxPerWeek(strategy?.constraints?.maxBlocksPerWeek || '');
    setPreferredDays(strategy?.constraints?.preferredDaysOfWeek || []);
    setBlackouts((strategy?.constraints?.blackoutDayKeys || []).join(', '));
  }, [strategy?.routeOption, strategy?.deliverables, strategy?.constraints]);

  const updateDeliverable = (idx, patch) => {
    setDeliverables((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d))
    );
  };

  const addDeliverable = () => {
    setDeliverables((prev) => [
      ...prev,
      { id: `deliv-${prev.length + 1}`, title: '', requiredBlocks: 0 }
    ]);
  };

  const removeDeliverable = (idx) => {
    setDeliverables((prev) => prev.filter((_, i) => i !== idx));
  };

  const togglePreferredDay = (day) => {
    setPreferredDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const totalBlocks = deliverables.reduce(
    (sum, d) => sum + (Number(d.requiredBlocks) || 0),
    0
  );

  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-muted">
          Cold Plan Strategy
        </p>
        <p className="text-[11px] text-muted">
          Route-based forecast map (not evidence).
        </p>
      </div>
      <div className="grid gap-2 text-xs">
        <label className="text-muted">Route option</label>
        <select
          className="rounded border border-line/60 bg-transparent px-2 py-1"
          value={routeOption}
          onChange={(e) => setRouteOption(e.target.value)}
          disabled={readOnly}
        >
          <option value="FLAT">Flat</option>
          <option value="RAMP_UP">Ramp up</option>
          <option value="MILESTONE_QUARTERS">Milestone quarters</option>
          <option value="WAVE_3_1">Wave 3:1</option>
        </select>
      </div>
      <div className="space-y-2 text-xs">
        <p className="text-muted font-semibold">Deliverables</p>
        {deliverables.map((d, idx) => (
          <div key={d.id || idx} className="flex flex-wrap gap-2">
            <input
              className="rounded border border-line/60 bg-transparent px-2 py-1 flex-1 min-w-[160px]"
              value={d.title || ''}
              placeholder="Deliverable title"
              onChange={(e) =>
                updateDeliverable(idx, { title: e.target.value })
              }
              disabled={readOnly}
            />
            <input
              type="number"
              min={0}
              className="w-24 rounded border border-line/60 bg-transparent px-2 py-1"
              value={d.requiredBlocks || 0}
              onChange={(e) =>
                updateDeliverable(idx, {
                  requiredBlocks: Number(e.target.value) || 0
                })
              }
              disabled={readOnly}
            />
            <button
              className="rounded-full border border-line/60 px-2 py-1 text-muted hover:text-jericho-accent"
              onClick={() => removeDeliverable(idx)}
              disabled={readOnly}
            >
              Remove
            </button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button
            className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
            onClick={addDeliverable}
            disabled={readOnly}
          >
            Add deliverable
          </button>
          <span className="text-[11px] text-muted">
            Total blocks: {totalBlocks}
          </span>
        </div>
      </div>
      <div className="space-y-2 text-xs">
        <p className="text-muted font-semibold">
          Constraints (advisory for plan generation)
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            min={0}
            className="w-32 rounded border border-line/60 bg-transparent px-2 py-1"
            value={maxPerDay}
            onChange={(e) => setMaxPerDay(e.target.value)}
            placeholder="Max blocks/day (plan)"
            disabled={readOnly}
          />
          <input
            type="number"
            min={0}
            className="w-32 rounded border border-line/60 bg-transparent px-2 py-1"
            value={maxPerWeek}
            onChange={(e) => setMaxPerWeek(e.target.value)}
            placeholder="Max blocks/week (plan)"
            disabled={readOnly}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              className={`rounded-full border px-2 py-1 ${
                preferredDays.includes(d)
                  ? 'border-jericho-accent text-jericho-accent'
                  : 'border-line/60 text-muted'
              }`}
              onClick={() => togglePreferredDay(d)}
              disabled={readOnly}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted">
          Preferred days (used for route generation only).
        </p>
        <input
          className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
          placeholder="Blackout dayKeys (plan generation, comma-separated)"
          value={blackouts}
          onChange={(e) => setBlackouts(e.target.value)}
          disabled={readOnly}
        />
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
          onClick={() =>
            onSetStrategy
              ? (traceAction('strategy.save', { cycleId: cycle?.id }),
                onSetStrategy({
                  routeOption,
                  deliverables,
                  constraints: {
                    tz: timeZone,
                    maxBlocksPerDay: maxPerDay ? Number(maxPerDay) : undefined,
                    maxBlocksPerWeek: maxPerWeek
                      ? Number(maxPerWeek)
                      : undefined,
                    preferredDaysOfWeek: preferredDays,
                    blackoutDayKeys: blackouts
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean)
                  }
                }))
              : traceNoop('strategy.save', 'handler missing')
          }
          disabled={readOnly}
        >
          Save strategy
        </button>
        <button
          className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
          onClick={() =>
            onGenerate
              ? (traceAction('strategy.regenerate', { cycleId: cycle?.id }),
                onGenerate())
              : traceNoop('strategy.regenerate', 'handler missing')
          }
          disabled={readOnly}
        >
          Regenerate route
        </button>
        <button
          className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
          onClick={() =>
            onRebase
              ? (traceAction('strategy.rebase', { cycleId: cycle?.id }),
                onRebase())
              : traceNoop('strategy.rebase', 'handler missing')
          }
          disabled={readOnly}
        >
          Re-base from today
        </button>
      </div>
      <div className="text-[11px] text-muted">
        {coldPlan ? (
          <>
            Cold plan v{coldPlan.version} · Strategy {coldPlan.strategyId} ·
            Assumptions {coldPlan.assumptionsHash}
            {coldPlan.infeasible ? (
              <div className="text-amber-600">
                Infeasible: {coldPlan.infeasible.reason} (need{' '}
                {coldPlan.infeasible.requiredCapacityPerWeek}/week, cap{' '}
                {coldPlan.infeasible.availableCapacityPerWeek}/week)
              </div>
            ) : null}
          </>
        ) : (
          'Cold plan not generated yet.'
        )}
      </div>
    </div>
  );
}

function GoalLens({
  activeCycle,
  aspirations = [],
  onSetGoal,
  onStartNewCycle,
  onCompileGoalEquation
}) {
  const equation = activeCycle?.goalEquation;
  const planProof = activeCycle?.goalPlan?.planProof || null;
  const scheduleBlocks = activeCycle?.goalPlan?.scheduleBlocks || [];
  const [label, setLabel] = useState(equation?.label || '');
  const [family, setFamily] = useState(equation?.family || 'BODY');
  const [objective, setObjective] = useState(
    equation?.objective || 'LOSE_WEIGHT_LBS'
  );
  const [objectiveValue, setObjectiveValue] = useState(
    equation?.objectiveValue || 10
  );
  const [mechanismClass, setMechanismClass] = useState(
    equation?.mechanismClass || 'GENERIC_DETERMINISTIC'
  );
  const [deadlineDayKey, setDeadlineDayKey] = useState(
    equation?.deadlineDayKey || activeCycle?.definiteGoal?.deadlineDayKey || ''
  );
  const [deadlineType, setDeadlineType] = useState(
    equation?.deadlineType || 'HARD'
  );
  const [workingFullTime, setWorkingFullTime] = useState(
    equation?.workingFullTime ?? true
  );
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(
    equation?.workDaysPerWeek || 5
  );
  const [workStartWindow, setWorkStartWindow] = useState(
    equation?.workStartWindow || 'MID'
  );
  const [workEndWindow, setWorkEndWindow] = useState(
    equation?.workEndWindow || 'MID'
  );
  const [minSleepHours, setMinSleepHours] = useState(
    equation?.minSleepHours || 8
  );
  const [sleepFixedWindow, setSleepFixedWindow] = useState(
    equation?.sleepFixedWindow ?? false
  );
  const [sleepStartWindow, setSleepStartWindow] = useState(
    equation?.sleepStartWindow || 'LATE'
  );
  const [sleepEndWindow, setSleepEndWindow] = useState(
    equation?.sleepEndWindow || 'EARLY'
  );
  const [hasWeeklyRestDay, setHasWeeklyRestDay] = useState(
    equation?.hasWeeklyRestDay ?? true
  );
  const [restDay, setRestDay] = useState(equation?.restDay ?? 0);
  const [blackoutBlocks, setBlackoutBlocks] = useState(
    equation?.blackoutBlocks || []
  );
  const [hasGymAccess, setHasGymAccess] = useState(
    equation?.hasGymAccess ?? true
  );
  const [canCookMostDays, setCanCookMostDays] = useState(
    equation?.canCookMostDays ?? true
  );
  const [hasTransportLimitation, setHasTransportLimitation] = useState(
    equation?.hasTransportLimitation ?? false
  );
  const [currentlyInjured, setCurrentlyInjured] = useState(
    equation?.currentlyInjured ?? false
  );
  const [beginnerLevel, setBeginnerLevel] = useState(
    equation?.beginnerLevel ?? false
  );
  const [maxDailyWorkMinutes, setMaxDailyWorkMinutes] = useState(
    equation?.maxDailyWorkMinutes || 120
  );
  const [noEveningWork, setNoEveningWork] = useState(
    equation?.noEveningWork ?? false
  );
  const [noMorningWork, setNoMorningWork] = useState(
    equation?.noMorningWork ?? false
  );
  const [weekendsAllowed, setWeekendsAllowed] = useState(
    equation?.weekendsAllowed ?? true
  );
  const [travelThisPeriod, setTravelThisPeriod] = useState(
    equation?.travelThisPeriod || 'NONE'
  );
  const [acceptsDailyMinimum, setAcceptsDailyMinimum] = useState(
    equation?.acceptsDailyMinimum ?? false
  );
  const [acceptsFixedSchedule, setAcceptsFixedSchedule] = useState(
    equation?.acceptsFixedSchedule ?? false
  );
  const [acceptsNoRenegotiation7d, setAcceptsNoRenegotiation7d] = useState(
    equation?.acceptsNoRenegotiation7d ?? false
  );
  const [acceptsAutomaticCatchUp, setAcceptsAutomaticCatchUp] = useState(
    equation?.acceptsAutomaticCatchUp ?? false
  );
  const [errors, setErrors] = useState({
    objectiveValue: '',
    deadline: '',
    mechanismClass: ''
  });
  const [compiledAtISO, setCompiledAtISO] = useState('');
  const admission = activeCycle?.goalAdmission || null;
  const admissionError =
    admission && admission.status !== 'ADMITTED'
      ? `${admission.status}: ${(admission.reasonCodes || []).join(', ')}`
      : '';

  useEffect(() => {
    setLabel(equation?.label || '');
    setFamily(equation?.family || 'BODY');
    setObjective(equation?.objective || 'LOSE_WEIGHT_LBS');
    setObjectiveValue(equation?.objectiveValue || 10);
    setMechanismClass(equation?.mechanismClass || '');
    setDeadlineDayKey(
      equation?.deadlineDayKey ||
        activeCycle?.definiteGoal?.deadlineDayKey ||
        ''
    );
    setDeadlineType(equation?.deadlineType || 'HARD');
    setWorkingFullTime(equation?.workingFullTime ?? true);
    setWorkDaysPerWeek(equation?.workDaysPerWeek || 5);
    setWorkStartWindow(equation?.workStartWindow || 'MID');
    setWorkEndWindow(equation?.workEndWindow || 'MID');
    setMinSleepHours(equation?.minSleepHours || 8);
    setSleepFixedWindow(equation?.sleepFixedWindow ?? false);
    setSleepStartWindow(equation?.sleepStartWindow || 'LATE');
    setSleepEndWindow(equation?.sleepEndWindow || 'EARLY');
    setHasWeeklyRestDay(equation?.hasWeeklyRestDay ?? true);
    setRestDay(equation?.restDay ?? 0);
    setBlackoutBlocks(equation?.blackoutBlocks || []);
    setHasGymAccess(equation?.hasGymAccess ?? true);
    setCanCookMostDays(equation?.canCookMostDays ?? true);
    setHasTransportLimitation(equation?.hasTransportLimitation ?? false);
    setCurrentlyInjured(equation?.currentlyInjured ?? false);
    setBeginnerLevel(equation?.beginnerLevel ?? false);
    setMaxDailyWorkMinutes(equation?.maxDailyWorkMinutes || 120);
    setNoEveningWork(equation?.noEveningWork ?? false);
    setNoMorningWork(equation?.noMorningWork ?? false);
    setWeekendsAllowed(equation?.weekendsAllowed ?? true);
    setTravelThisPeriod(equation?.travelThisPeriod || 'NONE');
    setAcceptsDailyMinimum(equation?.acceptsDailyMinimum ?? false);
    setAcceptsFixedSchedule(equation?.acceptsFixedSchedule ?? false);
    setAcceptsNoRenegotiation7d(equation?.acceptsNoRenegotiation7d ?? false);
    setAcceptsAutomaticCatchUp(equation?.acceptsAutomaticCatchUp ?? false);
  }, [equation, activeCycle?.definiteGoal?.deadlineDayKey]);

  const objectiveOptions =
    family === 'BODY'
      ? ['LOSE_WEIGHT_LBS']
      : family === 'SKILL'
        ? ['PRACTICE_HOURS_TOTAL']
        : ['PUBLISH_COUNT'];
  const formattedDeadline = deadlineDayKey
    ? formatDayKeyLong(deadlineDayKey)
    : '—';
  const objectiveUnit =
    objective === 'LOSE_WEIGHT_LBS'
      ? 'lbs'
      : objective === 'PRACTICE_HOURS_TOTAL'
        ? 'hours'
        : 'count';

  const compile = () => {
    const nextErrors = { objectiveValue: '', deadline: '', mechanismClass: '' };
    if (!objectiveValue || Number(objectiveValue) <= 0)
      nextErrors.objectiveValue = 'Objective value is required.';
    if (!deadlineDayKey) nextErrors.deadline = 'Deadline is required.';
    if (!mechanismClass)
      nextErrors.mechanismClass = 'Mechanism class is required.';
    if (
      nextErrors.objectiveValue ||
      nextErrors.deadline ||
      nextErrors.mechanismClass
    ) {
      setErrors(nextErrors);
      setCompiledAtISO('');
      return;
    }
    const payload = {
      equation: {
        label: label.trim() || undefined,
        family,
        objective,
        objectiveValue: Number(objectiveValue),
        mechanismClass,
        deadlineDayKey,
        deadlineType,
        workingFullTime,
        workDaysPerWeek,
        workStartWindow,
        workEndWindow,
        minSleepHours,
        sleepFixedWindow,
        sleepStartWindow,
        sleepEndWindow,
        hasWeeklyRestDay,
        restDay,
        blackoutBlocks,
        hasGymAccess,
        canCookMostDays,
        hasTransportLimitation,
        currentlyInjured,
        beginnerLevel,
        maxDailyWorkMinutes,
        noEveningWork,
        noMorningWork,
        weekendsAllowed,
        travelThisPeriod,
        acceptsDailyMinimum,
        acceptsFixedSchedule,
        acceptsNoRenegotiation7d,
        acceptsAutomaticCatchUp
      }
    };
    if (onCompileGoalEquation) {
      traceAction('goal.compile', payload.equation);
      onCompileGoalEquation(payload);
    } else {
      traceNoop('goal.compile', 'handler missing');
    }
    setErrors({ objectiveValue: '', deadline: '', mechanismClass: '' });
    setCompiledAtISO(`${deadlineDayKey}T12:00:00.000Z`);
  };

  return (
    <div className="space-y-3 text-sm text-muted">
      <p>Definite Goal Equation: compile a cold plan from structured inputs.</p>
      <div className="grid gap-2 text-xs">
        <input
          className="w-full rounded border border-line/60 bg-transparent p-2 text-xs"
          placeholder="Goal label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Goal family</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={family}
              onChange={(e) => {
                const next = e.target.value;
                setFamily(next);
                const nextObjective =
                  next === 'BODY'
                    ? 'LOSE_WEIGHT_LBS'
                    : next === 'SKILL'
                      ? 'PRACTICE_HOURS_TOTAL'
                      : 'PUBLISH_COUNT';
                setObjective(nextObjective);
              }}
            >
              <option value="BODY">Body</option>
              <option value="SKILL">Skill</option>
              <option value="OUTPUT">Output</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">
              Plan generation mechanism
            </span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={mechanismClass}
              onChange={(e) => setMechanismClass(e.target.value)}
            >
              <option value="">Select mechanism</option>
              <option value="GENERIC_DETERMINISTIC">Deterministic (v1)</option>
              <option value="TEMPLATE_PIPELINE" disabled>
                Template pipeline (future)
              </option>
              <option value="HABIT_LOOP" disabled>
                Habit loop (future)
              </option>
              <option value="PROJECT_MILESTONE" disabled>
                Project milestone (future)
              </option>
              <option value="DELIVERABLE_DRIVEN" disabled>
                Deliverable driven (future)
              </option>
              <option value="CUSTOM" disabled>
                Custom (future)
              </option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Objective</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            >
              {objectiveOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.replace(/_/g, ' ').toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">
              Target value ({objectiveUnit})
            </span>
            <input
              type="number"
              min={1}
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={objectiveValue}
              onChange={(e) => setObjectiveValue(Number(e.target.value) || 0)}
            />
          </label>
        </div>
        {errors.objectiveValue ? (
          <p className="text-[11px] text-amber-600">{errors.objectiveValue}</p>
        ) : null}
        {errors.mechanismClass ? (
          <p className="text-[11px] text-amber-600">{errors.mechanismClass}</p>
        ) : null}
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Deadline</span>
            <input
              type="date"
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={deadlineDayKey}
              onChange={(e) => setDeadlineDayKey(e.target.value.slice(0, 10))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Deadline type</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={deadlineType}
              onChange={(e) => setDeadlineType(e.target.value)}
            >
              <option value="HARD">Hard</option>
              <option value="SOFT">Soft</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-muted">Deadline: {formattedDeadline}</p>
        {errors.deadline ? (
          <p className="text-[11px] text-amber-600">{errors.deadline}</p>
        ) : null}
      </div>
      {admissionError ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700">
          Admission rejected: {admissionError}
        </div>
      ) : null}
      {aspirations.length ? (
        <div className="rounded border border-line/60 bg-jericho-surface/80 px-3 py-2 text-[11px] text-muted">
          <p className="uppercase tracking-[0.12em] text-muted">Aspirations</p>
          <ul className="mt-2 space-y-1">
            {aspirations.slice(-3).map((asp) => (
              <li key={asp.aspirationId}>
                {asp.draft?.label || asp.draft?.objective || 'Draft'} ·{' '}
                {asp.admissionStatus}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-md border border-line/60 bg-jericho-surface/80 p-3 space-y-2 text-xs">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          Time budget & availability
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={workingFullTime}
              onChange={(e) => setWorkingFullTime(e.target.checked)}
            />
            Working full-time
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Work days/week</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={workDaysPerWeek}
              onChange={(e) => setWorkDaysPerWeek(Number(e.target.value))}
            >
              {[3, 4, 5, 6, 7].map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">
              Max daily work minutes
            </span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={maxDailyWorkMinutes}
              onChange={(e) => setMaxDailyWorkMinutes(Number(e.target.value))}
            >
              {[30, 60, 90, 120, 180].map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Work start window</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={workStartWindow}
              onChange={(e) => setWorkStartWindow(e.target.value)}
            >
              {['EARLY', 'MID', 'LATE', 'VARIABLE'].map((val) => (
                <option key={val} value={val}>
                  {val.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Work end window</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={workEndWindow}
              onChange={(e) => setWorkEndWindow(e.target.value)}
            >
              {['EARLY', 'MID', 'LATE', 'VARIABLE'].map((val) => (
                <option key={val} value={val}>
                  {val.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Min sleep hours</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={minSleepHours}
              onChange={(e) => setMinSleepHours(Number(e.target.value))}
            >
              {[6, 7, 8, 9].map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sleepFixedWindow}
              onChange={(e) => setSleepFixedWindow(e.target.checked)}
            />
            Sleep fixed window
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasWeeklyRestDay}
              onChange={(e) => setHasWeeklyRestDay(e.target.checked)}
            />
            Weekly rest day
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Sleep start</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={sleepStartWindow}
              onChange={(e) => setSleepStartWindow(e.target.value)}
            >
              {['EARLY', 'MID', 'LATE', 'VARIABLE'].map((val) => (
                <option key={val} value={val}>
                  {val.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Sleep end</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={sleepEndWindow}
              onChange={(e) => setSleepEndWindow(e.target.value)}
            >
              {['EARLY', 'MID', 'LATE', 'VARIABLE'].map((val) => (
                <option key={val} value={val}>
                  {val.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Rest day</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={restDay}
              onChange={(e) => setRestDay(Number(e.target.value))}
              disabled={!hasWeeklyRestDay}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                (label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noMorningWork}
              onChange={(e) => setNoMorningWork(e.target.checked)}
            />
            No morning work
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noEveningWork}
              onChange={(e) => setNoEveningWork(e.target.checked)}
            />
            No evening work
          </label>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={weekendsAllowed}
            onChange={(e) => setWeekendsAllowed(e.target.checked)}
          />
          Weekends allowed
        </label>
        <div className="space-y-1">
          <span className="text-[11px] text-muted">
            Blackout blocks (fixed)
          </span>
          <div className="grid sm:grid-cols-3 gap-2 text-[11px]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="space-y-1">
                <p className="text-[11px] text-muted">{day}</p>
                {['MORNING', 'MIDDAY', 'EVENING'].map((slot) => {
                  const key = `${day}:${slot}`;
                  const active = blackoutBlocks.includes(key);
                  return (
                    <button
                      key={key}
                      className={`w-full rounded border px-2 py-1 ${
                        active
                          ? 'border-jericho-accent text-jericho-accent'
                          : 'border-line/60 text-muted'
                      }`}
                      onClick={() =>
                        setBlackoutBlocks((prev) =>
                          prev.includes(key)
                            ? prev.filter((v) => v !== key)
                            : [...prev, key]
                        )
                      }
                    >
                      {slot.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-line/60 bg-jericho-surface/80 p-3 space-y-2 text-xs">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          Constraints & non-negotiables
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasGymAccess}
              onChange={(e) => setHasGymAccess(e.target.checked)}
            />
            Gym access
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={canCookMostDays}
              onChange={(e) => setCanCookMostDays(e.target.checked)}
            />
            Can cook most days
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hasTransportLimitation}
              onChange={(e) => setHasTransportLimitation(e.target.checked)}
            />
            Transport limitation
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={currentlyInjured}
              onChange={(e) => setCurrentlyInjured(e.target.checked)}
            />
            Currently injured
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={beginnerLevel}
              onChange={(e) => setBeginnerLevel(e.target.checked)}
            />
            Beginner level
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-muted">Travel this period</span>
            <select
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
              value={travelThisPeriod}
              onChange={(e) => setTravelThisPeriod(e.target.value)}
            >
              {['NONE', '1-3', '4-7', '8+'].map((val) => (
                <option key={val} value={val}>
                  {val}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-md border border-line/60 bg-jericho-surface/80 p-3 space-y-2 text-xs">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          Commitment contract
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={acceptsDailyMinimum}
              onChange={(e) => setAcceptsDailyMinimum(e.target.checked)}
            />
            Accept daily minimum
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={acceptsFixedSchedule}
              onChange={(e) => setAcceptsFixedSchedule(e.target.checked)}
            />
            Accept fixed schedule
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={acceptsNoRenegotiation7d}
              onChange={(e) => setAcceptsNoRenegotiation7d(e.target.checked)}
            />
            Accept no renegotiation (7 days)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={acceptsAutomaticCatchUp}
              onChange={(e) => setAcceptsAutomaticCatchUp(e.target.checked)}
            />
            Accept automatic catch-up after miss
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/10"
          onClick={compile}
        >
          Compile plan
        </button>
        <button
          className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
          onClick={() => {
            if (!onStartNewCycle) {
              traceNoop('cycle.new', 'handler missing');
              return;
            }
            traceAction('cycle.new', {
              goalText: label || objective,
              deadlineDayKey
            });
            onStartNewCycle({
              goalText: label || objective,
              deadlineDayKey
            });
          }}
        >
          Start new goal (new cycle)
        </button>
        {compiledAtISO ? (
          <span className="text-[11px] text-emerald-600">
            Plan proof compiled · {formatAtISO(compiledAtISO)}
          </span>
        ) : null}
      </div>

      <div className="rounded-md border border-line/60 bg-jericho-surface/90 p-3 text-xs space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          Plan proof
        </p>
        {planProof ? (
          <>
            <p className="text-jericho-text">
              {planProof.status} · {planProof.verdict}
            </p>
            <p className="text-[11px] text-muted">
              {planProof.status === 'SUBMITTED'
                ? 'Calendar scheduled with governance (7-day lock + weekly review).'
                : 'Draft only: preview schedule, no calendar write or enforcement.'}
            </p>
            <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-muted">
              <div>Required minutes/day: {planProof.requiredMinutesPerDay}</div>
              <div>Workable days: {planProof.workableDays}</div>
              <div>Scheduled blocks: {planProof.scheduledBlocks}</div>
              <div>Weekly minutes: {planProof.weeklyMinutes}</div>
            </div>
            {planProof.changeList?.length ? (
              <div className="text-[11px] text-amber-600">
                Changes: {planProof.changeList.join(' · ')}
              </div>
            ) : null}
            <div className="text-[11px] text-muted">
              Constraints: {planProof.constraintsSummary.join(' · ')}
            </div>
            <div className="text-[11px] text-muted">
              Failure conditions: {planProof.failureConditions.join(' · ')}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted">
            Plan proof will appear after compile.
          </p>
        )}
      </div>

      <div className="rounded-md border border-line/60 bg-jericho-surface/90 p-3 text-xs space-y-2">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          Scheduled blocks (preview)
        </p>
        {scheduleBlocks.length ? (
          scheduleBlocks.slice(0, 6).map((b) => (
            <div key={b.id} className="text-[11px] text-muted">
              {formatDayKeyLong(b.dayKey)} · {b.title} · {b.durationMinutes}m{' '}
              {b.locked ? '· locked' : ''}
            </div>
          ))
        ) : (
          <p className="text-[11px] text-muted">No blocks scheduled yet.</p>
        )}
      </div>
    </div>
  );
}

function TruthPanel({ today }) {
  const { appTime, truthEntries, addTruthEntry } = useIdentityStore();
  const dayKey = appTime?.activeDayKey || today?.date || '';
  const [constraints, setConstraints] = useState([]);
  const [constraintNotes, setConstraintNotes] = useState({});
  const [assumptions, setAssumptions] = useState('');
  const [nonNegotiables, setNonNegotiables] = useState(['', '', '']);
  const [reality, setReality] = useState('');
  const [savedAtISO, setSavedAtISO] = useState('');

  const toggleConstraint = (value) => {
    setConstraints((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = () => {
    const trimmedNonNegotiables = nonNegotiables
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 3);
    const hasContent =
      constraints.length ||
      assumptions.trim() ||
      trimmedNonNegotiables.length ||
      reality.trim();
    if (!hasContent) return;
    const atISO = `${dayKey}T12:00:00.000Z`;
    const existingCount = Array.isArray(truthEntries) ? truthEntries.length : 0;
    const entry = {
      id: `${dayKey}-${existingCount + 1}`,
      dayKey,
      atISO,
      constraints: constraints.slice(),
      constraintNotes: { ...constraintNotes },
      assumptions: assumptions.trim(),
      nonNegotiables: trimmedNonNegotiables,
      reality: reality.trim()
    };
    if (addTruthEntry) {
      traceAction('truthPanel.addEntry', { dayKey, constraints });
      addTruthEntry(entry);
    } else {
      traceNoop('truthPanel.addEntry', 'handler missing');
    }
    setSavedAtISO(atISO);
    setAssumptions('');
    setReality('');
    setNonNegotiables(['', '', '']);
    setConstraints([]);
    setConstraintNotes({});
  };

  const groupedEntries = useMemo(() => {
    const recent = (truthEntries || []).slice(0, 7);
    const grouped = new Map();
    recent.forEach((entry) => {
      if (!grouped.has(entry.dayKey)) grouped.set(entry.dayKey, []);
      grouped.get(entry.dayKey).push(entry);
    });
    return Array.from(grouped.entries());
  }, [truthEntries]);

  return (
    <div className="rounded-xl border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-jericho-text">Truth Panel</p>
        <p className="text-[11px] text-muted">
          Record constraints and assumptions for later reflection.
        </p>
      </div>
      <div className="space-y-2 text-xs text-muted">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
            Constraints
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              'TIME_AVAILABILITY',
              'MONEY_RESOURCES',
              'ENVIRONMENT',
              'HEALTH'
            ].map((c) => (
              <button
                key={c}
                className={`rounded-full border px-3 py-1 ${
                  constraints.includes(c)
                    ? 'border-jericho-accent text-jericho-accent'
                    : 'border-line/60 text-muted'
                }`}
                onClick={() => toggleConstraint(c)}
              >
                {c.replace('_', ' ').toLowerCase()}
              </button>
            ))}
          </div>
          {constraints.length ? (
            <div className="space-y-1">
              {constraints.map((c) => (
                <input
                  key={c}
                  className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
                  placeholder={`Note for ${c.toLowerCase().replace('_', ' ')}`}
                  value={constraintNotes[c] || ''}
                  onChange={(e) =>
                    setConstraintNotes((prev) => ({
                      ...prev,
                      [c]: e.target.value
                    }))
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
            Assumptions
          </p>
          <textarea
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
            placeholder="Short assumptions..."
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
            Non-negotiables (max 3)
          </p>
          {nonNegotiables.map((value, idx) => (
            <input
              key={idx}
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
              value={value}
              onChange={(e) =>
                setNonNegotiables((prev) =>
                  prev.map((v, i) => (i === idx ? e.target.value : v))
                )
              }
              placeholder={`Non-negotiable ${idx + 1}`}
            />
          ))}
        </div>
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
            Current reality
          </p>
          <input
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-xs"
            value={reality}
            onChange={(e) => setReality(e.target.value)}
            placeholder="One sentence..."
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 rounded border border-line/60 text-jericho-accent font-semibold"
            onClick={handleSave}
          >
            Add entry
          </button>
          {savedAtISO ? (
            <span className="text-[11px] text-emerald-600">
              Saved · {formatAtISO(savedAtISO)}
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-2 text-xs text-muted">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
          Recent entries
        </p>
        {groupedEntries.length ? (
          groupedEntries.map(([groupKey, list]) => (
            <div key={groupKey} className="space-y-2">
              <p className="text-[11px] text-muted">
                {formatDayKeyLong(groupKey)}
              </p>
              {list.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-line/40 bg-jericho-surface/80 px-3 py-2 space-y-1"
                >
                  <p className="text-[11px] text-muted">
                    {formatAtISO(entry.atISO)}
                  </p>
                  {entry.constraints.length ? (
                    <p>
                      Constraints:{' '}
                      {entry.constraints
                        .map((c) =>
                          entry.constraintNotes?.[c]
                            ? `${c} (${entry.constraintNotes[c]})`
                            : c
                        )
                        .join(', ')}
                    </p>
                  ) : null}
                  {entry.assumptions ? (
                    <p>Assumptions: {entry.assumptions}</p>
                  ) : null}
                  {entry.nonNegotiables.length ? (
                    <p>Non-negotiables: {entry.nonNegotiables.join(', ')}</p>
                  ) : null}
                  {entry.reality ? <p>Reality: {entry.reality}</p> : null}
                </div>
              ))}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted">No truth entries yet.</p>
        )}
      </div>
    </div>
  );
}

function PatternLens({ activeCycle, cycleDays = [], today }) {
  const domains = ['Body', 'Resources', 'Creation', 'Focus'];
  const [applied] = useState(false); // legacy flag kept for layout stability
  const [expanded, setExpanded] = useState({});
  const definitions = {
    Body: 'Physical',
    Resources: 'External',
    Creation: 'Output',
    Focus: 'Input'
  };
  const examples = {
    Body: 'sleep, training, nutrition, recovery, mobility',
    Creation: 'building, writing, recording, shipping, publishing',
    Focus: 'reading, studying, research, listening, skill acquisition',
    Resources: 'money, tools, relationships, logistics, access'
  };
  const minutesFromBlocks = (blocks = []) =>
    blocks.reduce(
      (acc, b) => {
        const start = b?.start ? new Date(b.start).getTime() : 0;
        const end = b?.end ? new Date(b.end).getTime() : 0;
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        const key = b?.practice || b?.domain || 'Focus';
        acc.scheduled[key] = (acc.scheduled[key] || 0) + minutes;
        if (b?.status === 'completed' || b?.status === 'complete') {
          acc.completed[key] = (acc.completed[key] || 0) + minutes;
        }
        return acc;
      },
      { scheduled: {}, completed: {} }
    );
  const aggregate = (cycleDays || []).reduce(
    (acc, day) => {
      const { scheduled, completed } = minutesFromBlocks(day?.blocks || []);
      domains.forEach((d) => {
        acc.scheduled[d] = (acc.scheduled[d] || 0) + (scheduled[d] || 0);
        acc.completed[d] = (acc.completed[d] || 0) + (completed[d] || 0);
      });
      return acc;
    },
    { scheduled: {}, completed: {} }
  );
  const totals = domains.map((d) => {
    const scheduled = aggregate.scheduled[d] || 0;
    const completed = aggregate.completed[d] || 0;
    const gap = Math.max(0, scheduled - completed);
    return { name: d, scheduled, completed, gap };
  });
  const totalCompleted = totals.reduce((sum, d) => sum + d.completed, 0) || 1;
  const distribution = totals.map((d) => ({
    name: d.name,
    percent: Math.round((d.completed / totalCompleted) * 100)
  }));
  const last7 = (cycleDays || [])
    .filter((d) => d?.date)
    .slice(-7)
    .map((d) => Math.round((d.completionRate || 0) * 100));
  const streak = last7.filter((v) => v === 100).length;
  return (
    <div className="space-y-3 text-sm text-muted">
      <p>Pattern: Read-only diagnostics derived from completion history.</p>
      <div className="grid grid-cols-2 gap-3">
        {totals.map((t) => (
          <div
            key={t.name}
            className="rounded-lg border border-line/60 bg-jericho-surface/80 p-3 space-y-1"
          >
            <p className="text-xs uppercase tracking-[0.12em] text-muted">
              {t.name}
            </p>
            <p className="text-[11px] text-muted">{definitions[t.name]}</p>
            <p className="text-[11px] text-muted">Scheduled: {t.scheduled}m</p>
            <p className="text-[11px] text-muted">Completed: {t.completed}m</p>
            <p className="text-[11px] text-muted">Gap: {t.gap}m</p>
            <button
              className="text-[11px] text-jericho-accent hover:underline"
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [t.name]: !prev[t.name] }))
              }
            >
              What counts?
            </button>
            {expanded[t.name] ? (
              <p className="text-[11px] text-muted">{examples[t.name]}</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-line/60 bg-jericho-surface/80 p-3 space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">
            Distribution (completed)
          </p>
          <ul className="space-y-1 text-[11px]">
            {distribution.map((d) => (
              <li key={d.name}>
                {d.name}: {d.percent}%
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-line/60 bg-jericho-surface/80 p-3 space-y-1">
          <p className="text-xs uppercase tracking-[0.12em] text-muted">
            Trend
          </p>
          <p className="text-[11px] text-muted">
            Last 7 completion: {last7.join('% · ')}%
          </p>
          <p className="text-[11px] text-muted">
            Streak (100% days in last 7): {streak}
          </p>
        </div>
      </div>
      {applied ? (
        <span className="text-[11px] text-emerald-600">Updated</span>
      ) : null}
    </div>
  );
}

function formatDayKeyLong(dayKey = '') {
  if (!dayKey) return '—';
  const [year, month, day] = dayKey.split('-');
  const monthIndex = Number(month) - 1;
  const dayNum = Number(day);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  if (
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(dayNum) ||
    !months[monthIndex]
  )
    return dayKey;
  return `${months[monthIndex]} ${dayNum}, ${year}`;
}

function formatAtISO(atISO = '') {
  if (!atISO) return '—';
  const dayKey = atISO.slice(0, 10);
  const time = atISO.slice(11, 16);
  return `${formatDayKeyLong(dayKey)} ${time}`;
}

export { PatternLens };
