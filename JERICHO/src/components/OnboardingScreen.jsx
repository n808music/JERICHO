import React, { useState } from 'react';

export default function OnboardingScreen({ onComplete }) {
  const [direction, setDirection] = useState('');
  const [horizon, setHorizon] = useState('90d');
  const [narrative, setNarrative] = useState('');
  const [focusAreas, setFocusAreas] = useState(['Creation']);
  const [successDefinition, setSuccessDefinition] = useState('');
  const [minimumDaysPerWeek, setMinimumDaysPerWeek] = useState('');
  const [errors, setErrors] = useState({});

  const toggleFocus = (name) => {
    setFocusAreas((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!direction.trim()) nextErrors.direction = 'Direction is required.';
    if (!focusAreas.length) nextErrors.focusAreas = 'Select at least one focus area.';
    if (!horizon) nextErrors.horizon = 'Select a horizon.';
    if (!successDefinition.trim()) nextErrors.successDefinition = 'Define success.';
    const minDays = Number.parseInt(minimumDaysPerWeek, 10);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onComplete?.({
      direction,
      goalText: direction.trim(),
      horizon,
      narrative,
      focusAreas,
      successDefinition: successDefinition.trim(),
      minimumDaysPerWeek: Number.isFinite(minDays) ? minDays : undefined
    });
  };

  const preview = React.useMemo(() => {
    const daysPerWeek = Number.parseInt(minimumDaysPerWeek, 10);
    const safeDays = Number.isFinite(daysPerWeek) ? daysPerWeek : 4;
    const blocksPerWeek = Math.max(6, Math.min(14, safeDays * 2));
    const primary =
      focusAreas.includes('Creation')
        ? 'Creation'
        : focusAreas.includes('Focus')
        ? 'Focus'
        : focusAreas.includes('Resources')
        ? 'Resources'
        : focusAreas[0] || 'Creation';
    const avgMinutes = focusAreas.includes('Creation') ? 60 : 45;
    return {
      blocksPerWeek,
      totalMinutes: blocksPerWeek * avgMinutes,
      primary
    };
  }, [minimumDaysPerWeek, focusAreas]);

  return (
    <div className="min-h-screen bg-jericho-bg text-jericho-text flex items-center justify-center px-6 py-10">
      <div className="max-w-xl w-full space-y-6 border border-line/60 rounded-2xl bg-jericho-surface/90 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Jericho System</h1>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Onboarding</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Direction (goal)</span>
            <input
              className={`w-full rounded-lg border bg-jericho-bg px-3 py-2 ${errors.direction ? 'border-amber-500/80' : 'border-line/60'}`}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              placeholder="e.g., Grow revenue to $10k/month"
            />
            {errors.direction ? <span className="text-[11px] text-amber-600">{errors.direction}</span> : null}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Horizon</span>
            <select
              className={`w-full rounded-lg border bg-jericho-bg px-3 py-2 ${errors.horizon ? 'border-amber-500/80' : 'border-line/60'}`}
              value={horizon}
              onChange={(e) => setHorizon(e.target.value)}
            >
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="year">1 year</option>
            </select>
            {errors.horizon ? <span className="text-[11px] text-amber-600">{errors.horizon}</span> : null}
          </label>

          <div className="space-y-2 text-sm">
            <span className="text-muted">Focus areas</span>
            <div className="grid grid-cols-2 gap-2">
              {['Body', 'Resources', 'Creation', 'Focus'].map((name) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={focusAreas.includes(name)}
                    onChange={() => toggleFocus(name)}
                  />
                  <span>{name}</span>
                </label>
              ))}
            </div>
            {errors.focusAreas ? <span className="text-[11px] text-amber-600">{errors.focusAreas}</span> : null}
          </div>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Success looks like…</span>
            <input
              className={`w-full rounded-lg border bg-jericho-bg px-3 py-2 ${errors.successDefinition ? 'border-amber-500/80' : 'border-line/60'}`}
              value={successDefinition}
              onChange={(e) => setSuccessDefinition(e.target.value)}
              placeholder="Album mastered + distributed / MVP shipped / $X run-rate"
            />
            {errors.successDefinition ? <span className="text-[11px] text-amber-600">{errors.successDefinition}</span> : null}
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Minimum viable week</span>
            <select
              className={`w-full rounded-lg border bg-jericho-bg px-3 py-2 ${errors.minimumDaysPerWeek ? 'border-amber-500/80' : 'border-line/60'}`}
              value={minimumDaysPerWeek}
              onChange={(e) => setMinimumDaysPerWeek(e.target.value)}
            >
              <option value="">Decide later</option>
              {[3, 4, 5, 6, 7].map((d) => (
                <option key={d} value={d}>
                  {d} days/week
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-muted">Narrative</span>
            <textarea
              className="w-full rounded-lg border border-line/60 bg-jericho-bg px-3 py-2"
              rows={3}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Why this direction matters..."
            />
          </label>

          <div className="rounded-lg border border-line/60 bg-jericho-bg px-4 py-3 text-xs space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Plan preview</p>
            <p>
              We will generate: {preview.blocksPerWeek} blocks/week · {preview.totalMinutes} minutes
            </p>
            <p className="text-muted">Primary focus: {preview.primary}</p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full border border-jericho-accent px-4 py-2 text-sm text-jericho-accent hover:bg-jericho-accent/10"
            >
              Enter Control Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
