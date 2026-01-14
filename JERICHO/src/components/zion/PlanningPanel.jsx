import React from 'react';

// Dev note: selectedDayKey (activeDayKey) is the single anchor for UI dates; avoid Date.now/new Date for display-critical state.
import AddBlockBar from './AddBlockBar.jsx';
import BlockDetailsPanel from './BlockDetailsPanel.jsx';

export default function PlanningPanel({
  surface = 'today',
  selectedDayKey,
  onSelectedDayKeyChange,
  blocks = [],
  selectedBlockId,
  onSelectBlock,
  onAddBlock,
  onDeleteBlock,
  onComplete,
  onEdit,
  onLinkCriterion,
  metricsSlot = null,
  readOnly = false,
  errorMessage = '',
  timeZone = null,
  deliverables = [],
  criteriaByDeliverable = {},
  whatMovedToday = null,
  strictMode = false,
  criterionLabelById = {}
}) {
  const sorted = [...(blocks || [])].sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0));
  return (
    <div className="space-y-2">
      <AddBlockBar
        surface={surface}
        dateKey={selectedDayKey}
        defaultDayKey={selectedDayKey}
        onDateChange={onSelectedDayKeyChange}
        onAdd={({ date, time, durationMinutes, domain, title, linkToGoal, deliverableId, criterionId }) =>
          onAddBlock?.(date, { time, durationMinutes, domain, title, linkToGoal, deliverableId, criterionId })
        }
        readOnly={readOnly}
        deliverables={deliverables}
        criteriaByDeliverable={criteriaByDeliverable}
        strictMode={strictMode}
      />
      {errorMessage ? (
        <p className="text-[11px] text-amber-600">{errorMessage}</p>
      ) : null}
      <BlockDetailsPanel
        blockId={selectedBlockId}
        blocks={sorted}
        surface={surface}
        onComplete={onComplete}
        onDelete={onDeleteBlock}
        onEdit={onEdit}
        onLinkCriterion={onLinkCriterion}
        criterionLabelById={criterionLabelById}
        timeZone={timeZone}
        readOnly={readOnly}
      />
      {whatMovedToday ? (
        <div className="rounded-md border border-line/60 bg-jericho-surface px-2 py-2 text-xs space-y-2">
          <p className="text-muted font-semibold">What moved today</p>
          {whatMovedToday.criteriaClosed?.length ? (
            <div className="space-y-1">
              <p className="text-[11px] text-muted">Criteria closed ({whatMovedToday.criteriaClosed.length})</p>
              {whatMovedToday.criteriaClosed.map((c) => (
                <div key={c.criterionId} className="text-[11px] text-muted">
                  {c.deliverableTitle} — {c.text}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted">No criteria closed today.</p>
          )}
          {whatMovedToday.deliverablesAdvanced?.length ? (
            <div className="space-y-1">
              <p className="text-[11px] text-muted">Deliverables advanced</p>
              {whatMovedToday.deliverablesAdvanced.map((d) => (
                <div key={d.deliverableId} className="text-[11px] text-muted">
                  {d.deliverableTitle}: +{d.delta} ({d.done}/{d.total})
                </div>
              ))}
            </div>
          ) : null}
          {!whatMovedToday.criteriaClosed?.length && whatMovedToday.nextCriteria?.length ? (
            <div className="space-y-1">
              <p className="text-[11px] text-muted">Next criteria to close</p>
              {whatMovedToday.nextCriteria.map((c) => (
                <div key={c.criterionId} className="text-[11px] text-muted">
                  {c.deliverableTitle} — {c.text}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-md border border-line/60 bg-jericho-surface px-2 py-2 text-xs space-y-1">
        <p className="text-muted font-semibold">Day details — {selectedDayKey || '—'}</p>
        {sorted.map((b) => (
          <button
            key={b.id}
            className={`w-full text-left rounded border px-2 py-1 ${selectedBlockId === b.id ? 'border-jericho-accent' : 'border-line/60'} hover:border-jericho-accent`}
            onClick={() => onSelectBlock?.(b.id)}
            disabled={readOnly}
          >
            <div className="font-semibold">{b.practice || b.domain} · {b.label || 'Block'}</div>
            <div className="text-muted">
              {b.start?.slice(0, 10)} · {formatTimeRange(b.start, b.end)} · {b.status}
            </div>
          </button>
        ))}
        {!sorted.length ? <p className="text-muted">No blocks on this day.</p> : null}
      </div>
      {metricsSlot}
    </div>
  );
}

function formatTimeRange(start, end) {
  const toTime = (v) => {
    if (!v) return '--:--';
    const d = new Date(v);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };
  return `${toTime(start)} – ${toTime(end)}`;
}
