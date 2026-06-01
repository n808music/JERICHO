import React from 'react';

function formatDateLabel(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 'TBD';
  }
  return text.slice(0, 10);
}

function buildRecommendationDescription(summary, recommendation) {
  const requiredBlockCount = Number(summary?.requiredBlockCount || 0);
  const scheduledBlockCount = Number(summary?.scheduledBlockCount || 0);
  const unscheduledBlockCount = Number(summary?.unscheduledBlockCount || 0);
  if (!recommendation) {
    return null;
  }
  if (recommendation.kind === 'EXTEND_HORIZON') {
    return {
      title: `Add ${Number(recommendation.extensionWeeks || 0)} weeks to fit all ${requiredBlockCount} blocks`,
      detail: `Earliest completion: ${formatDateLabel(recommendation.earliestFeasibleCompletionDate)}`,
    };
  }
  if (recommendation.kind === 'REDUCE_CYCLE_COUNT') {
    const removedCycles = Array.isArray(recommendation.removedCycles) ? recommendation.removedCycles.join(', ') : '';
    return {
      title: `Reduce from ${Number(recommendation.currentCycleCount || 0)} to ${Number(recommendation.recommendedCycleCount || 0)} cycles`,
      detail: `Removes cycles ${removedCycles || 'none'} - ${Math.max(0, scheduledBlockCount - unscheduledBlockCount)} blocks fit`,
    };
  }
  if (recommendation.kind === 'ACCEPT_PARTIAL_PLAN') {
    return {
      title: `Commit ${scheduledBlockCount} of ${requiredBlockCount} blocks now`,
      detail: `Scheduled through ${formatDateLabel(recommendation.scheduledThroughDate)} - ${unscheduledBlockCount} blocks left unscheduled`,
    };
  }
  return null;
}

export default function HorizonResolutionPanel({
  summary = null,
  selectedKind = null,
  onSelect = null,
  className = '',
}) {
  const normalizedPlanStatus = String(summary?.planStatus || '')
    .trim()
    .toUpperCase();
  if (normalizedPlanStatus !== 'VALID_BUT_HORIZON_INSUFFICIENT') {
    return null;
  }
  const recommendations = Array.isArray(summary?.recommendations) ? summary.recommendations : [];
  const orderedKinds = ['EXTEND_HORIZON', 'REDUCE_CYCLE_COUNT', 'ACCEPT_PARTIAL_PLAN'];
  const orderedRecommendations = orderedKinds
    .map((kind) =>
      recommendations.find(
        (recommendation) =>
          String(recommendation?.kind || '')
            .trim()
            .toUpperCase() === kind
      )
    )
    .filter(Boolean);

  if (orderedRecommendations.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        {orderedRecommendations.map((recommendation) => {
          const kind = String(recommendation?.kind || '')
            .trim()
            .toUpperCase();
          const description = buildRecommendationDescription(summary, recommendation);
          const isSelected = String(selectedKind || '')
            .trim()
            .toUpperCase() === kind;
          return (
            <div
              key={kind}
              className={`rounded-lg border p-3 ${
                isSelected ? 'border-jericho-accent bg-jericho-accent/5' : 'border-line/60 bg-jericho-surface/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">{kind.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-medium text-jericho-text">{description?.title}</p>
                  <p className="text-xs text-muted">{description?.detail}</p>
                </div>
                <button
                  type="button"
                  className={`rounded border px-3 py-1 text-[11px] ${
                    isSelected
                      ? 'border-jericho-accent text-jericho-accent'
                      : 'border-line/60 text-muted hover:text-jericho-accent'
                  }`}
                  onClick={() => onSelect?.(kind)}
                >
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
