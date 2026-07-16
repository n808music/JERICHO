import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import { phaseGridFromStore } from '../../domain/masterGrid/phaseGridFromStore.js';
import { sortByPhase } from '../../domain/masterGrid/phaseSort.js';

const PHASE_LABEL = { 1: 'Phase 1', 2: 'Phase 2', 3: 'Phase 3' };

// The Master Grid's default view: the execution tier rendered as three phase groups,
// within-phase deadline order. Generated live from the canonical store (D1 — no second
// copy). Read-only (D2 — row click deep-links, never writes). ★ marks milestone lanes;
// residual questions render where the census prompts used to be.
export function MasterGridTab({ onOpenNode } = {}) {
  const store = useIdentityStore();
  const { gridTitles, matrix } = phaseGridFromStore(store?.matrix || {});
  const r = sortByPhase(gridTitles, matrix);
  const total = [1, 2, 3].reduce((n, ph) => n + r.phases.get(ph).length, 0);

  return (
    <div className="space-y-4" data-testid="mastergrid-phasegroups">
      <div data-testid="mastergrid-counts" className="text-sm text-jericho-text font-medium">
        {total} execution nodes — {r.phases.get(1).length} · {r.phases.get(2).length} · {r.phases.get(3).length} across three phases
      </div>

      {[1, 2, 3].map((ph) => (
        <div key={ph} data-testid="mastergrid-phase-group" className="space-y-1">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">{PHASE_LABEL[ph]}</div>
          <table className="w-full text-sm">
            <tbody>
              {r.phases.get(ph).map((p) => (
                <tr
                  key={p.fixtureTitle}
                  data-testid="mastergrid-row"
                  onClick={() => onOpenNode?.({ title: p.fixtureTitle })}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="tabular-nums text-muted pr-3">{p.deadline === '9999-12-31' ? 'TBD' : p.deadline}</td>
                  <td>{p.fixtureTitle}</td>
                  <td className="pl-2">
                    {p.milestones ? (
                      <span data-testid="mastergrid-milestone-star" title={p.milestones.map((m) => `${m.name} (${m.date})`).join(', ')} style={{ color: '#ca8a04' }}>
                        ★
                      </span>
                    ) : null}
                  </td>
                  <td className="pl-2 text-xs text-muted">{p.tieWith ? `↔ ${p.tieWith.join(', ')}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {r.questions.length > 0 && (
        <div data-testid="mastergrid-residual" className="space-y-1 rounded-lg border border-line/60 bg-jericho-surface/90 p-3">
          <div className="text-xs uppercase tracking-[0.14em] text-muted">Residual questions</div>
          {r.questions.map((q, i) => (
            <div key={i} data-testid="mastergrid-residual-q" className="text-xs text-jericho-text">
              [{q.code}] {q.probe}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MasterGridTab;
