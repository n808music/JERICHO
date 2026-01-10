import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';

function toMinutes(time = '00:00') {
  if (time.includes('T')) {
    const d = new Date(time);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

export default function TimeBlock({
  id,
  label,
  discipline,
  start,
  end,
  priority,
  state = 'pending',
  chain,
  primaryObjectiveId,
  objectiveId,
  onClick,
  onHover
}) {
  const { beginBlock, completeBlock } = useIdentityStore();
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  const duration = Math.max(30, endMin - startMin);
  const top = (startMin / (24 * 60)) * 100;
  const height = (duration / (24 * 60)) * 100;

  const stateTone =
    state === 'complete'
      ? 'bg-emerald-500/20'
      : state === 'missed'
      ? 'bg-hot/15'
      : 'bg-jericho-bg/30';

  const disciplineColors = {
    Body: '#22c55e',
    Resources: '#60a5fa',
    Creation: '#a78bfa',
    Focus: '#f59e0b',
    default: 'var(--color-jericho-accent, #48d3be)'
  };
  const tint = disciplineColors[discipline] || disciplineColors.default;

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    if (state === 'planned') {
      beginBlock?.(id);
    } else if (state === 'in_progress') {
      completeBlock?.(id);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="absolute left-1 right-1 overflow-hidden text-left group"
      style={{ top: `${top}%`, height: `${height}%` }}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div
        className="h-full w-full px-3 py-2 text-xs text-jericho-text/90 relative"
        style={{
          background: tint + '14',
          borderLeft:
            priority || (primaryObjectiveId && primaryObjectiveId === objectiveId)
              ? '4px solid var(--color-jericho-accent, #48d3be)'
              : undefined
        }}
      >
        <div className={`text-[11px] uppercase tracking-[0.12em] mb-1 ${priority ? 'text-jericho-accent' : 'text-muted'}`}>
          {discipline || 'Block'}
        </div>
        <p className="font-semibold leading-tight">{label}</p>
        <p className="text-[11px] text-muted">{start}–{end}</p>
        {primaryObjectiveId && primaryObjectiveId === objectiveId ? (
          <span className="text-[10px] text-jericho-accent">Primary</span>
        ) : null}
        {chain ? (
          <span className="absolute -left-3 top-1/2 h-[2px] w-3 bg-jericho-accent/80 group-hover:w-5 transition-all" aria-hidden />
        ) : null}
      </div>
      <div className={`absolute inset-0 pointer-events-none ${stateTone}`} aria-hidden />
    </button>
  );
}
