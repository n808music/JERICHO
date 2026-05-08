import React from 'react';

function SectionCard({ title, children }) {
  return (
    <section className="rounded-xl border border-line/60 bg-jericho-surface/90 px-4 py-3 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</p>
      {children}
    </section>
  );
}

export default function DailyCheckInPanel({ view }) {
  if (!view || !Array.isArray(view.sections) || view.sections.length === 0) {
    return null;
  }

  const [whereYouAre, signals, todaysAction, prompt] = view.sections;

  return (
    <div className="space-y-3" data-testid="daily-check-in-panel">
      {Array.isArray(view.gapRecap) && view.gapRecap.length > 0 ? (
        <SectionCard title="Gap Recap">
          <div className="space-y-1 text-sm text-jericho-text">
            {view.gapRecap.map((event, index) => (
              <p key={`${event.kind}-${index}`}>{event.message}</p>
            ))}
          </div>
          {Array.isArray(view.reengagementOptions) && view.reengagementOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {view.reengagementOptions.map((option) => (
                <span
                  key={option}
                  className="rounded-full border border-line/60 px-3 py-1 text-[11px] font-semibold text-muted"
                >
                  {option}
                </span>
              ))}
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      <SectionCard title={whereYouAre.title}>
        <div className="space-y-1 text-sm text-jericho-text">
          {whereYouAre.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={signals.title}>
        <div className="space-y-1 text-sm text-jericho-text">
          {signals.signals.map((signal) => (
            <p key={signal}>{signal}</p>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={todaysAction.title}>
        <div className="space-y-1 text-sm text-jericho-text">
          <p className="font-semibold">{todaysAction.primary}</p>
          <p>{todaysAction.why}</p>
          <p>Time: {todaysAction.time}.</p>
          <p>{todaysAction.unlocks}</p>
          {todaysAction.secondary ? <p>{todaysAction.secondary}</p> : null}
        </div>
      </SectionCard>

      <SectionCard title={prompt.title}>
        <div className="space-y-2 text-sm text-jericho-text">
          <p>{prompt.prompt}</p>
          <div className="space-y-2">
            {prompt.fields.map((field) => (
              <label key={field.id} className="block space-y-1">
                <span className="text-[11px] text-muted">{field.label}</span>
                {field.kind === 'boolean' ? (
                  <select className="w-full rounded-md border border-line/60 bg-white px-2 py-2 text-sm" defaultValue="">
                    <option value="" disabled>
                      Select
                    </option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                ) : field.kind === 'number' ? (
                  <input className="w-full rounded-md border border-line/60 bg-white px-2 py-2 text-sm" type="number" />
                ) : (
                  <input className="w-full rounded-md border border-line/60 bg-white px-2 py-2 text-sm" type="text" />
                )}
              </label>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

