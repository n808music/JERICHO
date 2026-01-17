import React, { useEffect, useState } from 'react';
import { traceAction, traceNoop } from '../../dev/uiWiringTrace.ts';

const DOMAIN_ENUM = ['BODY', 'RESOURCES', 'CREATION', 'FOCUS'];

/**
 * Canonical add block bar used across Today/Week/Month/Year.
 * - Today: date is read-only (selected day).
 * - Week: date selectable.
 * - Month/Year: date is selected day, shown read-only.
 */
export default function AddBlockBar({
  surface = 'today',
  dateKey,
  defaultDayKey = '',
  onDateChange,
  onAdd,
  readOnly = false,
  showGoalLink = true,
  deliverables = [],
  criteriaByDeliverable = {},
  strictMode = false
}) {
  const [fallbackDate, setFallbackDate] = useState(dateKey || defaultDayKey);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [domain, setDomain] = useState('CREATION');
  const [title, setTitle] = useState('');
  const [linkToGoal, setLinkToGoal] = useState(true);
  const [isProgress, setIsProgress] = useState(true);
  const [deliverableId, setDeliverableId] = useState('');
  const [criterionId, setCriterionId] = useState('');

  useEffect(() => {
    if (dateKey) {
      setFallbackDate(dateKey);
    }
  }, [dateKey]);

  const handleSubmit = () => {
    const day = dateKey || fallbackDate;
    if (!day) {
      traceNoop('addBlock.submit', 'missing dayKey');
      return;
    }
    traceAction('addBlock.submit', {
      date: day,
      time,
      durationMinutes: duration,
      domain,
      linkToGoal,
      isProgress,
      deliverableId,
      criterionId
    });
    onAdd?.({
      date: day,
      time,
      durationMinutes: duration,
      domain,
      title: title?.trim() || 'Block',
      linkToGoal,
      isProgress,
      deliverableId: isProgress ? (deliverableId || null) : null,
      criterionId: isProgress ? (criterionId || null) : null
    });
  };

  const handleDateChange = (val) => {
    setFallbackDate(val);
    onDateChange?.(val);
  };

  return (
    <div className="rounded-md border border-line/60 bg-jericho-surface px-3 py-2 text-xs space-y-2">
      <p className="text-muted font-semibold">Add block</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          className="rounded border border-line/60 bg-transparent px-2 py-1"
          value={dateKey || fallbackDate}
          onChange={(e) => handleDateChange(e.target.value)}
          disabled={readOnly}
        />
        <input
          type="time"
          className="rounded border border-line/60 bg-transparent px-2 py-1"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={readOnly}
        />
        <input
          type="number"
          className="w-20 rounded border border-line/60 bg-transparent px-2 py-1"
          value={duration}
          min={1}
          onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
          disabled={readOnly}
        />
        <select
          className="rounded border border-line/60 bg-transparent px-2 py-1"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          disabled={readOnly}
        >
          {DOMAIN_ENUM.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <input
          className="rounded border border-line/60 bg-transparent px-2 py-1 flex-1 min-w-[140px]"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title / detail"
          disabled={readOnly}
        />
        <button
          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
          onClick={handleSubmit}
          disabled={readOnly}
        >
          Add
        </button>
      </div>
      {showGoalLink ? (
        <label className="flex items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={linkToGoal}
            onChange={(e) => setLinkToGoal(e.target.checked)}
            disabled={readOnly}
          />
          Link to active goal
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-[11px] text-muted">
        <input
          type="checkbox"
          checked={isProgress}
          onChange={(e) => {
            const next = e.target.checked;
            setIsProgress(next);
            if (!next) {
              setDeliverableId('');
              setCriterionId('');
            }
          }}
          disabled={readOnly}
        />
        Progress block {strictMode ? '(criterion required in Strict Mode)' : ''}
      </label>
      {deliverables.length ? (
        <div className="flex flex-wrap gap-2 items-center text-[11px] text-muted">
          <label className="flex items-center gap-2">
            <span>Deliverable</span>
            <select
              className="rounded border border-line/60 bg-transparent px-2 py-1"
              value={deliverableId}
              onChange={(e) => {
                setDeliverableId(e.target.value);
                setIsProgress(true);
                setCriterionId('');
              }}
              disabled={readOnly || !isProgress}
            >
              <option value="">None</option>
              {deliverables.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title || d.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span>Criterion</span>
            <select
              className="rounded border border-line/60 bg-transparent px-2 py-1"
              value={criterionId}
              onChange={(e) => setCriterionId(e.target.value)}
              disabled={readOnly || !isProgress || !deliverableId}
            >
              <option value="">None</option>
              {(criteriaByDeliverable[deliverableId] || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.text || c.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <p className="text-[11px] text-muted">
        {surface === 'today' ? 'Execution anchor' : 'Planning surface'}: add/delete only; status changes remain in Today.
      </p>
    </div>
  );
}
