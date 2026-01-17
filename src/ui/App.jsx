import { useEffect, useState } from 'react';
import IdentityCapture from './identity-capture.jsx';
import TaskBoard from './task-board.jsx';
import Dashboard from './dashboard.jsx';
import InternalDashboard from './internal-dashboard.jsx';
import {
  fetchHealth,
  fetchPipeline,
  postGoal,
  postIdentity,
  postTaskStatus,
  patchIdentity,
  runCycleNext
} from './api-client.js';
import { buildDefiniteGoalFromCapability } from './goal-utils.js';

function AnalysisStrip({ analysis }) {
  if (!analysis) return null;

  const { systemHealth, forecast, strategicCalendar, cycleGovernance } = analysis || {};
  const healthStatus = systemHealth?.health?.status || 'unknown';
  const mode = cycleGovernance?.mode || 'execute';
  const allowedTasks = cycleGovernance?.allowedTasks ?? null;

  const healthLabel =
    healthStatus === 'green'
      ? 'System health: GREEN'
      : healthStatus === 'yellow'
        ? 'System health: YELLOW'
        : healthStatus === 'red'
          ? 'System health: RED'
          : 'System health: UNKNOWN';

  const modeLabel = `Cycle mode: ${mode.toUpperCase()}`;
  const capLabel = allowedTasks != null ? `Allowed tasks this cycle: ${allowedTasks}` : null;

  const forecastLabel = forecast?.goalForecast
    ? `Forecast: ${forecast.goalForecast.onTrack ? 'On track' : 'Off track'}`
    : null;

  const calendarSummary = strategicCalendar?.summary;
  const scheduleLabel =
    calendarSummary && typeof calendarSummary.averageLoad === 'number'
      ? `Cycles planned: ${calendarSummary.totalCycles}, avg load: ${calendarSummary.averageLoad.toFixed(1)}`
      : null;

  return (
    <div className="analysis-strip pills">
      <div className={`analysis-pill health-${healthStatus}`}>{healthLabel}</div>
      <div className={`analysis-pill mode-${mode}`}>{modeLabel}</div>
      {capLabel && <div className="analysis-pill">{capLabel}</div>}
      {forecastLabel && <div className="analysis-pill">{forecastLabel}</div>}
      {scheduleLabel && <div className="analysis-pill">{scheduleLabel}</div>}
    </div>
  );
}

