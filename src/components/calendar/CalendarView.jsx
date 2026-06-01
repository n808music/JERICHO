import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

function getWeekStart(date) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  const day = next.getDay();
  next.setDate(next.getDate() - (day === 0 ? 6 : day - 1));
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekEnd(weekStart) {
  const next = new Date(weekStart);
  next.setDate(next.getDate() + 6);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isSameDay(dateA, dateB) {
  const first = new Date(dateA);
  const second = new Date(dateB);
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function isToday(dateString) {
  return isSameDay(dateString, new Date());
}

function formatWeekRange(weekStart) {
  const weekEnd = getWeekEnd(weekStart);
  const startStr = weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const endStr = weekEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  return `${startStr} – ${endStr}`;
}

function formatDayHeader(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}

function formatTime(timeString) {
  const [hour, minute] = timeString.split(':').map(Number);
  const period = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return minute === 0 ? `${displayHour}${period}` : `${displayHour}:${String(minute).padStart(2, '0')}${period}`;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes === 60) return '1hr';
  if (minutes % 60 === 0) return `${minutes / 60}hrs`;
  return `${Math.floor(minutes / 60)}hr ${minutes % 60}m`;
}

function getDefaultWeekStart(blockList) {
  if (!blockList.length) {
    return getWeekStart(new Date());
  }

  const today = new Date();
  const thisWeekStart = getWeekStart(today);
  const thisWeekEnd = getWeekEnd(thisWeekStart);
  const hasBlockThisWeek = blockList.some((block) => {
    const blockDate = new Date(block.date);
    return blockDate >= thisWeekStart && blockDate <= thisWeekEnd;
  });

  if (hasBlockThisWeek) {
    return thisWeekStart;
  }

  const firstIncomplete = [...blockList]
    .filter((block) => block.status === 'committed')
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  if (firstIncomplete) {
    return getWeekStart(new Date(firstIncomplete.date));
  }

  const lastBlock = [...blockList]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .at(-1);

  return getWeekStart(new Date(lastBlock.date));
}

export default function CalendarView({ schedulePayload, onComplete }) {
  const [currentState, setCurrentState] = useState(1);
  const [error, setError] = useState(null);

  const [blocks, setBlocks] = useState([]);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState(0);
  const [missedBlocks, setMissedBlocks] = useState(0);

  const [currentWeekStart, setCurrentWeekStart] = useState(null);

  const [blockLoading, setBlockLoading] = useState({});
  const [blockError, setBlockError] = useState({});
  const [missedReasonPrompt, setMissedReasonPrompt] = useState(null);

  const mountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchBlocks();
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const hasCommittedBlocks = blocks.some((block) => block.status === 'committed');

    if (totalBlocks > 0 && !hasCommittedBlocks && onComplete) {
      onComplete({
        goalId: schedulePayload?.goalId,
        cycleId: schedulePayload?.cycleId,
        completedBlocks,
        missedBlocks,
        totalBlocks
      });
    }
  }, [blocks, completedBlocks, missedBlocks, onComplete, schedulePayload?.cycleId, schedulePayload?.goalId, totalBlocks]);

  async function fetchBlocks() {
    setCurrentState(1);
    setError(null);
    setBlockError({});
    setBlockLoading({});
    setMissedReasonPrompt(null);
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      timedOut = true;
      setError('timeout');
      setCurrentState(3);
    }, 10000);

    try {
      const { goalId, cycleId } = schedulePayload || {};
      const response = await fetch(
        `/api/schedule/blocks?goalId=${encodeURIComponent(goalId || '')}&cycleId=${encodeURIComponent(cycleId || '')}`
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok || data.errorCode) {
        throw new Error(data.errorCode || 'SERVER_ERROR');
      }

      if (!mountedRef.current || timedOut) {
        return;
      }

      if (data.blocks.length === 0) {
        setBlocks([]);
        setTotalBlocks(0);
        setCompletedBlocks(0);
        setMissedBlocks(0);
        setCurrentWeekStart(getWeekStart(new Date()));
        setCurrentState(2);
        return;
      }

      setBlocks(data.blocks);
      setTotalBlocks(data.totalBlocks);
      setCompletedBlocks(data.completedBlocks);
      setMissedBlocks(data.missedBlocks);
      setCurrentWeekStart(getDefaultWeekStart(data.blocks));
      setCurrentState(2);
    } catch (error) {
      clearTimeout(timeoutId);

      if (!mountedRef.current) {
        return;
      }

      const nextError =
        error.message === 'timeout' ? 'timeout' : error.message === 'SERVER_ERROR' ? 'SERVER_ERROR' : 'network';
      setError(nextError);
      setCurrentState(3);
    }
  }

  function revertBlock(blockId, previousStatus, optimisticStatus) {
    setBlocks((prev) =>
      prev.map((block) =>
        block.blockId === blockId ? { ...block, status: previousStatus, missedReason: null } : block
      )
    );

    if (optimisticStatus === 'completed') {
      setCompletedBlocks((prev) => Math.max(0, prev - 1));
    }

    if (optimisticStatus === 'missed') {
      setMissedBlocks((prev) => Math.max(0, prev - 1));
    }

    setMissedReasonPrompt((current) => (current === blockId ? null : current));
    setBlockError((prev) => ({
      ...prev,
      [blockId]: 'Could not update. Tap Done or Missed to try again.'
    }));
    setBlockLoading((prev) => ({ ...prev, [blockId]: false }));
  }

  async function handleMarkComplete(blockId) {
    const previousStatus = blocks.find((block) => block.blockId === blockId)?.status;
    if (!previousStatus || previousStatus !== 'committed') {
      return;
    }
    let timedOut = false;

    setMissedReasonPrompt((current) => (current === blockId ? null : current));
    setBlockLoading((prev) => ({ ...prev, [blockId]: true }));
    setBlockError((prev) => ({ ...prev, [blockId]: null }));
    setBlocks((prev) =>
      prev.map((block) => (block.blockId === blockId ? { ...block, status: 'completed', missedReason: null } : block))
    );
    setCompletedBlocks((prev) => prev + 1);

    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      timedOut = true;
      revertBlock(blockId, previousStatus, 'completed');
    }, 10000);

    try {
      const response = await fetch(`/api/schedule/blocks/${encodeURIComponent(blockId)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedAt: new Date().toISOString() })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok || data.errorCode) {
        throw new Error(data.errorCode || 'SERVER_ERROR');
      }

      if (!mountedRef.current || timedOut) {
        return;
      }

      setBlockLoading((prev) => ({ ...prev, [blockId]: false }));
    } catch (error) {
      clearTimeout(timeoutId);

      if (!mountedRef.current) {
        return;
      }

      revertBlock(blockId, previousStatus, 'completed');
    }
  }

  async function handleMarkMissed(blockId, reason = null) {
    const previousStatus = blocks.find((block) => block.blockId === blockId)?.status;
    if (!previousStatus || previousStatus !== 'committed') {
      return;
    }
    let timedOut = false;

    setMissedReasonPrompt(null);
    setBlockLoading((prev) => ({ ...prev, [blockId]: true }));
    setBlockError((prev) => ({ ...prev, [blockId]: null }));
    setBlocks((prev) =>
      prev.map((block) =>
        block.blockId === blockId ? { ...block, status: 'missed', missedReason: reason } : block
      )
    );
    setMissedBlocks((prev) => prev + 1);

    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      timedOut = true;
      revertBlock(blockId, previousStatus, 'missed');
    }, 10000);

    try {
      const response = await fetch(`/api/schedule/blocks/${encodeURIComponent(blockId)}/missed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missedAt: new Date().toISOString(),
          reason
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

      if (!mountedRef.current || timedOut) {
        return;
      }

      setBlockLoading((prev) => ({ ...prev, [blockId]: false }));
    } catch (error) {
      clearTimeout(timeoutId);

      if (!mountedRef.current) {
        return;
      }

      revertBlock(blockId, previousStatus, 'missed');
    }
  }

  if (currentState === 1) {
    return (
      <div className="calendar-container">
        <div className="calendar-loading">
          <p>Loading your schedule...</p>
          <div className="loading-bar">
            <div className="loading-bar-fill"></div>
          </div>
        </div>
      </div>
    );
  }

  if (currentState === 2) {
    if (blocks.length === 0) {
      return (
        <div className="calendar-container">
          <div className="calendar-header">
            <h2 className="calendar-goal-name">{schedulePayload?.goalSubtype}</h2>
          </div>
          <div className="no-sessions-week">
            <p>No scheduled sessions found for this goal.</p>
          </div>
        </div>
      );
    }

    const weekEnd = currentWeekStart ? getWeekEnd(currentWeekStart) : null;
    const weekBlocks = blocks.filter((block) => {
      const blockDate = new Date(block.date);
      return currentWeekStart && blockDate >= currentWeekStart && blockDate <= weekEnd;
    });

    const blocksByDay = {};
    weekBlocks.forEach((block) => {
      const dayKey = new Date(block.date).toDateString();
      if (!blocksByDay[dayKey]) {
        blocksByDay[dayKey] = [];
      }
      blocksByDay[dayKey].push(block);
    });

    const sortedDayKeys = Object.keys(blocksByDay).sort((a, b) => new Date(a) - new Date(b));
    const remainingBlocks = totalBlocks - completedBlocks - missedBlocks;
    const progressPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0;
    const firstBlockDate = blocks.length > 0 ? new Date(Math.min(...blocks.map((block) => new Date(block.date)))) : null;
    const lastBlockDate = blocks.length > 0 ? new Date(Math.max(...blocks.map((block) => new Date(block.date)))) : null;
    const firstBlockWeekStart = firstBlockDate ? getWeekStart(firstBlockDate) : null;
    const lastBlockWeekStart = lastBlockDate ? getWeekStart(lastBlockDate) : null;
    const canGoPrev = firstBlockWeekStart ? currentWeekStart > firstBlockWeekStart : false;
    const canGoNext = lastBlockWeekStart ? currentWeekStart < lastBlockWeekStart : false;

    return (
      <div className="calendar-container">
        <div className="calendar-header">
          <h2 className="calendar-goal-name">{schedulePayload?.goalSubtype}</h2>
          <div className="calendar-meta">
            <span className={`feasibility-badge band-${schedulePayload?.feasibilityBand?.toLowerCase()}`}>
              {schedulePayload?.feasibilityScore} / 100
            </span>
            <span className="calendar-meta-dot">·</span>
            <span className="sessions-remaining">
              {remainingBlocks} session{remainingBlocks !== 1 ? 's' : ''} remaining
            </span>
          </div>
        </div>

        <div className="week-nav">
          <button
            className="week-nav-btn"
            disabled={!canGoPrev}
            onClick={() => {
              const previous = new Date(currentWeekStart);
              previous.setDate(previous.getDate() - 7);
              setCurrentWeekStart(previous);
            }}
          >
            ←
          </button>
          <span className="week-nav-label">Week of {currentWeekStart ? formatWeekRange(currentWeekStart) : '—'}</span>
          <button
            className="week-nav-btn"
            disabled={!canGoNext}
            onClick={() => {
              const next = new Date(currentWeekStart);
              next.setDate(next.getDate() + 7);
              setCurrentWeekStart(next);
            }}
          >
            →
          </button>
        </div>

        {sortedDayKeys.length === 0 ? (
          <div className="no-sessions-week">
            <p>No sessions scheduled this week.</p>
          </div>
        ) : (
          <div className="calendar-days">
            {sortedDayKeys.map((dayKey) => {
              const dayBlocks = blocksByDay[dayKey];
              const currentDay = isToday(dayKey);

              return (
                <div key={dayKey} className={`calendar-day ${currentDay ? 'calendar-day-today' : ''}`}>
                  <h3 className="day-header">
                    {formatDayHeader(dayKey)}
                    {currentDay && <span className="today-badge">Today</span>}
                  </h3>

                  {[...dayBlocks]
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((block) => (
                    <div key={block.blockId} className={`block-card block-${block.status}`}>
                      <div className="block-meta">
                        <span>{formatTime(block.startTime)}</span>
                        <span className="block-dot">·</span>
                        <span>{formatDuration(block.durationMinutes)}</span>
                      </div>
                      <p className="block-action-name">{block.actionName}</p>

                      {block.status === 'committed' && (
                        <div className="block-actions">
                          <button
                            className="btn-done"
                            disabled={blockLoading[block.blockId]}
                            onClick={() => handleMarkComplete(block.blockId)}
                          >
                            {blockLoading[block.blockId] ? '...' : 'Done'}
                          </button>
                          <button
                            className="btn-missed"
                            disabled={blockLoading[block.blockId]}
                            onClick={() => {
                              setBlockError((prev) => ({ ...prev, [block.blockId]: null }));
                              setMissedReasonPrompt(block.blockId);
                            }}
                          >
                            {blockLoading[block.blockId] ? '...' : 'Missed'}
                          </button>
                        </div>
                      )}

                      {missedReasonPrompt === block.blockId && (
                        <div className="missed-reason-prompt">
                          <p className="missed-reason-label">What happened?</p>
                          <div className="missed-reason-options">
                            {[
                              { label: 'No time', value: 'TIME_CONFLICT' },
                              { label: 'Low energy', value: 'LOW_ENERGY' },
                              { label: 'Something came up', value: 'EXTERNAL_FACTOR' },
                              { label: 'Skip reason', value: null }
                            ].map((option) => (
                              <button
                                key={option.label}
                                className="missed-reason-btn"
                                onClick={() => handleMarkMissed(block.blockId, option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {block.status === 'completed' && (
                        <div className="block-status-label status-completed">✓ Completed</div>
                      )}

                      {block.status === 'missed' && (
                        <div className="block-status-label status-missed">✗ Missed</div>
                      )}

                      {blockError[block.blockId] && (
                        <p className="block-error">Could not update. Tap Done or Missed to retry.</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        <div className="calendar-progress">
          <div className="progress-label">
            <span>Progress</span>
            <span>
              {completedBlocks} / {totalBlocks} complete
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (currentState === 3) {
    return (
      <div className="calendar-container">
        <div className="calendar-error">
          <p>Could not load your schedule.</p>
          <button className="retry-btn" onClick={() => fetchBlocks()}>
            Retry
          </button>
          {error && <p className="error-detail">{error}</p>}
        </div>
      </div>
    );
  }

  return null;
}

CalendarView.propTypes = {
  schedulePayload: PropTypes.shape({
    goalId: PropTypes.string,
    cycleId: PropTypes.string,
    traceId: PropTypes.string,
    goalFamily: PropTypes.string,
    goalSubtype: PropTypes.string,
    feasibilityScore: PropTypes.number,
    feasibilityBand: PropTypes.string,
    committedBlocks: PropTypes.number,
    scheduleId: PropTypes.string
  }),
  onComplete: PropTypes.func
};
