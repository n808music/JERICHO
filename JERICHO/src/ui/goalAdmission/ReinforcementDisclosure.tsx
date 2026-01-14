import React from 'react';
import { ReinforcementDisclosure as ReinforcementType } from '../../domain/goal/GoalExecutionContract';

interface ReinforcementDisclosureProps {
  reinforcement: ReinforcementType | undefined;
  onReinforcementChange: (reinforcement: ReinforcementType) => void;
  isValid: boolean;
}

export default function ReinforcementDisclosure({
  reinforcement,
  onReinforcementChange,
  isValid,
}: ReinforcementDisclosureProps) {
  const current = reinforcement || {
    dailyExposureEnabled: true, // Non-negotiable
    dailyMechanism: '',
    checkInFrequency: 'DAILY',
    triggerDescription: '',
  };

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
          6
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Reinforcement Disclosure</p>
        {isValid && <span className="text-xs text-green-600">✓</span>}
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-muted">How will this goal remain visible in your daily life?</p>

        <div className="rounded border border-amber-600/40 bg-amber-50 p-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={current.dailyExposureEnabled}
              disabled
              className="mt-0.5"
            />
            <div>
              <p className="font-semibold text-amber-900">Daily visibility is required (cannot be disabled)</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Your goal will appear in your calendar and dashboard every day until completion or deadline.
              </p>
            </div>
          </label>
        </div>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">How will you see this daily?</span>
          <input
            type="text"
            value={current.dailyMechanism || ''}
            onChange={(e) =>
              onReinforcementChange({
                ...current,
                dailyMechanism: e.target.value,
              })
            }
            placeholder="e.g., 'Calendar block title', 'Dashboard banner', 'Morning notification'"
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">Check-in frequency</span>
          <select
            value={current.checkInFrequency}
            onChange={(e) =>
              onReinforcementChange({
                ...current,
                checkInFrequency: e.target.value as 'DAILY' | 'WEEKLY' | 'ON_PROGRESS',
              })
            }
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1"
          >
            <option value="DAILY">Every day</option>
            <option value="WEEKLY">Weekly</option>
            <option value="ON_PROGRESS">On progress events</option>
          </select>
        </label>

        <label className="block">
          <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">When does this trigger?</span>
          <input
            type="text"
            value={current.triggerDescription}
            onChange={(e) =>
              onReinforcementChange({
                ...current,
                triggerDescription: e.target.value,
              })
            }
            placeholder="e.g., 'Every morning at 6 AM', 'When I complete a related block'"
            className="w-full rounded border border-line/60 bg-transparent px-2 py-1 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
