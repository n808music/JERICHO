import { useMemo, useState } from 'react';

export default function IdentityCapture({ requirements, onAddGoal, onUpdateIdentity }) {
  const [goalForm, setGoalForm] = useState({
    domain: 'focus',
    capability: '',
    targetLevel: 3,
    rationale: '',
    customDomain: ''
  });
  const [goalError, setGoalError] = useState(null);
  const [identityForm, setIdentityForm] = useState({
    domain: '',
    capability: '',
    level: 3
  });

  const domains = useMemo(() => {
    const fromRequirements = Array.from(new Set((requirements || []).map((req) => req.domain))).filter(Boolean);
    const defaults = ['execution', 'focus', 'discipline', 'planning'];
    return fromRequirements.length ? fromRequirements : defaults;
  }, [requirements]);

  function submitGoal(e) {
    e.preventDefault();
    const chosenDomain = goalForm.domain === 'custom' ? goalForm.customDomain.trim() : goalForm.domain;
    if (!goalForm.capability) {
      setGoalError('Capability is required.');
      return;
    }
    if (!chosenDomain) {
      setGoalError('Select or enter a domain to continue.');
      return;
    }
    setGoalError(null);
    onAddGoal({
      domain: chosenDomain,
      capability: goalForm.capability,
      targetLevel: Number(goalForm.targetLevel),
      rationale: goalForm.rationale || 'User submitted'
    });
    setGoalForm({ domain: chosenDomain, capability: '', targetLevel: 3, rationale: '', customDomain: '' });
  }

  function submitIdentity(e) {
    e.preventDefault();
    if (!identityForm.domain || !identityForm.capability) return;
    onUpdateIdentity(identityForm.domain, identityForm.capability, Number(identityForm.level));
  }

  return (
    <div className="stack">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Identity capture</p>
          <h2>Requirements + current evidence</h2>
        </div>
      </div>

      <div className="requirements">
        {(requirements || []).map((req) => (
          <article key={`${req.domain}-${req.capability}`} className="req-card">
            <div className="req-top">
              <div>
                <p className="eyebrow">{req.domain}</p>
                <h3>{req.capability}</h3>
                <p className="small">{req.rationale}</p>
              </div>
              <div className="pill">Target {req.targetLevel}</div>
            </div>
            <div className="meter">
              <div
                className="meter-fill"
                style={{ width: `${Math.min((req.currentLevel / req.targetLevel) * 100, 100)}%` }}
              />
            </div>
            <p className="small">
              Current {req.currentLevel || 0} / Target {req.targetLevel}
            </p>
          </article>
        ))}
      </div>

      <div className="forms">
        <form className="card form" onSubmit={submitGoal}>
          <p className="eyebrow">Add goal</p>
          <div className="field-grid">
            <label>
              Domain
              <select
                value={goalForm.domain}
                onChange={(e) => setGoalForm((f) => ({ ...f, domain: e.target.value }))}
              >
                {domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
                <option value="custom">+ New domain</option>
              </select>
            </label>
            {goalForm.domain === 'custom' && (
              <label>
                Custom domain
                <input
                  value={goalForm.customDomain}
                  placeholder="e.g., execution"
                  onChange={(e) => setGoalForm((f) => ({ ...f, customDomain: e.target.value }))}
                />
              </label>
            )}
            <label>
              Capability
              <input
                value={goalForm.capability}
                placeholder="e.g., sleep-hygiene"
                onChange={(e) => setGoalForm((f) => ({ ...f, capability: e.target.value }))}
              />
            </label>
            <label>
              Target level
              <input
                type="number"
                min="1"
                max="5"
                value={goalForm.targetLevel}
                onChange={(e) => setGoalForm((f) => ({ ...f, targetLevel: e.target.value }))}
              />
            </label>
            <label>
              Rationale
              <input
                value={goalForm.rationale}
                placeholder="Why this capability matters"
                onChange={(e) => setGoalForm((f) => ({ ...f, rationale: e.target.value }))}
              />
            </label>
          </div>
          {goalError && <div className="form-error">{goalError}</div>}
          <button type="submit" className="cta">
            Add to pipeline
          </button>
        </form>

        <form className="card form" onSubmit={submitIdentity}>
          <p className="eyebrow">Update identity evidence</p>
          <div className="field-grid">
            <label>
              Domain
              <select
                value={identityForm.domain}
                onChange={(e) => setIdentityForm((f) => ({ ...f, domain: e.target.value }))}
              >
                <option value="">Select</option>
                {domains.map((domain) => (
                  <option key={domain}>{domain}</option>
                ))}
              </select>
            </label>
            <label>
              Capability
              <input
                value={identityForm.capability}
                placeholder="e.g., deep-work"
                onChange={(e) => setIdentityForm((f) => ({ ...f, capability: e.target.value }))}
              />
            </label>
            <label>
              Level
              <input
                type="number"
                min="0"
                max="5"
                value={identityForm.level}
                onChange={(e) => setIdentityForm((f) => ({ ...f, level: e.target.value }))}
              />
            </label>
          </div>
          <button type="submit" className="ghost">
            Save identity update
          </button>
        </form>
      </div>
    </div>
  );
}
