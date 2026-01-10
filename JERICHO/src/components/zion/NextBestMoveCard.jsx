import React from 'react';

export default function NextBestMoveCard({ directive, eligibility, onSelectBlock, onMarkDone, onSchedule }) {
  if (!directive) return null;
  const isEligible = eligibility ? eligibility.allowed !== false : true;
  const isSchedule = directive.type === 'schedule';
  const isExecute = directive.type === 'execute';
  const canSchedule = isEligible && typeof onSchedule === 'function';
  const canSelect = isEligible && typeof onSelectBlock === 'function';
  const canMark = isEligible && typeof onMarkDone === 'function';
  const header = 'Next Best Move (Today)';
  const line = isSchedule
    ? `Schedule ${directive.domain} — ${directive.durationMinutes}m`
    : `Execute ${directive.domain}${directive.title ? `: ${directive.title}` : ''}`;

  return (
    <div className={`rounded-lg border border-line/60 bg-jericho-surface/90 p-3 text-xs space-y-1 ${isEligible ? '' : 'opacity-60'}`}>
      <p className="text-muted font-semibold">{header}</p>
      <p className="text-jericho-text font-semibold">{line}</p>
      {!isEligible && eligibility?.reasons?.length ? (
        <p className="text-muted">Not eligible: {eligibility.reasons.join(' · ')}</p>
      ) : null}
      {directive.rationale?.length ? (
        <ul className="list-disc list-inside text-muted space-y-0.5">
          {directive.rationale.slice(0, 3).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-muted">Done when: {directive.doneWhen}</p>
      <div className="flex gap-2 pt-2 flex-wrap">
        {isSchedule ? (
          <button
            className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
            disabled={!canSchedule}
            onClick={() => onSchedule?.(directive)}
          >
            Add this block
          </button>
        ) : null}
        {isExecute ? (
          <button
            className="rounded-full border border-jericho-accent px-3 py-1 text-jericho-accent hover:bg-jericho-accent/5"
            disabled={!canSelect}
            onClick={() => onSelectBlock?.(directive.blockId)}
          >
            Jump to block details
          </button>
        ) : null}
        <button
          className="rounded-full border border-line/80 px-3 py-1 text-muted hover:border-jericho-accent"
          disabled={!canMark}
          onClick={() => onMarkDone?.()}
        >
          Mark directive done
        </button>
      </div>
    </div>
  );
}
