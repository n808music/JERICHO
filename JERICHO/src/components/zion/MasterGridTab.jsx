import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import { phaseGridFromStore } from '../../domain/masterGrid/phaseGridFromStore.js';
import { sortByPhase } from '../../domain/masterGrid/phaseSort.js';
import { selectMasterGridRows, countByClass, CLASS_ORDER } from '../../domain/masterGrid/masterGridSelectors.js';

const PHASE_LABEL = { 1: 'Phase 1', 2: 'Phase 2', 3: 'Phase 3' };
const STATUS_COLOR = { CONFIRMED: '#16a34a', NEEDS_REVIEW: '#ca8a04', DRAFT: '#6b7280' };

// The Master Grid renders one of two SCOPES of the same canonical store (Gate 7):
//   - phase-execution (default): the execution tier as three phase groups (Gate 5).
//   - class rollup: every matrix node across all five classes (original 2026-07-08 view).
// The selector is view-state only — read-only (D2): no matrixDispatch in either scope; a
// row click deep-links via onOpenNode. Both scopes recompute from store.matrix (D1).
export function MasterGridTab({ onOpenNode } = {}) {
  const store = useIdentityStore();
  const [scope, setScope] = React.useState('phase');
  const matrix = store?.matrix || {};

  const tab = (value, label, testid) => (
    <button
      type="button"
      data-testid={testid}
      onClick={() => setScope(value)}
      aria-pressed={scope === value}
      className={`rounded px-3 py-1 border ${
        scope === value ? 'border-jericho-accent text-jericho-accent font-medium' : 'border-line/60 text-muted'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div data-testid="mastergrid-scope-selector" className="flex gap-1 text-xs">
        {tab('phase', 'Phases', 'mastergrid-scope-phase')}
        {tab('class', 'All classes', 'mastergrid-scope-class')}
      </div>

      {scope === 'phase' ? (
        <PhaseScopeView matrix={matrix} onOpenNode={onOpenNode} />
      ) : (
        <ClassScopeView matrix={matrix} onOpenNode={onOpenNode} />
      )}
    </div>
  );
}

// Phase-execution scope: execution tier as three phase groups, within-phase deadline order.
// ★ marks milestone lanes; residual questions render where the census prompts used to be.
function PhaseScopeView({ matrix, onOpenNode }) {
  const { gridTitles, matrix: gridMatrix } = phaseGridFromStore(matrix);
  const r = sortByPhase(gridTitles, gridMatrix);
  const total = [1, 2, 3].reduce((n, ph) => n + r.phases.get(ph).length, 0);

  // Tripwire (2026-07-16): graceful residual bucketing can make a TOTAL ingest failure look
  // like an ordinary to-do list. If EVERY node bucketed residual, surface a distinct warning.
  const residualCount = r.residual?.length || 0;
  const ingestMismatch = total === 0 && residualCount > 0;

  return (
    <div className="space-y-4" data-testid="mastergrid-phasegroups">
      {ingestMismatch && (
        <div data-testid="mastergrid-ingest-warning" className="rounded-lg border border-amber-500/70 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">No phases resolved — every node is residual</div>
          <div className="text-xs">
            All {residualCount} execution nodes bucketed residual. Two causes are possible and they need different
            responses: either the store's phase data isn't being read where the grid expects it (a read mismatch — a
            bug), or these nodes genuinely have no phase attested yet (intake is incomplete — and these are legitimate
            questions to answer). Check whether the store carries phase attestations before treating this as either.
          </div>
        </div>
      )}
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

// Class-rollup scope: every matrix node across all five classes, grouped in canonical class
// order, phase-then-name within a class. Read-only — row click deep-links to the node.
function ClassScopeView({ matrix, onOpenNode }) {
  const rows = selectMasterGridRows(matrix);
  const counts = countByClass(rows);

  return (
    <div className="space-y-4" data-testid="mastergrid-classrollup">
      <div data-testid="mastergrid-class-counts" className="text-sm text-jericho-text font-medium">
        {counts.total} nodes — {counts.Entity} Entity · {counts.Initiative} Initiative · {counts.Project} Project · {counts.Deliverable} Deliverable · {counts.System} System
      </div>

      {CLASS_ORDER.map((cls) => {
        const clsRows = rows.filter((row) => row.primaryClass === cls);
        if (clsRows.length === 0) return null;
        return (
          <div key={cls} data-testid="mastergrid-class-group" className="space-y-1">
            <div className="text-xs uppercase tracking-[0.14em] text-muted">{cls} ({clsRows.length})</div>
            <table className="w-full text-sm">
              <tbody>
                {clsRows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid="mastergrid-class-row"
                    onClick={() => onOpenNode?.(row.intakeTarget)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{row.name}</td>
                    <td className="pl-2 tabular-nums text-muted">{row.phase == null ? '—' : `P${row.phase}`}</td>
                    <td className="pl-2 text-xs" style={{ color: STATUS_COLOR[row.reviewStatus] || '#6b7280' }}>{row.reviewStatus}</td>
                    <td className="pl-2 text-xs text-muted">{row.ownerParentLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export default MasterGridTab;
