import React from 'react';
import { SacrificeDeclaration } from '../../domain/goal/GoalExecutionContract';

interface SacrificeDeclarationPanelProps {
  sacrifice: SacrificeDeclaration | undefined;
  onSacrificeChange: (sacrifice: SacrificeDeclaration) => void;
  isValid: boolean;
}

export default function SacrificeDeclarationPanel({
  sacrifice,
  onSacrificeChange,
  isValid,
}: SacrificeDeclarationPanelProps) {
  const current = sacrifice || {
    whatIsGivenUp: '',
    duration: '',
    quantifiedImpact: '',
    rationale: '',
    hash: '',
  };

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
          3
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Sacrifice Declaration</p>
        {isValid && <span className="text-xs text-green-600">✓</span>}
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-muted">What will you give up, delay, or reduce to commit to this goal?</p>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">What is given up</span>
          <textarea
            value={current.whatIsGivenUp}
            onChange={(e) =>
              onSacrificeChange({
                ...current,
                whatIsGivenUp: e.target.value,
              })
            }
            placeholder="e.g., 'Free time on weekends', 'Social events', 'Sleep'"
            className="w-full h-12 rounded border border-line/60 bg-transparent px-2 py-1 text-sm font-mono"
            minLength={3}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Duration</span>
            <input
              type="text"
              value={current.duration}
              onChange={(e) =>
                onSacrificeChange({
                  ...current,
                  duration: e.target.value,
                })
              }
              placeholder="e.g., '6 weeks', 'until deadline'"
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Quantified impact</span>
            <input
              type="text"
              value={current.quantifiedImpact}
              onChange={(e) =>
                onSacrificeChange({
                  ...current,
                  quantifiedImpact: e.target.value,
                })
              }
              placeholder="e.g., '1 hour/day', '50% of leisure'"
              className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
              minLength={2}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Why is this cost necessary?</span>
          <textarea
            value={current.rationale}
            onChange={(e) =>
              onSacrificeChange({
                ...current,
                rationale: e.target.value,
              })
            }
            placeholder="Explain the link between the sacrifice and your ability to achieve the goal"
            className="w-full h-12 rounded border border-line/60 bg-transparent px-2 py-1 text-sm font-mono"
          />
        </label>
      </div>
    </div>
  );
}
