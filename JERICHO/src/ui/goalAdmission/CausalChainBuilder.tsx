import React from 'react';
import { CausalChain, CausalStep } from '../../domain/goal/GoalExecutionContract';

interface CausalChainBuilderProps {
  causalChain: CausalChain | undefined;
  onCausalChange: (chain: CausalChain) => void;
  isValid: boolean;
}

export default function CausalChainBuilder({
  causalChain,
  onCausalChange,
  isValid,
}: CausalChainBuilderProps) {
  const current = causalChain || {
    steps: [],
    hash: '',
  };

  const addStep = () => {
    const newStep: CausalStep = {
      sequence: (current.steps?.length || 0) + 1,
      description: '',
    };
    onCausalChange({
      ...current,
      steps: [...(current.steps || []), newStep],
    });
  };

  const updateStep = (idx: number, patch: Partial<CausalStep>) => {
    const updated = [...(current.steps || [])];
    updated[idx] = { ...updated[idx], ...patch };
    onCausalChange({
      ...current,
      steps: updated,
    });
  };

  const removeStep = (idx: number) => {
    const updated = (current.steps || [])
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, sequence: i + 1 }));
    onCausalChange({
      ...current,
      steps: updated,
    });
  };

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
          5
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Causal Chain</p>
        {isValid && <span className="text-xs text-green-600">✓</span>}
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-muted">Outline the steps from today to your terminal outcome.</p>

        <div className="space-y-2">
          {(current.steps || []).map((step, idx) => (
            <div key={idx} className="rounded border border-line/40 bg-jericho-surface/50 p-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-muted">Step {step.sequence}</span>
                <input
                  type="text"
                  value={step.description}
                  onChange={(e) => updateStep(idx, { description: e.target.value })}
                  placeholder="What must happen?"
                  className="flex-1 rounded border border-line/40 bg-transparent px-1 py-0.5 text-[11px]"
                />
                <input
                  type="number"
                  value={step.approximateDayOffset || ''}
                  onChange={(e) =>
                    updateStep(idx, { approximateDayOffset: Number(e.target.value) || undefined })
                  }
                  placeholder="Days"
                  className="w-12 rounded border border-line/40 bg-transparent px-1 py-0.5 text-[11px]"
                />
                <button
                  onClick={() => removeStep(idx)}
                  className="text-[10px] text-muted hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addStep}
          className="rounded border border-jericho-accent px-3 py-1 text-[11px] text-jericho-accent hover:bg-jericho-accent/10"
        >
          + Add step
        </button>
      </div>
    </div>
  );
}
