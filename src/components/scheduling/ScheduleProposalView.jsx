import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

export default function ScheduleProposalView({
  feasibilityPayload,
  onConfirmed,
  onAdjustFeasibility
}) {
  const [currentState, setCurrentState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [timeOfDay, setTimeOfDay] = useState(null);
  const [pacingPolicy, setPacingPolicy] = useState(null);
  const [adjustFocusField, setAdjustFocusField] = useState(null);
  const [blockedPeriods, setBlockedPeriods] = useState([]);
  const [blockedPeriodInput, setBlockedPeriodInput] = useState({});

  const [proposedBlocks, setProposedBlocks] = useState([]);
  const [unscheduledItems, setUnscheduledItems] = useState([]);
  const [coveragePercent, setCoveragePercent] = useState(null);
  const [proposalSummary, setProposalSummary] = useState(null);
  const [schedulingStatus, setSchedulingStatus] = useState(null);

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const capacityInputs = feasibilityPayload?.capacityInputs || {
    hoursPerWeek: null,
    availableDays: [],
    sessionLengthMinutes: null
  };

  const canGenerate = timeOfDay !== null && pacingPolicy !== null;

  function formatSessionLength(minutes) {
    if (minutes === 30) {
      return '30 min sessions';
    }

    if (minutes === 60) {
      return '1 hour sessions';
    }

    if (minutes === 120) {
      return '2 hour sessions';
    }

    return `${minutes || 0} min sessions`;
  }

  function toLocalMiddayISOString(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
  }

  function handleGenerate() {
    callScheduleAPI();
  }

  async function callScheduleAPI() {
    setLoading(true);
    setError(null);
    setCommitError(null);
    setCurrentState(2);

    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setLoading(false);
      setError('timeout');
      setCurrentState(1);
    }, 10000);

    try {
      const response = await fetch('/api/agent/schedule/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: feasibilityPayload.goalId,
          goalFamily: feasibilityPayload.goalFamily,
          goalSubtype: feasibilityPayload.goalSubtype,
          targetDeadline: feasibilityPayload.targetDeadline,
          deadlineType: feasibilityPayload.deadlineType,
          capacityInputs: {
            hoursPerWeek: feasibilityPayload.capacityInputs.hoursPerWeek,
            availableDays: feasibilityPayload.capacityInputs.availableDays,
            sessionLengthMinutes: feasibilityPayload.capacityInputs.sessionLengthMinutes
          },
          schedulingPreferences: {
            timeOfDay,
            pacingPolicy,
            blockedPeriods
          }
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok || data.errorCode) {
        throw new Error(data.errorCode || 'SERVER_ERROR');
      }

      if (data.schedulingStatus === 'FAILED' || !data.proposedBlocks?.length) {
        throw new Error('NO_PROPOSED_BLOCKS');
      }

      setProposedBlocks(data.proposedBlocks);
      setUnscheduledItems(data.unscheduledItems || []);
      setCoveragePercent(data.coveragePercent);
      setProposalSummary(data.proposalSummary);
      setSchedulingStatus(data.schedulingStatus);
      setLoading(false);
      setCurrentState(3);
    } catch (err) {
      clearTimeout(timeoutId);
      setLoading(false);

      const knownCodes = ['NO_PROPOSED_BLOCKS', 'DEADLINE_NOT_ACHIEVABLE', 'SERVER_ERROR'];
      const errorCode = knownCodes.includes(err.message)
        ? err.message
        : err.message === 'timeout'
          ? 'timeout'
          : 'network';

      setError(errorCode);
      setCurrentState(1);
    }
  }

  function renderError(errorCode) {
    const messages = {
      NO_PROPOSED_BLOCKS:
        'No schedule could be built with your current work windows. Try adjusting your available days or hours.',
      DEADLINE_NOT_ACHIEVABLE:
        'Your deadline cannot be met with the current capacity. Consider extending the deadline or adding more hours.',
      SERVER_ERROR:
        'Something went wrong generating your schedule. Please try again.',
      network:
        'Could not reach the server. Please check your connection and try again.',
      timeout:
        'This is taking longer than expected. Please try again.'
    };

    return (
      <div className="error-message" role="alert">
        <p>{messages[errorCode] || messages.SERVER_ERROR}</p>
        <button
          className="retry-btn"
          onClick={() => {
            setError(null);
            handleGenerate();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  function renderCommitError(errorCode) {
    const messages = {
      COMMIT_BLOCKED:
        'The schedule could not be committed. Please try again.',
      SERVER_ERROR:
        'Something went wrong committing your schedule. Please try again.',
      network:
        'Could not reach the server. Please check your connection and try again.',
      timeout:
        'This is taking longer than expected. Please try again.'
    };

    return (
      <div className="error-message commit-error" role="alert">
        <p>{messages[errorCode] || messages.SERVER_ERROR}</p>
        <button
          className="retry-btn"
          onClick={() => {
            setCommitError(null);
            handleCommit();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  function groupBlocksByWeek(blocks) {
    const weeks = {};

    blocks.forEach((block) => {
      const date = new Date(block.date);
      const day = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
      monday.setHours(0, 0, 0, 0);

      const weekKey = monday.toISOString();
      if (!weeks[weekKey]) {
        weeks[weekKey] = { weekStart: monday, blocks: [] };
      }
      weeks[weekKey].blocks.push(block);
    });

    return Object.values(weeks).sort((a, b) => a.weekStart - b.weekStart);
  }

  function formatBlockDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  function formatWeekHeader(mondayDate) {
    return `Week of ${mondayDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })}`;
  }

  function formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    }

    if (minutes === 60) {
      return '1hr';
    }

    if (minutes % 60 === 0) {
      return `${minutes / 60}hrs`;
    }

    return `${Math.floor(minutes / 60)}hr ${minutes % 60}m`;
  }

  function formatTime(timeString) {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return minute === 0
      ? `${displayHour}${period}`
      : `${displayHour}:${String(minute).padStart(2, '0')}${period}`;
  }

  function handleCommit() {
    commitSchedule();
  }

  async function commitSchedule() {
    setCommitError(null);
    setCommitting(true);
    setCurrentState(5);

    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setCommitting(false);
      setCommitError('timeout');
      setCurrentState(3);
    }, 10000);

    try {
      const response = await fetch('/api/agent/schedule/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: feasibilityPayload.goalId,
          cycleId: feasibilityPayload.cycleId,
          proposedBlocks
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok || data.errorCode) {
        throw new Error(data.errorCode || 'SERVER_ERROR');
      }

      setCommitting(false);

      onConfirmed({
        goalId: feasibilityPayload.goalId,
        cycleId: feasibilityPayload.cycleId,
        traceId: feasibilityPayload.traceId,
        goalFamily: feasibilityPayload.goalFamily,
        goalSubtype: feasibilityPayload.goalSubtype,
        feasibilityScore: feasibilityPayload.feasibilityScore,
        feasibilityBand: feasibilityPayload.feasibilityBand,
        committedBlocks: data.committedBlocks,
        scheduleId: data.scheduleId,
        schedulingStatus,
        coveragePercent,
        capacityInputs: feasibilityPayload.capacityInputs,
        schedulingPreferences: {
          timeOfDay,
          pacingPolicy,
          blockedPeriods
        }
      });
    } catch (err) {
      clearTimeout(timeoutId);
      setCommitting(false);

      const knownCodes = ['COMMIT_BLOCKED', 'SERVER_ERROR'];
      const errorCode = knownCodes.includes(err.message)
        ? err.message
        : err.message === 'timeout'
          ? 'timeout'
          : 'network';

      setCommitError(errorCode);
      setCurrentState(3);
    }
  }

  const shellState = {
    loading,
    setLoading,
    error,
    setError,
    timeOfDay,
    setTimeOfDay,
    pacingPolicy,
    setPacingPolicy,
    adjustFocusField,
    setAdjustFocusField,
    blockedPeriods,
    setBlockedPeriods,
    blockedPeriodInput,
    setBlockedPeriodInput,
    proposedBlocks,
    setProposedBlocks,
    unscheduledItems,
    setUnscheduledItems,
    coveragePercent,
    setCoveragePercent,
    proposalSummary,
    setProposalSummary,
    schedulingStatus,
    setSchedulingStatus,
    committing,
    setCommitting,
    commitError,
    setCommitError,
    mountedRef
  };
  void shellState;

  if (currentState === 1) {
    return (
      <div className="schedule-container">
        <div className="schedule-header">
          <h2>Let's build your schedule.</h2>
          <p className="schedule-goal-context">
            <span className="goal-label">{feasibilityPayload.goalSubtype}</span>
            <span className={`feasibility-badge band-${feasibilityPayload.feasibilityBand?.toLowerCase()}`}>
              {feasibilityPayload.feasibilityScore} / 100
            </span>
          </p>
        </div>

        <div className="prepopulated-summary">
          <p className="prepopulated-label">From your availability settings</p>
          <div className="prepopulated-values">
            <span>{capacityInputs.hoursPerWeek}h per week</span>
            <span>&middot;</span>
            <span>{capacityInputs.availableDays.map((day) => day.slice(0, 3)).join(', ')}</span>
            <span>&middot;</span>
            <span>{formatSessionLength(capacityInputs.sessionLengthMinutes)}</span>
          </div>
          <button className="adjust-link" onClick={onAdjustFeasibility}>
            Change availability settings
          </button>
        </div>

        <div className="schedule-field">
          <label className="schedule-label">When do you prefer to work on this?</label>
          <div className="radio-group">
            {[
              { label: 'Morning (6am – 12pm)', value: 'MORNING' },
              { label: 'Afternoon (12pm – 5pm)', value: 'AFTERNOON' },
              { label: 'Evening (5pm – 9pm)', value: 'EVENING' },
              { label: 'Flexible — schedule around availability', value: 'FLEXIBLE' }
            ].map((opt) => (
              <label key={opt.value} className="radio-option">
                <input
                  type="radio"
                  name="timeOfDay"
                  value={opt.value}
                  checked={timeOfDay === opt.value}
                  onChange={() => {
                    setTimeOfDay(opt.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="schedule-field">
          <label className="schedule-label">How do you want to pace the work?</label>
          <div className="radio-group">
            {[
              {
                label: 'Front-loaded',
                description: 'Heavier early, lighter near the end',
                value: 'FRONT_LOADED'
              },
              {
                label: 'Steady',
                description: 'Even distribution throughout',
                value: 'STEADY'
              },
              {
                label: 'Back-loaded',
                description: 'Lighter early, heavier near deadline',
                value: 'BACK_LOADED'
              }
            ].map((opt) => (
              <label key={opt.value} className="radio-option radio-option-described">
                <input
                  type="radio"
                  name="pacingPolicy"
                  value={opt.value}
                  checked={pacingPolicy === opt.value}
                  onChange={() => {
                    setPacingPolicy(opt.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                />
                <span>
                  <span className="radio-option-label">{opt.label}</span>
                  <span className="radio-option-desc">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="schedule-field">
          <label className="schedule-label">
            Any dates to block out?
            <span className="optional-tag"> (optional)</span>
          </label>

          {blockedPeriods.length > 0 && (
            <div className="blocked-periods-list">
              {blockedPeriods.map((period, index) => (
                <div key={`${period.start}-${period.end}`} className="blocked-period-item">
                  <span>
                    {new Date(period.start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                    {' – '}
                    {new Date(period.end).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <button
                    className="remove-period-btn"
                    onClick={() => {
                      setBlockedPeriods((prev) => prev.filter((_, idx) => idx !== index));
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="blocked-period-inputs">
            <input
              type="date"
              className="date-input"
              min={new Date().toISOString().split('T')[0]}
              value={blockedPeriodInput.start || ''}
              onChange={(e) => {
                setBlockedPeriodInput((prev) => ({
                  ...prev,
                  start: e.target.value
                }));
              }}
              placeholder="Start"
            />
            <span className="date-range-separator">to</span>
            <input
              type="date"
              className="date-input"
              min={blockedPeriodInput.start || new Date().toISOString().split('T')[0]}
              value={blockedPeriodInput.end || ''}
              onChange={(e) => {
                setBlockedPeriodInput((prev) => ({
                  ...prev,
                  end: e.target.value
                }));
              }}
              placeholder="End"
            />
            <button
              className="add-period-btn"
              disabled={!blockedPeriodInput.start || !blockedPeriodInput.end}
              onClick={() => {
                if (!blockedPeriodInput.start || !blockedPeriodInput.end) {
                  return;
                }

                setBlockedPeriods((prev) => [
                  ...prev,
                  {
                    start: toLocalMiddayISOString(blockedPeriodInput.start),
                    end: toLocalMiddayISOString(blockedPeriodInput.end)
                  }
                ]);
                setBlockedPeriodInput({});
              }}
            >
              + Add
            </button>
          </div>
        </div>

        {error && renderError(error)}

        <button className="btn-primary" disabled={!canGenerate} onClick={handleGenerate}>
          Generate my schedule
        </button>
      </div>
    );
  }

  if (currentState === 2) {
    return (
      <div className="schedule-container">
        <div className="schedule-loading">
          <p>Building your schedule...</p>
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  if (currentState === 3) {
    const groupedWeeks = groupBlocksByWeek(proposedBlocks);
    const isPartial = schedulingStatus === 'PARTIAL';
    const coverageColor = coveragePercent >= 90
      ? 'coverage-green'
      : coveragePercent >= 70
        ? 'coverage-yellow'
        : 'coverage-red';

    return (
      <div className="schedule-container">
        <div className="proposal-header">
          <h2>Your proposed schedule</h2>

          <div className="proposal-stats">
            <span>{proposalSummary.totalBlocks} sessions</span>
            <span className="stat-dot">&middot;</span>
            <span>{proposalSummary.totalHours} hours</span>
            <span className="stat-dot">&middot;</span>
            <span className={`coverage-badge ${coverageColor}`}>{coveragePercent}% coverage</span>
          </div>

          <p className="proposal-date-range">
            {formatBlockDate(proposalSummary.firstBlockDate)}
            {' → '}
            {formatBlockDate(proposalSummary.lastBlockDate)}
          </p>

          {isPartial && (
            <div className="partial-warning">
              <p>Some actions could not be scheduled within your work windows. See unscheduled items below.</p>
            </div>
          )}
        </div>

        <div className="proposal-blocks">
          {groupedWeeks.map((week) => (
            <div key={week.weekStart.toISOString()} className="week-group">
              <h3 className="week-header">{formatWeekHeader(week.weekStart)}</h3>
              {week.blocks.map((block) => (
                <div key={block.blockId} className="block-card">
                  <div className="block-meta">
                    <span className="block-date">{formatBlockDate(block.date)}</span>
                    <span className="block-dot">&middot;</span>
                    <span className="block-time">{formatTime(block.startTime)}</span>
                    <span className="block-dot">&middot;</span>
                    <span className="block-duration">{formatDuration(block.durationMinutes)}</span>
                  </div>
                  <p className="block-action-name">{block.actionName}</p>
                </div>
              ))}
            </div>
          ))}
        </div>

        {unscheduledItems.length > 0 && (
          <div className="unscheduled-items">
            <h3 className="section-label">Could not schedule</h3>
            {unscheduledItems.map((item) => (
              <div key={item.actionId} className="unscheduled-item">
                <span className="unscheduled-name">{item.actionName}</span>
                <span className="unscheduled-reason">{item.reason}</span>
              </div>
            ))}
          </div>
        )}

        <div className="confirmation-options">
          <button className="btn-primary" onClick={handleCommit}>
            Commit this schedule
          </button>

          <button
            className="btn-secondary"
            onClick={() => {
              setAdjustFocusField('timeOfDay');
              setCurrentState(4);
            }}
          >
            Adjust my work windows
          </button>

          <button
            className="btn-secondary"
            onClick={() => {
              setAdjustFocusField('pacing');
              setCurrentState(4);
            }}
          >
            Adjust pacing
          </button>

          <button className="btn-ghost" onClick={onAdjustFeasibility}>
            ← Return to feasibility
          </button>
        </div>

        {commitError && renderCommitError(commitError)}
      </div>
    );
  }

  if (currentState === 4) {
    return (
      <div className="schedule-container">
        <div className="schedule-header">
          <h2>Adjust your scheduling preferences</h2>
        </div>

        <div className={`schedule-field ${adjustFocusField === 'timeOfDay' ? 'field-highlighted' : ''}`}>
          <label className="schedule-label">When do you prefer to work on this?</label>
          <div className="radio-group">
            {[
              { label: 'Morning (6am – 12pm)', value: 'MORNING' },
              { label: 'Afternoon (12pm – 5pm)', value: 'AFTERNOON' },
              { label: 'Evening (5pm – 9pm)', value: 'EVENING' },
              { label: 'Flexible — schedule around availability', value: 'FLEXIBLE' }
            ].map((opt) => (
              <label key={opt.value} className="radio-option">
                <input
                  type="radio"
                  name="timeOfDayAdj"
                  value={opt.value}
                  checked={timeOfDay === opt.value}
                  onChange={() => setTimeOfDay(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className={`schedule-field ${adjustFocusField === 'pacing' ? 'field-highlighted' : ''}`}>
          <label className="schedule-label">How do you want to pace the work?</label>
          <div className="radio-group">
            {[
              {
                label: 'Front-loaded',
                description: 'Heavier early, lighter near the end',
                value: 'FRONT_LOADED'
              },
              {
                label: 'Steady',
                description: 'Even distribution throughout',
                value: 'STEADY'
              },
              {
                label: 'Back-loaded',
                description: 'Lighter early, heavier near deadline',
                value: 'BACK_LOADED'
              }
            ].map((opt) => (
              <label key={opt.value} className="radio-option radio-option-described">
                <input
                  type="radio"
                  name="pacingPolicyAdj"
                  value={opt.value}
                  checked={pacingPolicy === opt.value}
                  onChange={() => setPacingPolicy(opt.value)}
                />
                <span>
                  <span className="radio-option-label">{opt.label}</span>
                  <span className="radio-option-desc">{opt.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="schedule-field">
          <label className="schedule-label">
            Blocked periods
            <span className="optional-tag"> (optional)</span>
          </label>

          {blockedPeriods.length > 0 && (
            <div className="blocked-periods-list">
              {blockedPeriods.map((period, index) => (
                <div key={`${period.start}-${period.end}`} className="blocked-period-item">
                  <span>
                    {new Date(period.start).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                    {' – '}
                    {new Date(period.end).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                  <button
                    className="remove-period-btn"
                    onClick={() => {
                      setBlockedPeriods((prev) => prev.filter((_, idx) => idx !== index));
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="blocked-period-inputs">
            <input
              type="date"
              className="date-input"
              min={new Date().toISOString().split('T')[0]}
              value={blockedPeriodInput.start || ''}
              onChange={(e) => {
                setBlockedPeriodInput((prev) => ({
                  ...prev,
                  start: e.target.value
                }));
              }}
            />
            <span className="date-range-separator">to</span>
            <input
              type="date"
              className="date-input"
              min={blockedPeriodInput.start || new Date().toISOString().split('T')[0]}
              value={blockedPeriodInput.end || ''}
              onChange={(e) => {
                setBlockedPeriodInput((prev) => ({
                  ...prev,
                  end: e.target.value
                }));
              }}
            />
            <button
              className="add-period-btn"
              disabled={!blockedPeriodInput.start || !blockedPeriodInput.end}
              onClick={() => {
                if (!blockedPeriodInput.start || !blockedPeriodInput.end) {
                  return;
                }

                setBlockedPeriods((prev) => [
                  ...prev,
                  {
                    start: toLocalMiddayISOString(blockedPeriodInput.start),
                    end: toLocalMiddayISOString(blockedPeriodInput.end)
                  }
                ]);
                setBlockedPeriodInput({});
              }}
            >
              + Add
            </button>
          </div>
        </div>

        <div className="confirmation-options">
          <button
            className="btn-primary"
            disabled={!canGenerate}
            onClick={() => {
              setAdjustFocusField(null);
              callScheduleAPI();
            }}
          >
            Regenerate schedule
          </button>

          <button
            className="btn-secondary"
            onClick={() => {
              setAdjustFocusField(null);
              setCurrentState(3);
            }}
          >
            ← Back to proposal
          </button>
        </div>
      </div>
    );
  }

  if (currentState === 5) {
    return (
      <div className="schedule-container">
        <div className="schedule-loading">
          <p>Committing your schedule...</p>
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

ScheduleProposalView.propTypes = {
  feasibilityPayload: PropTypes.shape({
    goalId: PropTypes.string,
    cycleId: PropTypes.string,
    traceId: PropTypes.string,
    goalFamily: PropTypes.string,
    goalSubtype: PropTypes.string,
    normalizedGoalStatement: PropTypes.string,
    targetDeadline: PropTypes.string,
    deadlineType: PropTypes.string,
    priorityLevel: PropTypes.string,
    feasibilityScore: PropTypes.number,
    feasibilityBand: PropTypes.string,
    acknowledgedRisk: PropTypes.bool,
    capacityInputs: PropTypes.shape({
      hoursPerWeek: PropTypes.number,
      availableDays: PropTypes.arrayOf(PropTypes.string),
      sessionLengthMinutes: PropTypes.number,
      currentLoad: PropTypes.string,
      experienceLevel: PropTypes.string,
      externalDependencies: PropTypes.string
    })
  }),
  onConfirmed: PropTypes.func.isRequired,
  onAdjustFeasibility: PropTypes.func.isRequired
};
