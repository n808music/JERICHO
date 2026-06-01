import React, { useMemo, useState } from 'react';
import { localStartFromDayAndTime, pad2 } from './timeUtils.js';
import { describeBlockMeaning } from './blockMeaning.js';

/**
 * Shared block details panel.
 * Shows canonical fields and surface-specific actions.
 */
export default function BlockDetailsPanel({
  blockId,
  blocks = [],
  onComplete,
  onMiss,
  onSkip,
  onDelete,
  onEdit,
  onLinkCriterion,
  readOnly = false,
  executionLocked = false,
  executionLockReason = '',
  timeZone = null,
  criterionLabelById = {},
  deliverableLabelById = {},
  lineageBlocks = null,
}) {
  const block = useMemo(() => blocks.find((b) => b.id === blockId), [blocks, blockId]);
  const lineageSource = Array.isArray(lineageBlocks) && lineageBlocks.length > 0 ? lineageBlocks : blocks;
  const lineage = useMemo(
    () =>
      block
        ? describeBlockMeaning(block, lineageSource, {
            deliverableLabelById,
            criterionLabelById,
          })
        : null,
    [block, lineageSource, deliverableLabelById, criterionLabelById]
  );
  const [editing, setEditing] = useState(false);

  const initialDate = block?.start ? block.start.slice(0, 10) : '';
  const initialTime = block?.start ? new Date(block.start) : null;
  const startHours = initialTime ? pad2(initialTime.getHours()) : '09';
  const startMinutes = initialTime ? pad2(initialTime.getMinutes()) : '00';

  const [editDate, setEditDate] = useState(initialDate);
  const [editTime, setEditTime] = useState(`${startHours}:${startMinutes}`);
  const [editDuration, setEditDuration] = useState(() => {
    const end = block?.end ? new Date(block.end) : null;
    return end && initialTime ? Math.max(1, Math.round((end.getTime() - initialTime.getTime()) / 60000)) : 30;
  });
  const [editDomain, setEditDomain] = useState(block?.practice || block?.domain || 'FOCUS');
  const [editTitle, setEditTitle] = useState(block?.label || '');

  React.useEffect(() => {
    setEditDate(initialDate);
    setEditTime(`${startHours}:${startMinutes}`);
    const end = block?.end ? new Date(block.end) : null;
    const newDuration =
      end && initialTime ? Math.max(1, Math.round((end.getTime() - initialTime.getTime()) / 60000)) : 30;
    setEditDuration(newDuration);
    setEditDomain(block?.practice || block?.domain || 'FOCUS');
    setEditTitle(block?.label || '');
    setEditing(false);
  }, [blockId, initialDate, startHours, startMinutes, initialTime, block]);

  if (!block) return null;
  const lockedUntil = block?.lockedUntilDayKey || '';
  const blockDayKey = block?.start ? block.start.slice(0, 10) : '';
  const isLocked = Boolean(lockedUntil && blockDayKey && blockDayKey <= lockedUntil);
  const isProtectedSystemBlock = Boolean(
    block?.requiredSystemBlock || String(block?.origin || '').trim() === 'schedule_active'
  );
  const start = block.start ? new Date(block.start) : null;
  const end = block.end ? new Date(block.end) : null;
  const durationMinutes = start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : 0;
  const formatTime = (d) =>
    d ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}` : '--:--';

  return (
    <div className="rounded-md border border-line/60 bg-jericho-surface px-3 py-2 text-xs space-y-1">
      <p className="text-muted font-semibold">Block details</p>
      <p className="text-jericho-text font-semibold">
        {block.displayTitle || block.label || `${block.practice || block.domain} block`}
      </p>
      <p className="text-muted">
        {block.practice || block.domain} · {block.status}
      </p>
      <p className="text-muted">Date: {block.start ? block.start.slice(0, 10) : '—'}</p>
      <p className="text-muted">
        {formatTime(start)} – {formatTime(end)} ({durationMinutes}m)
      </p>
      {isLocked ? <p className="text-[11px] text-amber-600">Locked until {lockedUntil}</p> : null}
      {isProtectedSystemBlock ? (
        <p className="text-[11px] text-amber-600">Active required block: reschedule instead of deleting.</p>
      ) : null}
      {executionLocked ? (
        <p className="text-[11px] text-amber-600">
          {executionLockReason || 'Execution actions stay disabled until this cycle is activated.'}
        </p>
      ) : null}
      {lineage?.lines?.length ? (
        <div className="space-y-0.5 text-[11px] text-muted">
          {lineage.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {editing ? (
        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap gap-2 text-[11px]">
            <input
              type="date"
              className="rounded border border-line/60 bg-transparent px-2 py-1"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              disabled={readOnly}
            />
            <input
              type="time"
              className="rounded border border-line/60 bg-transparent px-2 py-1"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              disabled={readOnly}
            />
            <input
              type="number"
              className="w-20 rounded border border-line/60 bg-transparent px-2 py-1"
              value={editDuration}
              min={1}
              onChange={(e) => setEditDuration(Math.max(1, Number(e.target.value) || 1))}
              disabled={readOnly}
            />
            <select
              className="rounded border border-line/60 bg-transparent px-2 py-1"
              value={editDomain}
              onChange={(e) => setEditDomain(e.target.value)}
              disabled={readOnly}
            >
              <option value="BODY">Body</option>
              <option value="RESOURCES">Resources</option>
              <option value="CREATION">Creation</option>
              <option value="FOCUS">Focus</option>
            </select>
            <input
              className="rounded border border-line/60 bg-transparent px-2 py-1 flex-1 min-w-[140px]"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title / detail"
              disabled={readOnly}
            />
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
              onClick={() => {
                if (!onEdit) return setEditing(false);
                const startResult = editDate ? localStartFromDayAndTime(editDate, editTime, timeZone) : null;
                const startStr = startResult?.ok ? startResult.startISO : block.start;
                onEdit(block.id, {
                  date: editDate || block.start?.slice(0, 10),
                  start: startStr,
                  durationMinutes: editDuration,
                  domain: editDomain,
                  title: editTitle,
                });
                setEditing(false);
              }}
              disabled={readOnly || isLocked || executionLocked}
            >
              Save
            </button>
            <button className="text-[11px] text-muted hover:text-jericho-accent" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <div className="flex gap-2 pt-1 flex-wrap">
        <button
          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
          onClick={() => onComplete?.(block.id)}
          disabled={readOnly || executionLocked}
        >
          Complete
        </button>
        <button
          className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
          onClick={() => onMiss?.(block.id)}
          disabled={readOnly || executionLocked}
        >
          Missed
        </button>
        <button
          className="rounded-full border border-line/60 px-3 py-1 text-muted hover:text-jericho-accent"
          onClick={() => onSkip?.(block.id)}
          disabled={readOnly || executionLocked}
        >
          Skipped
        </button>
        {block?.criterionId && onLinkCriterion ? (
          <button
            className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:text-jericho-accent"
            onClick={() => onLinkCriterion?.(block, true)}
            disabled={readOnly}
          >
            Close linked criterion
          </button>
        ) : null}
        {onEdit ? (
          <button
            className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
            onClick={() => setEditing(true)}
            disabled={readOnly || isLocked || executionLocked}
          >
            Edit
          </button>
        ) : null}
        <button
          className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
          onClick={() => onDelete?.(block.id)}
          disabled={readOnly || isLocked || isProtectedSystemBlock}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
