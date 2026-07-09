import React from 'react';
import { useIdentityStore } from '../../state/identityStore.js';
import { selectMasterGridRows, countByClass, CLASS_ORDER } from '../../domain/masterGrid/masterGridSelectors.js';

const STATUS_LABEL = { CONFIRMED: 'CONFIRMED', NEEDS_REVIEW: 'NEEDS REVIEW', DRAFT: 'DRAFT' };
const STATUS_COLOR = { CONFIRMED: '#16a34a', NEEDS_REVIEW: '#ca8a04', DRAFT: '#6b7280' };

export function MasterGridTab({ onOpenNode } = {}) {
  const store = useIdentityStore();
  const [classFilter, setClassFilter] = React.useState('ALL');

  const rows = selectMasterGridRows(store?.matrix || {});
  const counts = countByClass(rows);
  const visible = classFilter === 'ALL' ? rows : rows.filter((r) => r.primaryClass === classFilter);

  const countsLine = `${counts.total} nodes — ${counts.Entity} Entities · ${counts.Initiative} Initiatives · ${counts.Project} Projects · ${counts.Deliverable} Deliverables · ${counts.System} Systems`;

  return (
    <div className="space-y-3">
      <div data-testid="mastergrid-counts" className="text-sm text-jericho-text font-medium">{countsLine}</div>
      <div className="flex gap-2 text-xs">
        <button onClick={() => setClassFilter('ALL')} data-active={classFilter === 'ALL'}>All</button>
        {CLASS_ORDER.map((c) => (
          <button key={c} onClick={() => setClassFilter(c)} data-active={classFilter === c}>{c}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th align="left">Name</th><th align="left">Class</th><th align="left">Role-Tags</th>
              <th align="left">Owner / Parent</th><th align="left">Phase</th>
              <th align="left">Status</th><th align="left">Ready?</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={`${r.primaryClass}:${r.id}`} data-testid="mastergrid-row"
                  onClick={() => onOpenNode?.(r.intakeTarget)} style={{ cursor: 'pointer' }}>
                <td>{r.name}</td>
                <td>{r.primaryClass}</td>
                <td>{r.roleTags.join(', ')}</td>
                <td>{r.ownerParentLabel}</td>
                <td>{r.phase ?? ''}</td>
                <td style={{ color: STATUS_COLOR[r.reviewStatus] }}>{STATUS_LABEL[r.reviewStatus]}</td>
                <td>{r.readyForIntake ? 'YES' : 'NO'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MasterGridTab;
