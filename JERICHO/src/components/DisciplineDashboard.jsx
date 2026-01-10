import React from 'react';
import { useJericho } from '../core/state.js';

function Dot({ color = 'bg-neutral-500' }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />;
}

export default function DisciplineDashboard() {
  const { state, setUserCondition } = useJericho();
  const { goal, metrics, disciplines = {}, userToday } = state;
  const domains = Object.keys(disciplines);

  return (
    <div className="space-y-6 text-black max-w-[880px] mx-auto">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-neutral-600">Identity Vector — Day 11</p>
        <p className="text-sm font-semibold">Direction: {goal?.title || '—'}</p>
        <p className="text-sm text-neutral-600">Stability: steady · Drift: contained · Momentum: active</p>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-xl font-semibold">{goal?.title || 'Definite goal'}</p>
          <p className="text-base text-neutral-600">Gap: {state.identity?.gaps?.[0] || '—'}</p>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
          {domains.map((domain) => {
            const tile = disciplines[domain]?.Today || {};
            return (
              <div key={domain} className="space-y-1 rounded-md border border-neutral-200 p-4">
                <div className="flex items-center gap-2 text-base">
                  <Dot color="bg-neutral-500" />
                  <span className="font-semibold">{domain}</span>
                </div>
                <div className="text-sm text-neutral-600">{sanitizeMetric(tile.metric) || '—'}</div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <span>Streak: {renderStreak(metrics.streak || 0)}</span>
          <span>Drift: tracked</span>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          {['stable', 'low-energy', 'overwhelmed', 'ahead'].map((opt) => (
            <button
              key={opt}
              onClick={() => setUserCondition(opt)}
              className={`px-3 py-2 h-8 rounded border ${
                userToday?.condition === opt
                  ? 'border-black text-black font-semibold'
                  : 'border-neutral-300 text-neutral-600'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </section>

      {Array.isArray(metrics.riskFlags) && metrics.riskFlags.length ? (
        <section className="space-y-2">
          <ul className="space-y-1 text-sm text-neutral-700">
            {metrics.riskFlags.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function renderStreak(length) {
  const dots = Array.from({ length: 7 }, (_, idx) => (idx < length ? '•' : '○')).join(' ');
  return dots;
}

function sanitizeMetric(metric) {
  if (!metric) return '';
  if (typeof metric === 'string' && metric.includes('%')) return 'tracked';
  return metric;
}
