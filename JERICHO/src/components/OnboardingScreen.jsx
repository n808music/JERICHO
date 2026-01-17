import React, { useMemo, useState } from 'react';

const DEFAULT_BLOCK_MINUTES = 60;
const OBJECTIVE_TYPES = [
  { value: 'create', label: 'Create a deliverable' },
  { value: 'practice', label: 'Practice a discipline' },
  { value: 'build', label: 'Build a product' },
  { value: 'learn', label: 'Learn a skill' },
  { value: 'grow', label: 'Grow impact or revenue' }
];

const DOMAINS = ['Creation', 'Focus', 'Resources', 'Body'];
const WORK_MODES = ['CREATE', 'PRACTICE', 'SHIP', 'SELL', 'LEARN'];
const MINUTES_PER_DAY_OPTIONS = [30, 45, 60, 90, 120, 180, 240];
const TIME_WINDOWS = ['Any', 'Morning', 'Afternoon', 'Evening'];
const TARGET_UNIT_OPTIONS = [
  'songs recorded (rough takes)',
  'songs written (drafts)',
  'recording sessions completed',
  'applications submitted',
  'work sessions completed'
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const formatShortDate = (date) => {
  if (!date) return '—';
  const iso = new Date(`${date}T00:00:00`);
  if (Number.isNaN(iso.getTime())) return 'Invalid date';
  return iso.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const computeDaysUntil = (date) => {
  if (!date) return null;
  const now = new Date();
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / MS_PER_DAY));
};

function buildHorizonFromDeadline(deadline) {
  const days = computeDaysUntil(deadline);
  const safeDays = days && days > 0 ? days : 90;
  return `${safeDays}d`;
}

