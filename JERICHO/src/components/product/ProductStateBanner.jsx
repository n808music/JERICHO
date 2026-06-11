import React from 'react';

function formatValue(value) {
  const normalized = String(value || '').trim();
  return normalized || '—';
}

function formatIssue(issue) {
  return String(issue || '')
    .trim()
    .replace(/_/g, ' ')
    .toLowerCase();
}

function buildReadinessIndicators(readinessSummary = {}) {
  const indicators = [
    ['Plan Quality', readinessSummary.planQuality],
    ['Dependency Audit', readinessSummary.dependencyAudit],
    ['Owner Coverage', readinessSummary.ownerCoverage],
    ['Gate Integrity', readinessSummary.gateIntegrity],
    ['Export Status', readinessSummary.exportStatus],
    ['First Executable Date', readinessSummary.firstExecutableDate],
    ['Block Count', readinessSummary.blockCount],
  ];

  return indicators.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '');
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="text-sm text-jericho-text text-right">{formatValue(value)}</dd>
    </div>
  );
}

export default function ProductStateBanner({ resolution }) {
  if (!resolution) {
    return null;
  }

  const readinessSummary = resolution.readinessSummary || {};
  const blockingIssues = Array.isArray(resolution.blockingIssues) ? resolution.blockingIssues.filter(Boolean) : [];
  const readinessIndicators = buildReadinessIndicators(readinessSummary);
  const showActivationReadiness =
    resolution.state === 'PLAN_REVIEW_REQUIRED' || resolution.state === 'READY_TO_ACTIVATE';
  const activationBlockers = showActivationReadiness ? blockingIssues : [];

  return (
    <section
      aria-label="Product state banner"
      className="rounded-xl border border-line/60 bg-jericho-surface/90 px-4 py-4 space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Product State</p>
          <h2 className="text-base font-semibold text-jericho-text">{formatValue(resolution.label)}</h2>
          <p className="text-sm text-muted max-w-3xl">{formatValue(resolution.reason)}</p>
        </div>
        <div className="rounded-full border border-line/70 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-muted">
          {formatValue(resolution.state)}
        </div>
      </div>

      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryRow label="Profile" value={readinessSummary.profile} />
        <SummaryRow label="Goal" value={readinessSummary.goal} />
        <SummaryRow label="Activated Plan" value={readinessSummary.schedule} />
        <SummaryRow label="Phase" value={readinessSummary.phase} />
        <SummaryRow label="Today" value={readinessSummary.today} />
        <SummaryRow label="Next Action" value={resolution.nextAction} />
      </dl>

      {showActivationReadiness ? (
        <div className="space-y-3 rounded-lg border border-line/60 bg-jericho-bg/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Activation Readiness</p>
            <p className="text-xs text-muted">
              {resolution.state === 'READY_TO_ACTIVATE' ? 'Ready to promote into live execution.' : 'Activation is still blocked.'}
            </p>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryRow label="Block Count" value={readinessSummary.blockCount} />
            <SummaryRow label="First Executable Date" value={readinessSummary.firstExecutableDate} />
            <SummaryRow label="Plan Quality" value={readinessSummary.planQuality} />
            <SummaryRow label="Dependency Audit" value={readinessSummary.dependencyAudit} />
            <SummaryRow label="Owner Coverage" value={readinessSummary.ownerCoverage} />
            <SummaryRow label="Gate Integrity" value={readinessSummary.gateIntegrity} />
            {readinessSummary.exportStatus !== undefined ? (
              <SummaryRow label="Export Status" value={readinessSummary.exportStatus} />
            ) : null}
          </dl>

          {activationBlockers.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Activation Blockers</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-jericho-text">
                {activationBlockers.map((issue) => (
                  <li key={issue}>{formatIssue(issue)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : readinessIndicators.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Readiness Indicators</p>
          <div className="flex flex-wrap gap-2">
            {readinessIndicators.map(([label, value]) => (
              <div
                key={label}
                className="rounded-full border border-line/70 bg-jericho-bg/70 px-3 py-1 text-xs text-jericho-text"
              >
                <span className="text-muted">{label}:</span> {formatValue(value)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {blockingIssues.length > 0 && !showActivationReadiness ? (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Blocking Issues</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-jericho-text">
            {blockingIssues.map((issue) => (
              <li key={issue}>{formatIssue(issue)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
