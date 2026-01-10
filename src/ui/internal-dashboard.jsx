import { useEffect, useState } from 'react';
import { fetchDiagnostics } from './api-client.js';

export default function InternalDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const diag = await fetchDiagnostics();
        setData(diag);
      } catch (err) {
        setError(err.message || 'Failed to load diagnostics');
      }
    })();
  }, []);

  if (error) return <div className="panel">Error: {error}</div>;
  if (!data) return <div className="panel">Loading diagnostics…</div>;

  return (
    <div className="internal-dashboard">
      <h1>Internal Diagnostics Dashboard</h1>
      <Section title="Identity State Vector">
        <IdentityTable rows={data.identityState || []} />
      </Section>
      <Section title="Capability Pressure Map">
        <PressureMap rows={data.pressureMap || []} />
      </Section>
      <Section title="Reinforcement Feed + Integrity Curve">
        <ReinforcementFeed rows={data.reinforcementFeed || []} />
        <IntegrityCurve rows={data.integrityCurve || []} />
      </Section>
      <Section title="Task Ladder Selection">
        <TaskLadder info={data.taskLadder || {}} />
      </Section>
      <Section title="Cycle Report Log">
        <CycleReport rows={data.cycleReport || []} />
      </Section>
      <Section title="Jericho 6.0 Intelligence">
        <Jericho6View payload={data.jericho6 || {}} identityHistory={data.identityHistory || []} />
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="panel">
      <div className="panel-title">{title}</div>
      {children}
    </div>
  );
}

function IdentityTable({ rows }) {
  return (
    <table className="diag-table">
      <thead>
        <tr>
          <th>Capability</th>
          <th>Current</th>
          <th>Target</th>
          <th>Gap</th>
          <th>Drift</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.capabilityName}>
            <td>{r.capabilityName}</td>
            <td>{r.currentLevel}</td>
            <td>{r.targetLevel}</td>
            <td>{r.gap}</td>
            <td>{((r.driftRatio || 0) * 100).toFixed(0)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PressureMap({ rows }) {
  return (
    <div className="pressure-map">
      {rows.map((r) => (
        <div key={r.capabilityName} className="pressure-row">
          <div className="pressure-label">{r.capabilityName}</div>
          <div className="pressure-bar">
            <div
              className="pressure-fill"
              style={{ width: `${Math.min(100, (r.pressureScore || 0) * 100)}%` }}
            />
          </div>
          <div className="pressure-value">{((r.pressureScore || 0) * 100).toFixed(0)}%</div>
        </div>
      ))}
    </div>
  );
}

function ReinforcementFeed({ rows }) {
  return (
    <div className="reinforcement-feed">
      <div className="subhead">Last reinforcement events</div>
      <ul>
        {rows.map((r, idx) => (
          <li key={idx}>
            <strong>{r.taskName}</strong> — {r.result} | Δreinforce {r.reinforcementDelta} | Δintegrity{' '}
            {r.integrityDelta ?? 'n/a'}
          </li>
        ))}
      </ul>
    </div>
  );
}

function IntegrityCurve({ rows }) {
  return (
    <div className="integrity-curve">
      <div className="subhead">Integrity curve</div>
      <div className="sparkline">
        {rows.map((p) => (
          <div key={p.cycle} className="spark-point" title={`Cycle ${p.cycle}: ${p.score}%`}>
            <div className="spark-bar" style={{ height: `${Math.min(100, p.score)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskLadder({ info }) {
  const tasks = info.generatedTasks || [];
  return (
    <div className="task-ladder">
      <div>Current integrity: {info.currentIntegrity ?? 0}%</div>
      <div>Selected tier: {info.selectedTier || 'n/a'}</div>
      <div>Reason: {info.reason || ''}</div>
      <div className="subhead">Generated tasks (last cycle)</div>
      <ul>
        {tasks.map((t) => (
          <li key={t.id}>{t.title || t.name || 'Task'}</li>
        ))}
      </ul>
    </div>
  );
}

function CycleReport({ rows }) {
  return (
    <table className="diag-table">
      <thead>
        <tr>
          <th>Cycle</th>
          <th>Generated</th>
          <th>Completed</th>
          <th>Integrity</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx}>
            <td>{r.cycleNumber}</td>
            <td>{r.tasksGenerated}</td>
            <td>{r.tasksCompleted}</td>
            <td>
              {r.integrityBefore ?? '—'} → {r.integrityAfter ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Jericho6View({ payload, identityHistory }) {
  const { pacingMode, forecast, riskLabel, narrative, capabilityArcs, coherence } = payload;
  return (
    <div className="jericho6">
      <div className="subhead">Pacing mode</div>
      <pre className="diag-pre">{JSON.stringify(pacingMode, null, 2)}</pre>
      <div className="subhead">Forecast</div>
      <pre className="diag-pre">{JSON.stringify({ forecast, riskLabel }, null, 2)}</pre>
      <div className="subhead">Narrative</div>
      <pre className="diag-pre">{JSON.stringify(narrative, null, 2)}</pre>
      <div className="subhead">Capability arcs</div>
      <pre className="diag-pre">{JSON.stringify(capabilityArcs, null, 2)}</pre>
      <div className="subhead">Coherence audit</div>
      <pre className="diag-pre">{JSON.stringify(coherence, null, 2)}</pre>
      <div className="subhead">Identity history (recent)</div>
      <pre className="diag-pre">{JSON.stringify(identityHistory, null, 2)}</pre>
    </div>
  );
}
