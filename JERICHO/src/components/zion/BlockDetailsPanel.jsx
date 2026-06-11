import React, { useMemo, useState } from 'react';
import { localStartFromDayAndTime, pad2 } from './timeUtils.js';
import { describeBlockMeaning } from './blockMeaning.js';
import { resolveOperatingHierarchyDisplay } from '../../domain/product/resolveOperatingHierarchyDisplay.js';
import { resolveBlockPlainLanguage } from '../../domain/product/resolveBlockPlainLanguage.js';
import { projectEnterpriseDisplay } from '../../domain/enterprise/enterpriseDisplayProjection';

/**
 * Shared block details panel.
 * Shows canonical fields and surface-specific actions.
 */
export default function BlockDetailsPanel({
  blockId,
  blocks = [],
  onComplete,
  onMiss,
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
  hierarchyContext = null,
  enterpriseContext = null,
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
  const hierarchy = useMemo(
    () =>
      block
        ? resolveOperatingHierarchyDisplay({
            block,
            masterPlan: hierarchyContext?.masterPlan,
            activatedPlan: hierarchyContext?.activatedPlan,
            phase: hierarchyContext?.phase,
            operatingCycle: hierarchyContext?.operatingCycle,
            sprint: hierarchyContext?.sprint,
            lane: hierarchyContext?.lane,
            initiative: hierarchyContext?.initiative,
            milestoneType: hierarchyContext?.milestoneType,
          })
        : null,
    [block, hierarchyContext]
  );
  const enterprise = useMemo(() => {
    if (!block) return null;
    const laneId = block.laneId || block.domain || (hierarchyContext?.lane || '');
    if (!laneId) return null;
    return projectEnterpriseDisplay({
      laneId,
      laneLabel: hierarchyContext?.lane || laneId,
      intakeSignals: enterpriseContext?.intakeSignals || { goalText: '', declaredLaneIds: [] },
    });
  }, [block, hierarchyContext, enterpriseContext]);
  const plainLanguage = useMemo(() => {
    if (!block || !hierarchy) {
      return null;
    }
    return resolveBlockPlainLanguage(block, { hierarchy });
  }, [block, hierarchy]);
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
  }, [blockId, initialDate, startHours, startMinutes, block?.start, block?.end, block?.practice, block?.domain, block?.label]);

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
  const hierarchyTrail = hierarchy
    ? [hierarchy.masterPlan, hierarchy.phase, hierarchy.operatingCycle, hierarchy.sprint, hierarchy.lane, hierarchy.initiative].filter(
        (value, index, values) => Boolean(value) && (index === 0 || value !== values[index - 1])
      )
    : [];

  return (
    <div className="rounded-md border border-line/60 bg-jericho-surface px-3 py-2 text-xs space-y-1">
      <p className="text-muted font-semibold">Block details</p>
      {enterprise && enterprise.displayName ? (
        <div className="rounded-md border border-line/40 bg-jericho-bg/70 px-2 py-2 text-[11px] space-y-1">
          <p className="text-muted font-semibold">Enterprise</p>
          <p className="text-muted">
            <span className="font-semibold text-jericho-text">{enterprise.displayName}</span>
            {enterprise.displaySubtitle ? ` — ${enterprise.displaySubtitle}` : ''}
          </p>
          <p className="text-muted">
            Phase scope: {enterprise.phaseScope} · Status: {enterprise.priorityStatus} · Provenance: {enterprise.provenanceStatus}
          </p>
          {enterprise.warnings && enterprise.warnings.length > 0 && enterprise.companyCategory === 'Real Estate' ? (
            <p className="text-amber-700">{enterprise.warnings[0]}</p>
          ) : null}
        </div>
      ) : null}
      {hierarchy ? (
        <div className="rounded-md border border-line/40 bg-jericho-bg/70 px-2 py-2 text-[11px] space-y-1">
          <p className="text-muted font-semibold">Hierarchy</p>
          {hierarchyTrail.length ? <p className="text-muted">{hierarchyTrail.join(' → ')}</p> : null}
          <p className="text-muted">
            <span className="font-semibold text-jericho-text">Block:</span> {hierarchy.block}
          </p>
          {hierarchy.milestoneType ? (
            <p className="text-muted">
              <span className="font-semibold text-jericho-text">Milestone type:</span> {hierarchy.milestoneType}
            </p>
          ) : null}
        </div>
      ) : null}
      {plainLanguage ? (
        <div className="rounded-md border border-line/40 bg-jericho-bg/70 px-2 py-2 text-[11px] space-y-2">
          <div className="grid gap-1 sm:grid-cols-2">
            <p className="text-muted">
              <span className="font-semibold text-jericho-text">Lane:</span> {plainLanguage.laneLabel || 'Missing'}
            </p>
            <p className="text-muted">
              <span className="font-semibold text-jericho-text">Work type:</span> {plainLanguage.workType || 'Unspecified'}
            </p>
          </div>
          {plainLanguage.quality?.status === 'under_specified' ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/5 px-2 py-2 space-y-1">
              <p className="font-semibold text-amber-700">Plan quality failed for this block detail</p>
              <p className="text-amber-700">
                This block is still under-specified. Jericho should not treat this breakdown as execution-ready.
              </p>
              {plainLanguage.quality?.failureCodes?.length ? (
                <p className="text-amber-700">
                  {plainLanguage.quality.failureCodes.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="text-muted font-semibold">What this means</p>
            <p className="text-muted">{plainLanguage.intent}</p>
          </div>
          {plainLanguage.whyThisExists ? (
            <div className="space-y-1">
              <p className="text-muted font-semibold">Why this block exists</p>
              <p className="text-muted">{plainLanguage.whyThisExists}</p>
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="text-muted font-semibold">Do this</p>
            {plainLanguage.plainAction ? <p className="text-muted">{plainLanguage.plainAction}</p> : null}
            {plainLanguage.steps.map((step) => (
              <p key={step} className="text-muted">
                - {step}
              </p>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-muted font-semibold">Done when</p>
            <p className="text-muted">{plainLanguage.doneWhen}</p>
          </div>
          <div className="grid gap-1 sm:grid-cols-2">
            <p className="text-muted">
              <span className="font-semibold text-jericho-text">Produces:</span> {plainLanguage.expectedOutput}
            </p>
            {plainLanguage.acceptanceEvidence ? (
              <p className="text-muted">
                <span className="font-semibold text-jericho-text">Acceptance evidence:</span>{' '}
                {plainLanguage.acceptanceEvidence}
              </p>
            ) : null}
          </div>
          {(plainLanguage.dependencies?.requires?.length || plainLanguage.dependencies?.unlocks?.length) ? (
            <div className="grid gap-1 sm:grid-cols-2">
              {plainLanguage.dependencies?.requires?.length ? (
                <p className="text-muted">
                  <span className="font-semibold text-jericho-text">Requires:</span>{' '}
                  {plainLanguage.dependencies.requires.join(', ')}
                </p>
              ) : null}
              {plainLanguage.dependencies?.unlocks?.length ? (
                <p className="text-muted">
                  <span className="font-semibold text-jericho-text">Unlocks:</span>{' '}
                  {plainLanguage.dependencies.unlocks.join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-1 sm:grid-cols-2">
            {plainLanguage.originalWindow || plainLanguage.currentWindow ? (
              <p className="text-muted">
                <span className="font-semibold text-jericho-text">Window:</span>{' '}
                {plainLanguage.originalWindow && plainLanguage.currentWindow && plainLanguage.originalWindow !== plainLanguage.currentWindow
                  ? `Original ${plainLanguage.originalWindow} · Current ${plainLanguage.currentWindow}`
                  : plainLanguage.currentWindow || plainLanguage.originalWindow}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <p className="text-muted">
        <span className="font-semibold text-jericho-text">Formal title:</span>{' '}
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
          {executionLockReason || 'Execution actions stay disabled until this Operating Cycle is activated.'}
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
          onClick={() => setEditing(true)}
          disabled={readOnly || executionLocked || isLocked || !onEdit}
        >
          Reschedule
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
