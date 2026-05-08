import type { EntropySummary, CourseCorrection, CorrectionOption } from './courseCorrection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrectionView {
  activeCorrections: CourseCorrection[];
  hasCritical: boolean;
  hasSignificant: boolean;
}

export interface DailyCheckInAlerts {
  section2Alerts: CourseCorrection[];
  overridesSection3: boolean;
  primarySection3Action: string | null;
}

// ---------------------------------------------------------------------------
// buildCorrectionView
// ---------------------------------------------------------------------------

export function buildCorrectionView(summary: EntropySummary): CorrectionView {
  const active = summary.activeCorrections;
  return {
    activeCorrections: active,
    hasCritical: active.some((c) => c.severity === 'critical'),
    hasSignificant: active.some((c) => c.severity === 'significant' || c.severity === 'critical'),
  };
}

// ---------------------------------------------------------------------------
// selectCorrectionOption
// ---------------------------------------------------------------------------

export function selectCorrectionOption(
  correction: CourseCorrection,
  optionId: string,
  asOfISO: string
): CourseCorrection {
  const option = correction.options.find((o: CorrectionOption) => o.optionId === optionId);
  if (!option) return correction;
  return {
    ...correction,
    selectedOption: optionId,
    status: 'active' as const,
  };
}

// ---------------------------------------------------------------------------
// checkDailyCheckInAlerts
// ---------------------------------------------------------------------------

export function checkDailyCheckInAlerts(summary: EntropySummary): DailyCheckInAlerts {
  const active = summary.activeCorrections;

  // Significant and critical corrections become Section 2 alerts and override Section 3
  const overriding = active.filter(
    (c) => c.severity === 'significant' || c.severity === 'critical'
  );
  // Minor and moderate appear as caution signals without overriding
  const cautionary = active.filter(
    (c) => c.severity === 'minor' || c.severity === 'moderate'
  );

  const section2Alerts = [...overriding, ...cautionary];
  const overridesSection3 = overriding.length > 0;

  const primarySection3Action = overridesSection3
    ? (overriding[0].options.find((o: CorrectionOption) => o.recommended)?.action ??
       overriding[0].diagnosis)
    : null;

  return { section2Alerts, overridesSection3, primarySection3Action };
}