function GovernanceAdvisories({ analysis }) {
  if (!analysis?.cycleGovernance) return null;
  const advisories = analysis.cycleGovernance.advisories || [];
  if (!advisories.length) return null;

  return (
    <div className="analysis-advisories">
      <div className="advisories-title">Cycle advisories</div>
      <ul>
        {advisories.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
    </div>
  );
}

function tierLabel(tier) {
  if (tier === 'T1') return 'Foundation';
  if (tier === 'T2') return 'Production';
  if (tier === 'T3') return 'Scaling';
  return 'Task';
}

function tierTooltip(tier) {
  if (tier === 'T1') return 'Stabilize your identity and routine.';
  if (tier === 'T2') return 'Produce output tied to your goal.';
  if (tier === 'T3') return 'Scale strategy and experiments.';
  return '';
}

function cycleModeLabel(mode) {
  if (mode === 'reset_identity') return 'Reset identity focus';
  if (mode === 'recovery') return 'Recovery';
  return '';
}

function SimpleWeeklyTimeline({ schedule, tasks = [], integrityScore }) {
  if (!tasks.length) return null;
  const daySlots = schedule?.daySlots || [];
  const days = daySlots.length ? daySlots : Array.from({ length: 7 }, (_, i) => ({ day: `Day ${i + 1}`, slots: [] }));
  const priorityTasks = tasks.filter((t) => t.governanceEligible || t.decision === 'keep' || t.status === 'pending');
  const bandClass =
    integrityScore >= 70 ? 'integrity-strong' : integrityScore >= 40 ? 'integrity-medium' : 'integrity-weak';

  return (
    <div className="timeline">
      <div className="timeline-header">
        <span>Weekly timeline</span>
        <span className={`integrity-band ${bandClass}`}>Integrity {Math.round(integrityScore || 0)}%</span>
      </div>
      <div className="timeline-grid">
        {days.slice(0, 7).map((day, idx) => {
          const dayTasks =
            day.slots?.flatMap((slot) => slot.taskIds || []).map((id) => tasks.find((t) => t.id === id)).filter(Boolean) ||
            [];
          const renderTasks = dayTasks.length ? dayTasks : priorityTasks.slice(idx, idx + 1);
          return (
            <div key={idx} className="timeline-day">
              <div className="timeline-day-label">{day.day || `Day ${idx + 1}`}</div>
              {renderTasks.length ? (
                renderTasks.map((t) => (
                  <div key={t.id} className="timeline-task">
                    <span className="timeline-task-title">{t.title || 'Task'}</span>
                    <span className="timeline-task-meta">
                      {tierLabel(t.tier)} · ~{t.effortMinutes || 60}m
                    </span>
                  </div>
                ))
              ) : (
                <div className="timeline-task empty">No task</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DriftMeter({ requirements = [], identity = {} }) {
  if (!requirements.length) return null;
  const rows = requirements.map((req) => {
    const current = identity?.[req.domain]?.[req.capability]?.level || 0;
    const target = req.targetLevel || 0;
    const ratio = target > 0 ? Math.min(1, current / target) : 0;
    return { ...req, current, target, ratio };
  });
  return (
    <div className="drift-meter">
      <div className="drift-header">Identity drift</div>
      {rows.map((row) => (
        <div key={`${row.domain}.${row.capability}`} className="drift-row">
          <div className="drift-label">
            {row.domain}.{row.capability}
          </div>
          <div className="drift-bar">
            <div className="drift-fill" style={{ width: `${row.ratio * 100}%` }} />
          </div>
          <div className="drift-meta">
            {row.current}/{row.target}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProjectionPanel({ integrityScore }) {
  let text = 'Normal progression';
  if (integrityScore > 80) text = 'Projected acceleration (high integrity)';
  else if (integrityScore < 40) text = 'Projected delays (integrity low)';
  return (
    <div className="projection">
      <div className="projection-title">Outcome projection</div>
      <div className="projection-body">{text}</div>
    </div>
  );
}

function ReinforcementTuning({ value, onChange }) {
  return (
    <div className="reinforcement">
      <div className="reinforcement-title">Reinforcement style</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="strict">Strict (+10% weighting)</option>
        <option value="balanced">Balanced (baseline)</option>
        <option value="supportive">Supportive (-10% weighting)</option>
      </select>
    </div>
  );
}

function TeamAlignmentPreview({ requirements = [] }) {
  const roles = ['Vision', 'Execution', 'Support'];
  const capList = requirements.slice(0, 3).map((r) => `${r.domain}.${r.capability}`);
  return (
    <div className="team-alignment">
      <div className="team-title">Team Alignment Mode</div>
      <div className="team-roles">
        {roles.map((role) => (
          <div key={role} className="team-role">
            <div className="team-role-name">{role}</div>
            <div className="team-capability-preview">
              {capList.length ? capList.join(', ') : 'Assign capabilities (preview)'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdvisorPanel({ requirements = [], tasks = [] }) {
  const topReq = requirements[0];
  const suggestedCap = topReq ? `${topReq.domain}.${topReq.capability}` : 'execution.execution';
  const microTask = tasks.find((t) => t.tier === 'T1') || tasks[0];
  const driftInsight = topReq ? `Identity gap on ${topReq.domain}.${topReq.capability}` : 'Identity gaps pending.';
  return (
    <div className="advisor">
      <div className="advisor-title">Advisor Panel</div>
      <div className="advisor-row">Suggested capability: {suggestedCap}</div>
      <div className="advisor-row">
        Micro-task: {microTask ? microTask.title : 'Complete one foundation action'}
      </div>
      <div className="advisor-row">Insight: {driftInsight}</div>
    </div>
  );
}

function TaskColumn({ title, tasks, variant, onUpdateTaskStatus }) {
  const sorted = [...tasks].sort((a, b) => {
    const tierWeight = (t) => (t === 'T1' ? 1 : t === 'T2' ? 2 : t === 'T3' ? 3 : 4);
    return tierWeight(a.tier) - tierWeight(b.tier);
  });

  const tierBuckets = sorted.reduce((acc, task) => {
    const key = task.tier || 'other';
    acc[key] = acc[key] || [];
    acc[key].push(task);
    return acc;
  }, {});

  return (
    <div className={`gov-column gov-${variant}`}>
      <div className="gov-column-header">
        <span className="gov-column-title">{title}</span>
        <span className="gov-column-count">{sorted.length}</span>
      </div>
      <div className="gov-column-body">
        {Object.keys(tierBuckets).map((tierKey) => (
          <div key={tierKey} className="tier-group">
            <div className="tier-header">
              <span className="tier-badge" title={tierTooltip(tierKey)}>
                {tierLabel(tierKey)}
              </span>
            </div>
            {tierBuckets[tierKey].map((task) => (
              <div key={task.id} className="gov-task-card">
                <div className="gov-task-main">
                  <div className="gov-task-title">{task.title || task.name || 'Task'}</div>
                  <div className="gov-task-meta">
                    <span className={`domain-pill domain-${task.domainStatus}`}>
                      {(task.domain || 'Unknown')} · {task.domainStatus}
                    </span>
                    <span className="tier-pill" title={tierTooltip(task.tier)}>
                      {tierLabel(task.tier)}
                    </span>
                    {task.effortMinutes ? (
                      <span className="effort-pill">{`~${task.effortMinutes} min`}</span>
                    ) : null}
                    {task.cycleMode && task.cycleMode !== 'normal' ? (
                      <span className="mode-pill">{cycleModeLabel(task.cycleMode)}</span>
                    ) : null}
                  </div>
                </div>
                {task.explanations && (
                  <div className="gov-task-explain">
                    {task.explanations.headline && (
                      <div className="gov-task-headline">{task.explanations.headline}</div>
                    )}
                    {task.explanations.details && task.explanations.details.length > 0 && (
                      <ul className="gov-task-details">
                        {task.explanations.details.map((line, idx) => (
                          <li key={idx}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="task-actions">
                  <button
                    className="task-btn-complete"
                    onClick={() => onUpdateTaskStatus(task.id, 'completed')}
                  >
                    Done
                  </button>
                  <button className="task-btn-miss" onClick={() => onUpdateTaskStatus(task.id, 'missed')}>
                    Missed
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function GovernanceTaskBoard({ taskBoard, onUpdateTaskStatus }) {
  if (!taskBoard) return null;

  const tasks = taskBoard.tasks || [];
  const eligible = tasks.filter((t) => t.decision === 'keep' && t.governanceEligible);
  const overflow = tasks.filter((t) => t.decision === 'keep' && !t.governanceEligible);
  const deferred = tasks.filter((t) => t.decision === 'defer');
  const summary = taskBoard.summary || {};
  const { allowedTasks, eligibleCount, keptCount, deferredCount } = summary;

  return (
    <div className="governance-board">
      <div className="governance-board-header">
        <div className="governance-metric">
          <span className="label">This cycle load</span>
          <span className="value">
            {eligibleCount ?? 0}
            {typeof allowedTasks === 'number' ? ` / ${allowedTasks}` : ''}
          </span>
        </div>
        <div className="governance-metric">
          <span className="label">Kept tasks</span>
          <span className="value">{keptCount ?? 0}</span>
        </div>
        <div className="governance-metric">
          <span className="label">Deferred</span>
          <span className="value">{deferredCount ?? 0}</span>
        </div>
      </div>

      <div className="governance-columns">
        <TaskColumn
          title="This cycle (active)"
          tasks={eligible}
          variant="active"
          onUpdateTaskStatus={onUpdateTaskStatus}
        />
        <TaskColumn
          title="This cycle (overflow)"
          tasks={overflow}
          variant="overflow"
          onUpdateTaskStatus={onUpdateTaskStatus}
        />
        <TaskColumn
          title="Later / deferred"
          tasks={deferred}
          variant="deferred"
          onUpdateTaskStatus={onUpdateTaskStatus}
        />
      </div>
    </div>
  );
}

export default function App() {
  const isInternal = typeof window !== 'undefined' && window.location.pathname === '/internal';
  const [state, setState] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [taskBoard, setTaskBoard] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [reinforcementStyle, setReinforcementStyle] = useState('balanced');
  const [goalText, setGoalText] = useState('');
  const [goalError, setGoalError] = useState(null);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [identityDraft, setIdentityDraft] = useState({});
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [identityError, setIdentityError] = useState(null);
  const [isRunningNextCycle, setIsRunningNextCycle] = useState(false);
  const [cycleError, setCycleError] = useState(null);
  const [taskError, setTaskError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiAvailable, setApiAvailable] = useState(false);

  const extractIdentityDraft = (identityObj = {}) => {
    const draft = {};
    Object.entries(identityObj || {}).forEach(([domain, caps]) => {
      if (caps && typeof caps === 'object') {
        Object.entries(caps).forEach(([cap, data]) => {
          const level = typeof data === 'object' && data !== null ? data.level : data;
          draft[`${domain}.${cap}`] = Number(level) || 1;
        });
      }
    });
    return draft;
  };

  const errorMessage = (code, reason) => {
    switch (code) {
      case 'INVALID_GOAL':
      case 'INVALID_DEFINITE_GOAL':
        return 'Goal must include a number, a clear time limit, and be 20–280 characters.';
      case 'BAD_JSON':
        return 'Something went wrong sending your data. Try again.';
      case 'BAD_STATE':
        return 'System state is corrupted. Please reset (dev) or contact support.';
      case 'INVALID_IDENTITY':
        return 'Identity update requires domain, capability, and a numeric level.';
      case 'INVALID_IDENTITY_LEVEL':
        return 'Identity level must be between 0 and 10.';
      case 'INVALID_TASK':
        return 'Task update requires a task id and valid status.';
      case 'INVALID_TASK_STATUS':
        return 'Task status must be pending, completed, or missed.';
      case 'WRITE_FAILED':
      case 'PIPELINE_ERROR':
        return 'Internal error while saving. Try again; if it persists, report this.';
      default:
        return reason || 'Request failed.';
    }
  };

  const validateGoalClient = (text) => {
    const trimmed = (text || '').trim();
    const errors = [];
    if (!trimmed) errors.push('Goal text is required.');
    if (trimmed.length < 20) errors.push('Goal must be at least 20 characters.');
    if (trimmed.length > 280) errors.push('Goal must be at most 280 characters.');
    if (!/\d/.test(trimmed)) errors.push('Goal must include a number for measurability.');
    const hasDate =
      /\b\d{4}-\d{2}-\d{2}\b/.test(trimmed) || /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(trimmed);
    const hasMonthYear =
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{4}\b/i.test(
        trimmed
      );
    const hasRelative =
      /\bby\b\s+(next\s+\w+|the\s+end\s+of\s+q[1-4]|q[1-4]|\d+\s+\w+)/i.test(trimmed) ||
      /\bwithin\s+\d+\s+(days?|weeks?|months?|years?)\b/i.test(trimmed);
    if (!hasDate && !hasMonthYear && !hasRelative) {
      errors.push('Goal must include a clear time limit (date, month+year, or timeframe).');
    }
    return errors;
  };

  const validateIdentityClient = (level) => {
    const num = Number(level);
    if (!Number.isFinite(num)) return 'Level must be numeric.';
    if (num < 0 || num > 10) return 'Level must be between 0 and 10.';
    return null;
  };

  const validateTaskStatusClient = (status) => {
    return ['pending', 'completed', 'missed'].includes(status);
  };

  const loadPipeline = async () => {
    try {
      const data = await fetchPipeline();
      setPipeline(data.pipeline || data);
      setAnalysis(data.pipeline?.analysis || null);
      setTaskBoard(data.pipeline?.taskBoard || null);
      setState(data.state || null);
      if (data.state?.identity) {
        setIdentityDraft(extractIdentityDraft(data.state.identity));
      }
      setError(null);
    } catch (err) {
      setError('Unable to reach API');
      setApiAvailable(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await fetchHealth();
        if (!active) return;
        setApiAvailable(true);
        if (!active) return;
        await loadPipeline();
      } catch (err) {
        if (!active) return;
        setApiAvailable(false);
        setError('Unable to reach API');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleGoalSubmit(goal) {
    if (!apiAvailable) {
      setError('API unavailable; changes are local only');
      return;
    }
    setError(null);

    // Two goal shapes exist in the UI:
    // 1) Definite goal text (from the main goal input) => payload.text
    // 2) Capability/domain row from IdentityCapture (domain, capability, targetLevel)
    // For (2) we synthesize a definite-goal string that passes backend validation
    // while preserving the user-selected domain/capability metadata.
    const isCapabilityGoal = goal && !goal.text && goal.domain && goal.capability;
    const payload = isCapabilityGoal
      ? { text: buildDefiniteGoalFromCapability(goal), domain: goal.domain, capability: goal.capability }
      : goal;

    try {
      const response = await postGoal(payload);
      const pl = response.pipeline;
      const st = response.state;

      if (pl || st) {
        setPipeline(pl);
        setAnalysis(pl?.analysis || null);
        setTaskBoard(pl?.taskBoard || null);
        setState(st);
      } else {
        // If the API returns only {goals: [...]}, refresh the pipeline/state explicitly.
        await loadPipeline();
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleIdentityUpdate(domain, capability, level) {
    if (!apiAvailable) {
      setError('API unavailable; changes are local only');
      return;
    }
    setError(null);
    try {
      const { pipeline: pl, state: st } = await postIdentity({ domain, capability, level });
      setPipeline(pl);
      setAnalysis(pl?.analysis || null);
      setTaskBoard(pl?.taskBoard || null);
      setState(st);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleTaskToggle(taskId, status) {
    if (!apiAvailable) {
      setError('API unavailable; changes are local only');
      return;
    }
    setError(null);
    try {
      const { pipeline: pl, state: st } = await postTaskStatus({ id: taskId, status });
      setPipeline(pl);
      setAnalysis(pl?.analysis || null);
      setTaskBoard(pl?.taskBoard || null);
      setState(st);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveGoal() {
    const localErrors = validateGoalClient(goalText);
    if (localErrors.length) {
      setGoalError(localErrors.join(' '));
      return;
    }
    setIsSavingGoal(true);
    try {
      await postGoal({ text: goalText.trim() });
      const cycle = await runCycleNext();
      const pipelineResult = cycle.pipeline;
      const stateResult = cycle.state;
      setGoalText('');
      setGoalError(null);
      if (pipelineResult) {
        setPipeline(pipelineResult);
        setAnalysis(pipelineResult.analysis || null);
        setTaskBoard(pipelineResult.taskBoard || null);
      }
      if (stateResult?.identity) {
        setIdentityDraft(extractIdentityDraft(stateResult.identity));
      }
    } catch (err) {
      console.error('Goal save failed', err);
      setGoalError(errorMessage(err.code, err.message));
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function saveIdentityDraft() {
    setIsSavingIdentity(true);
    setIdentityError(null);
    for (const level of Object.values(identityDraft || {})) {
      const err = validateIdentityClient(level);
      if (err) {
        setIdentityError(err);
        setIsSavingIdentity(false);
        return;
      }
    }
    try {
      await patchIdentity(identityDraft);
      await loadPipeline();
    } catch (err) {
      console.error('Identity update failed', err);
      setIdentityError(errorMessage(err.code, err.message));
    } finally {
      setIsSavingIdentity(false);
    }
  }

  async function runNextCycle() {
    setIsRunningNextCycle(true);
    setCycleError(null);
    try {
      await runCycleNext();
      await loadPipeline();
    } catch (err) {
      console.error('Cycle advance failed', err);
      setCycleError(errorMessage(err.code, err.message));
    } finally {
      setIsRunningNextCycle(false);
    }
  }

  async function updateTaskStatus(taskId, status) {
    setTaskError(null);
    if (!validateTaskStatusClient(status)) {
      setTaskError('Invalid task status.');
      return;
    }
    try {
      await postTaskStatus({ taskId, status });
      await loadPipeline();
    } catch (err) {
      console.error('Failed to update task status', err);
      setTaskError(errorMessage(err.code, err.message));
    }
  }

  const dashboardSummary = {
    integrity: pipeline?.integrity?.score || 0,
    tasksPending: pipeline?.integrity?.pendingCount ?? 0,
    tasksDone: pipeline?.integrity?.completedCount ?? 0,
    syncReady: pipeline?.syncPayload?.length || 0
  };

  const integrity = pipeline?.integrity;
  const requirements = pipeline?.requirements || [];
  const currentIdentity = state?.identity || {};
  const tasks = taskBoard?.tasks || [];

  if (isInternal) {
    return (
      <div className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Jericho System</p>
            <h1>Internal Diagnostics</h1>
            <p className="lede">Read-only view of engine state for debugging and explanation.</p>
          </div>
        </header>
        <InternalDashboard />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Jericho System</p>
          <h1>Closed-loop behavioral execution</h1>
          <p className="lede">
            Capture identity, surface capability gaps, and drive tasks with integrity scoring.
          </p>
        </div>
        <Dashboard summary={dashboardSummary} />
      </header>

      {error && <div className="alert">{error}</div>}
      {loading && <div className="alert subtle">Loading pipeline...</div>}

      <AnalysisStrip analysis={analysis} />
      <GovernanceAdvisories analysis={analysis} />
      <GovernanceTaskBoard taskBoard={taskBoard} onUpdateTaskStatus={updateTaskStatus} />
      <SimpleWeeklyTimeline schedule={pipeline?.schedule} tasks={tasks} integrityScore={dashboardSummary.integrity} />
      <div className="layout-row">
        <DriftMeter requirements={requirements} identity={currentIdentity} />
        <ProjectionPanel integrityScore={dashboardSummary.integrity} />
        <ReinforcementTuning value={reinforcementStyle} onChange={setReinforcementStyle} />
      </div>
      <div className="layout-row">
        <TeamAlignmentPreview requirements={requirements} />
        <AdvisorPanel requirements={requirements} tasks={tasks} />
      </div>

      <div className="cycle-controls">
        <button className="cycle-next-button" onClick={runNextCycle} disabled={isRunningNextCycle}>
          {isRunningNextCycle ? 'Updating…' : 'Run next cycle'}
        </button>
        {cycleError && <span className="cycle-error">{cycleError}</span>}
        {taskError && <span className="cycle-error">{taskError}</span>}
      </div>

      <section className="today-panel">
        <h3 className="today-heading">Today</h3>
        {pipeline?.schedule?.todayPriorityTaskId ? (
          <>
            <div className="today-main-task">
              <span className="today-label">Priority task:</span>
              <span className="today-title">
                {taskBoard?.tasks?.find((t) => t.id === pipeline.schedule.todayPriorityTaskId)?.title ||
                  'Task'}
              </span>
            </div>
            <div className="today-meta">
              <span>Overflow tasks: {pipeline.schedule.overflowTasks?.length || 0}</span>
              <span>Integrity: {Math.round(pipeline?.integrity?.score || 0)}%</span>
            </div>
          </>
        ) : (
          <div className="today-empty">No priority task scheduled for today yet.</div>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Definite goal</p>
        <input
          type="text"
          className="goal-input"
          placeholder='e.g. "Grow revenue to $10k/month by 2026-06-01"'
          value={goalText}
          onChange={(e) => {
            setGoalText(e.target.value);
            if (goalError) setGoalError(null);
          }}
        />
        <button className="goal-save-button" onClick={saveGoal} disabled={isSavingGoal}>
          {isSavingGoal ? 'Saving…' : 'Save goal & refresh'}
        </button>
        {goalError && <div className="goal-error">{goalError}</div>}
      </section>

      <section className="panel">
        <p className="eyebrow">Identity levels</p>
        <div className="identity-list">
          {Object.entries(identityDraft).map(([capId, level]) => (
            <div key={capId} className="identity-row">
              <span className="identity-label">{capId}</span>
              <input
                className="identity-input"
                type="number"
                min={1}
                max={10}
                value={level}
                onChange={(e) => {
                  const next = Math.max(1, Math.min(10, Number(e.target.value) || 1));
                  setIdentityDraft((prev) => ({ ...prev, [capId]: next }));
                }}
              />
            </div>
          ))}
        </div>
        <button className="identity-save-button" onClick={saveIdentityDraft} disabled={isSavingIdentity}>
          {isSavingIdentity ? 'Saving…' : 'Save identity & recompute'}
        </button>
        {identityError && <div className="identity-error">{identityError}</div>}
      </section>

      <main className="grid">
        <section className="panel">
          <IdentityCapture
            requirements={pipeline?.requirements || []}
            onAddGoal={handleGoalSubmit}
            onUpdateIdentity={handleIdentityUpdate}
          />
        </section>

        <section className="panel wide">
          <TaskBoard
            tasks={taskBoard?.tasks || []}
            integrityScore={dashboardSummary.integrity}
            onTaskAction={handleTaskToggle}
          />
        </section>
      </main>
    </div>
  );
}