export default function OnboardingScreen({ onComplete }) {
  const [startDate, setStartDate] = useState('');
  const [goalLabel, setGoalLabel] = useState('');
  const [objectiveType, setObjectiveType] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [definitionOfDone, setDefinitionOfDone] = useState('');
  const [deadline, setDeadline] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('');
  const [minutesPerDay, setMinutesPerDay] = useState('');
  const [timeWindow, setTimeWindow] = useState(TIME_WINDOWS[0]);
  const [primaryDomain, setPrimaryDomain] = useState('');
  const [secondaryDomain, setSecondaryDomain] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [notes, setNotes] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const targetNumber = Number(targetCount);
  const daysNumber = Number(daysPerWeek);
  const minutesNumber = Number(minutesPerDay);
  const trimmedTargetUnit = (targetUnit || '').trim();
  const trimmedDefinition = (definitionOfDone || '').trim();

  const startDateObj = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const deadlineObj = deadline ? new Date(`${deadline}T00:00:00`) : null;
  const windowDays =
    startDateObj && deadlineObj && !Number.isNaN(startDateObj.getTime()) && !Number.isNaN(deadlineObj.getTime())
      ? Math.max(0, Math.round((deadlineObj.getTime() - startDateObj.getTime()) / MS_PER_DAY) + 1)
      : null;
  const invalidWindow = startDateObj && deadlineObj && deadlineObj < startDateObj;
  const minutesPerWeek = daysNumber * minutesNumber;
  const targetLine =
    targetNumber > 0 && trimmedTargetUnit ? `Target: ${targetNumber} ${trimmedTargetUnit}` : 'Target: Not set';
  const planWindowLine =
    startDate && deadline && windowDays !== null
      ? `Plan window: ${formatShortDate(startDate)} → ${formatShortDate(deadline)} (${windowDays} days)`
      : 'Plan window: Not set';
  const minutesLine = `Weekly time: ${minutesPerWeek} minutes`;

  const requirementChecks = useMemo(
    () => [
      { label: 'Objective', satisfied: Boolean(objectiveType) },
      { label: 'Start date', satisfied: Boolean(startDate) },
      { label: 'Deadline', satisfied: Boolean(deadline) },
      { label: 'Capacity', satisfied: daysNumber >= 1 && minutesNumber >= 1 },
      { label: 'Primary domain', satisfied: Boolean(primaryDomain) },
      { label: 'Work mode', satisfied: Boolean(workMode) },
      { label: 'Target count', satisfied: targetNumber > 0 },
      { label: 'Target unit', satisfied: Boolean(trimmedTargetUnit) },
      { label: 'Definition of done', satisfied: Boolean(trimmedDefinition) }
    ],
    [
      objectiveType,
      startDate,
      deadline,
      daysNumber,
      minutesNumber,
      primaryDomain,
      workMode,
      targetNumber,
      trimmedTargetUnit,
      trimmedDefinition
    ]
  );
  const missingFields = requirementChecks.filter((item) => !item.satisfied).map((item) => item.label);
  const contractValid = missingFields.length === 0 && !invalidWindow;
  const showStartError = attemptedSubmit && !startDate;
  const showDeadlineError = attemptedSubmit && !deadline;
  const showWindowError = attemptedSubmit && invalidWindow;
  const showTargetCountError = attemptedSubmit && !(targetNumber > 0);
  const showTargetUnitError = attemptedSubmit && !trimmedTargetUnit;
  const showDefinitionError = attemptedSubmit && !trimmedDefinition;

  const handleObjectiveTypeChange = (value) => {
    setObjectiveType(value);
    setTargetUnit('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    if (!contractValid) return;
    const focusAreas = Array.from(new Set([primaryDomain, secondaryDomain]).values()).filter(Boolean);
    const directionLabel = OBJECTIVE_TYPES.find((option) => option.value === objectiveType)?.label || 'Goal';
    const direction = (goalLabel || directionLabel).trim();
    const goalText = direction;
    const successDefinition = direction || `${targetNumber || 0} ${trimmedTargetUnit}`.trim();
    const contract = {
      label: goalLabel.trim(),
      objectiveType,
      target: {
        count: targetNumber,
        unit: trimmedTargetUnit,
        definitionOfDone: trimmedDefinition
      },
      deadlineISO: deadline ? `${deadline}T23:59:59.000Z` : undefined,
      startDateISO: startDate ? `${startDate}T00:00:00.000Z` : undefined,
      capacity: {
        daysPerWeek: daysNumber,
        minutesPerDay: minutesNumber,
        timeWindow
      },
      domainPrimary: primaryDomain,
      domainSecondary: secondaryDomain || undefined,
      workMode,
      notes: notes.trim(),
      planWindowDays: windowDays || undefined
    };
    onComplete?.({
      goalText,
      direction,
      horizon: buildHorizonFromDeadline(deadline),
      focusAreas,
      successDefinition,
      minimumDaysPerWeek: daysNumber,
      narrative: notes.trim(),
      goalContract: contract
    });
  };

  return (
    <div className="min-h-screen bg-jericho-bg text-jericho-text flex items-center justify-center px-6 py-10">
      <div className="max-w-3xl w-full space-y-6 border border-line/60 rounded-2xl bg-jericho-surface/90 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Jericho System</h1>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Onboarding</p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Goal label (optional)</span>
              <input
                className="w-full rounded-lg border border-line/60 bg-jericho-bg px-3 py-2"
                value={goalLabel}
                onChange={(e) => setGoalLabel(e.target.value)}
                placeholder="e.g., Ship the first draft"
              />
              <p className="text-[11px] text-muted">
                Optional short statement of the goal. Example: Finish the first draft of the album.
              </p>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Objective type</span>
              <select
                className={`w-full rounded-lg border px-3 py-2 ${objectiveType ? 'border-line/60' : 'border-amber-500/80'}`}
                value={objectiveType}
                onChange={(e) => handleObjectiveTypeChange(e.target.value)}
              >
                <option value="">Select objective</option>
                {OBJECTIVE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                Choose how to frame this goal. Example: Create a deliverable.
              </p>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Start date (when you begin)</span>
              <input
                type="date"
                placeholder="MM/DD/YYYY"
                className={`w-full rounded-lg border px-3 py-2 ${startDate ? 'border-line/60' : 'border-amber-500/80'}`}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-[11px] text-muted">
                Your plan starts here. We won’t schedule work before this date. Example: Jan 20.
              </p>
              {showStartError ? <span className="text-[11px] text-amber-600">Start date is required.</span> : null}
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Deadline (when it must be done)</span>
              <input
                type="date"
                placeholder="MM/DD/YYYY"
                className={`w-full rounded-lg border px-3 py-2 ${deadline ? 'border-line/60' : 'border-amber-500/80'}`}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <p className="text-[11px] text-muted">
                This is the final day. We’ll schedule work up to this date. Example: Apr 1.
              </p>
              {showWindowError ? (
                <span className="text-[11px] text-amber-600">Deadline must be after the start date.</span>
              ) : showDeadlineError ? (
                <span className="text-[11px] text-amber-600">Deadline is required.</span>
              ) : null}
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Target count</span>
              <input
                type="number"
                min="1"
                step="1"
                className={`w-full rounded-lg border px-3 py-2 ${targetCount ? 'border-line/60' : 'border-amber-500/80'}`}
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value)}
                placeholder="e.g., 6"
              />
              <p className="text-[11px] text-muted">
                How many units you’re aiming to complete. Example: 6.
              </p>
              {showTargetCountError ? (
                <span className="text-[11px] text-amber-600">Target count is required.</span>
              ) : null}
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Target unit (what you’re counting)</span>
              <select
                className={`w-full rounded-lg border px-3 py-2 ${
                  targetUnit ? 'border-line/60' : 'border-amber-500/80'
                }`}
                value={targetUnit}
                onChange={(e) => setTargetUnit(e.target.value)}
              >
                <option value="">Select unit</option>
                {TARGET_UNIT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                What the number counts. Example: songs recorded (rough takes).
              </p>
              {showTargetUnitError ? (
                <span className="text-[11px] text-amber-600">Target unit is required.</span>
              ) : null}
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Definition of done</span>
              <textarea
                rows={2}
                className="w-full rounded-lg border border-line/60 bg-jericho-bg px-3 py-2"
                value={definitionOfDone}
                onChange={(e) => setDefinitionOfDone(e.target.value)}
                placeholder="Count it when..."
              />
              <p className="text-[11px] text-muted">
                What “done” means in plain terms. Example: 6 songs written + rough recorded.
              </p>
              {showDefinitionError ? (
                <span className="text-[11px] text-amber-600">Definition of done is required.</span>
              ) : null}
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-1">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Preferred time window (optional)</span>
              <select
                className="w-full rounded-lg border border-line/60 px-3 py-2"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
              >
                {TIME_WINDOWS.map((window) => (
                  <option key={window} value={window}>
                    {window}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                Optional time window. Example: Morning sessions work best for me.
              </p>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Days per week (capacity)</span>
              <select
                className={`w-full rounded-lg border px-3 py-2 ${daysNumber ? 'border-line/60' : 'border-amber-500/80'}`}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(e.target.value)}
              >
                <option value="">Choose days</option>
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <option key={day} value={day}>
                    {day} day{day > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                How many days per week you can focus. Example: 5 days.
              </p>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Minutes per day</span>
              <select
                className={`w-full rounded-lg border px-3 py-2 ${minutesNumber ? 'border-line/60' : 'border-amber-500/80'}`}
                value={minutesPerDay}
                onChange={(e) => setMinutesPerDay(e.target.value)}
              >
                <option value="">Choose minutes</option>
                {MINUTES_PER_DAY_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min/day
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                How many focused minutes each selected day. Example: 90 minutes/day.
              </p>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Primary domain</span>
              <select
                className={`w-full rounded-lg border px-3 py-2 ${primaryDomain ? 'border-line/60' : 'border-amber-500/80'}`}
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
              >
                <option value="">Select primary domain</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                Primary focus area for this goal. Example: Creation.
              </p>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Secondary domain (optional)</span>
              <select
                className="w-full rounded-lg border border-line/60 px-3 py-2"
                value={secondaryDomain}
                onChange={(e) => setSecondaryDomain(e.target.value)}
              >
                <option value="">None</option>
                {DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                Optional secondary focus. Example: Focus.
              </p>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Work mode</span>
              <select
                className={`w-full rounded-lg border px-3 py-2 ${workMode ? 'border-line/60' : 'border-amber-500/80'}`}
                value={workMode}
                onChange={(e) => setWorkMode(e.target.value)}
              >
                <option value="">Select work mode</option>
                {WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted">
                How you’ll approach the work. Example: CREATE.
              </p>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-muted">Notes (optional)</span>
              <textarea
                className="w-full rounded-lg border border-line/60 bg-jericho-bg px-3 py-2"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share context or constraints..."
              />
              <p className="text-[11px] text-muted">
                Optional context or constraints. Example: Keep weekends free for rest.
              </p>
            </label>
          </div>
          <div className="rounded-lg border border-line/60 bg-jericho-bg px-4 py-3 text-xs space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Plan preview</p>
            <p>We will generate work sessions based on your available time.</p>
            <p className="text-muted">{targetLine}</p>
            <p className="text-muted">{minutesLine}</p>
            <p className="text-muted">{planWindowLine}</p>
          </div>
          <div className="rounded-lg border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs space-y-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Contract status</p>
            <div className="grid gap-2">
              {requirementChecks.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span aria-hidden="true">{item.satisfied ? '✅' : '⚠'}</span>
                  <span className={`${item.satisfied ? 'text-jericho-text' : 'text-muted'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          {missingFields.length > 0 ? (
            <p className="text-xs text-amber-600">Missing: {missingFields.join(', ')}</p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!contractValid}
              className={`rounded-full border px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-jericho-accent ${
                contractValid
                  ? 'border-jericho-accent text-jericho-accent hover:bg-jericho-accent/10'
                  : 'border-line/60 text-muted cursor-not-allowed'
              }`}
            >
              Enter Control Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
