import React from 'react';
import { TerminalOutcome } from '../../domain/goal/GoalExecutionContract';

interface TerminalOutcomePanelProps {
  outcome: TerminalOutcome | undefined;
  onOutcomeChange: (outcome: TerminalOutcome) => void;
  isValid: boolean;
}

export default function TerminalOutcomePanel({ outcome, onOutcomeChange, isValid }: TerminalOutcomePanelProps) {
  const current = outcome || {
    text: '',
    hash: '',
    verificationCriteria: '',
    isConcrete: false,
  };

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
          1
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Terminal Outcome</p>
        {isValid && <span className="text-xs text-green-600">✓</span>}
      </div>

      <div className="space-y-2">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">What will be achieved?</span>
          <textarea
            value={current.text}
            onChange={(e) =>
              onOutcomeChange({
                ...current,
                text: e.target.value,
              })
            }
            placeholder="Describe the concrete result you will achieve"
            className="w-full h-20 rounded border border-line/60 bg-transparent px-2 py-1 text-sm font-mono"
            minLength={5}
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">How will this be verified at deadline?</span>
          <textarea
            value={current.verificationCriteria}
            onChange={(e) =>
              onOutcomeChange({
                ...current,
                verificationCriteria: e.target.value,
              })
            }
            placeholder="Describe the criteria for confirming success"
            className="w-full h-16 rounded border border-line/60 bg-transparent px-2 py-1 text-sm font-mono"
            minLength={3}
          />
        </label>

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={current.isConcrete}
            onChange={(e) =>
              onOutcomeChange({
                ...current,
                isConcrete: e.target.checked,
              })
            }
          />
          <span>This outcome is concrete and measurable (not aspirational or vague)</span>
        </label>
      </div>
    </div>
  );
}
