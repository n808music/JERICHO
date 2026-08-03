// MatrixInstrument — State 2 diagnostic view.
// Renders what intake captured in state.matrix.* faithfully.
//
// TWO DISTINCT GAP TYPES (never conflate):
//   Intake gaps  — intake hasn't asked yet. Punch-list at top. Response: finish intake.
//   Reality gaps — intake successfully captured real distance (missing capital, broken
//                  convergence edge, entity still conceptual). Response: this IS the work.

import React, { useMemo } from 'react';

// Parity copy of ROLE_TAG_DISPLAY_LABELS from entityRoleTags.ts — import deferred to Wave 3.
// Drift is caught by: tests/components/MatrixInstrument.labelParity.test.js
export const ROLE_TAG_DISPLAY_LABELS = {
  business:   'Business',
  initiative: 'Campaign leader',
  project:    'Project operator',
  system:     'System custodian',
};

// ─── Formation state ladder ────────────────────────────────────────────────────
// Color encodes maturity: dim=not-formed → bright green=functioning
// Legal status (legallyFormed boolean) rendered separately as a badge, not part of this ladder.

const FORMATION_CONFIG = {
  'not-formed':     { label: 'not formed',     bg: '#18181b', color: '#71717a', border: '#3f3f46' },
  'named-only':     { label: 'named only',     bg: '#27272a', color: '#a1a1aa', border: '#52525b' },
  'conceptual':     { label: 'conceptual',     bg: '#1e293b', color: '#94a3b8', border: '#334155' },
  'in-development': { label: 'in dev',         bg: '#0c1a2e', color: '#60a5fa', border: '#1e3a5f' },
  'functioning':    { label: 'functioning',    bg: '#052e16', color: '#34d399', border: '#064e3b' },
};

const DIMENSIONS = ['money', 'time', 'skills', 'tech'];
const DIMENSION_LABELS = { money: 'Capital', time: 'Time', skills: 'Skills', tech: 'Tech' };

const SYSTEM_STATE_COLORS = {
  running: '#34d399',
  planned: '#60a5fa',
  missing: '#fbbf24',
};

// ─── Name resolver across all matrix sections ─────────────────────────────────

function buildNodeNameMap(matrix) {
  const map = {};
  for (const [id, n] of Object.entries(matrix?.entitiesById || {})) map[id] = n.name;
  for (const [id, n] of Object.entries(matrix?.initiativesById || {})) map[id] = n.name;
  for (const [id, n] of Object.entries(matrix?.systemsById || {})) map[id] = n.name;
  for (const [id, n] of Object.entries(matrix?.projectsById || {})) map[id] = n.name;
  for (const [id, n] of Object.entries(matrix?.artifactsById || {})) map[id] = n.name;
  for (const [id, n] of Object.entries(matrix?.verificationSourcesById || {})) map[id] = n.source || n.name || id;
  return map;
}

// ─── Section completeness (INTAKE GAPS only) ──────────────────────────────────

function computeIntakeCompleteness(matrix) {
  const ini = Object.keys(matrix?.initiativesById || {}).length;
  const profiled = Object.keys(matrix?.resourceProfilesById || {}).length;
  const sections = [
    { key: '1A', label: 'Verification sources', done: Object.keys(matrix?.verificationSourcesById || {}).length > 0 },
    { key: '2',  label: 'Entities',             done: Object.keys(matrix?.entitiesById || {}).length > 0 },
    { key: '3',  label: 'Initiatives',          done: ini > 0 },
    { key: '4',  label: 'Systems',              done: Object.keys(matrix?.systemsById || {}).length > 0 },
    { key: '5',  label: 'Projects',             done: Object.keys(matrix?.projectsById || {}).length > 0 },
    { key: '6',  label: 'Artifacts',            done: Object.keys(matrix?.artifactsById || {}).length > 0 },
    { key: '7',  label: 'Dependencies',         done: Object.keys(matrix?.dependenciesById || {}).length > 0 },
    { key: '8',  label: 'Convergence',          done: Object.keys(matrix?.convergenceEdgesById || {}).length > 0 },
    { key: '9a', label: `Resource profiles (${profiled}/${ini})`, done: ini > 0 && profiled >= ini },
    { key: '9b', label: 'Binding constraint',   done: matrix?.bindingConstraint !== null },
    { key: '10', label: 'Bootstrap selection',  done: Boolean(matrix?.bootstrap?.selectedNodeId) },
  ];
  return sections;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormationPill({ state }) {
  const cfg = FORMATION_CONFIG[state] || { label: state || '?', bg: '#27272a', color: '#a1a1aa', border: '#52525b' };
  return (
    <span
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono tracking-wider flex-shrink-0"
    >
      {cfg.label}
    </span>
  );
}

function LegalStatusBadge({ formed }) {
  if (formed === undefined) return null;
  // Three distinct states: null (not yet asked), false (confirmed no), true (confirmed yes)
  const isNull = formed === null;
  const isTrue = formed === true;
  const isFalse = formed === false;

  let bg, color, border, text;
  if (isNull) {
    // Neutral gray: not yet asked
    bg = '#27272a';
    color = '#a1a1aa';
    border = '#52525b';
    text = '? legal status not yet asked';
  } else if (isTrue) {
    // Green: confirmed legally formed
    bg = '#064e3b';
    color = '#6ee7b7';
    border = '#047857';
    text = '✓ legally formed';
  } else {
    // Red: confirmed not yet legal
    bg = '#7c2d12';
    color = '#fda29b';
    border = '#b45309';
    text = '✗ not yet legal';
  }

  return (
    <span
      style={{ background: bg, color: color, border: `1px solid ${border}` }}
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono tracking-wider flex-shrink-0"
    >
      {text}
    </span>
  );
}

function RoleTagChips({ tags }) {
  if (!tags?.length) return null;
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className="text-[9px] uppercase tracking-wider rounded px-1 py-0.5"
          style={{ color: '#71717a', border: '1px solid #3f3f46' }}
        >
          {ROLE_TAG_DISPLAY_LABELS[tag] || tag}
        </span>
      ))}
    </span>
  );
}

// INTAKE GAPS — top punch-list, visually isolated from reality gaps
function IntakeCompletenessBar({ matrix }) {
  const sections = computeIntakeCompleteness(matrix);
  const doneCount = sections.filter(s => s.done).length;
  const pct = Math.round((doneCount / sections.length) * 100);
  const allDone = doneCount === sections.length;
  const incomplete = sections.filter(s => !s.done);

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{ background: '#0c0c0c', border: '1px solid #292524' }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: '#78716c' }}>
          Intake completeness — finish survey to close intake gaps
        </p>
        <span
          className="text-[11px] font-mono font-bold"
          style={{ color: allDone ? '#34d399' : '#f59e0b' }}
        >
          {doneCount}/{sections.length}
        </span>
      </div>
      <div className="h-px w-full rounded-full overflow-hidden" style={{ background: '#27272a' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: allDone ? '#059669' : '#d97706' }}
        />
      </div>
      {incomplete.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          {incomplete.map(s => (
            <span key={s.key} className="text-[10px] font-mono" style={{ color: '#78716c' }}>
              ○ §{s.key} {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Entity spine + owned initiatives/systems/projects/artifacts
function EntitySpineSection({ matrix }) {
  const entities = Object.values(matrix?.entitiesById || {});
  const initiatives = Object.values(matrix?.initiativesById || {});
  const systems = Object.values(matrix?.systemsById || {});
  const projects = Object.values(matrix?.projectsById || {});
  const artifacts = Object.values(matrix?.artifactsById || {});

  const initiativesByOwner = useMemo(() => {
    const m = {};
    initiatives.forEach(n => { const k = n.owningEntityId || '__unowned__'; (m[k] = m[k] || []).push(n); });
    return m;
  }, [initiatives]);

  const systemsByOwner = useMemo(() => {
    const m = {};
    systems.forEach(n => { const k = n.owningEntityId || '__unowned__'; (m[k] = m[k] || []).push(n); });
    return m;
  }, [systems]);

  const projectsByEntity = useMemo(() => {
    const m = {};
    projects.forEach(n => { const k = n.owningEntityId || '__unowned__'; (m[k] = m[k] || []).push(n); });
    return m;
  }, [projects]);

  const artifactsByProject = useMemo(() => {
    const m = {};
    artifacts.forEach(n => { const k = n.producingProjectId || '__unowned__'; (m[k] = m[k] || []).push(n); });
    return m;
  }, [artifacts]);

  const hasUnowned =
    (initiativesByOwner['__unowned__'] || []).length > 0 ||
    (systemsByOwner['__unowned__'] || []).length > 0 ||
    (projectsByEntity['__unowned__'] || []).length > 0;

  return (
    <div className="rounded-lg p-3 space-y-2.5" style={{ background: '#0c0c0c', border: '1px solid #1c1917' }}>
      <p className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: '#78716c' }}>
        Entity Spine — Sections 2–6
      </p>

      {entities.length === 0 ? (
        <p className="text-xs italic" style={{ color: '#52525b' }}>No entities declared yet.</p>
      ) : (
        entities.map(entity => {
          const ownedInitiatives = initiativesByOwner[entity.id] || [];
          const ownedSystems = systemsByOwner[entity.id] || [];
          const ownedProjects = projectsByEntity[entity.id] || [];

          return (
            <div key={entity.id} className="rounded-md p-3 space-y-2" style={{ background: '#111111', border: '1px solid #262626' }}>
              {/* Entity header */}
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: '#e4e4e7' }}>{entity.name}</span>
                <FormationPill state={entity.formationState} />
                <LegalStatusBadge formed={entity.legallyFormed} />
                <RoleTagChips tags={entity.roleTags} />
              </div>
              {entity.purpose && (
                <p className="text-[11px] leading-relaxed" style={{ color: '#71717a' }}>{entity.purpose}</p>
              )}

              {/* Initiatives */}
              {ownedInitiatives.length > 0 && (
                <div className="space-y-1 pl-2" style={{ borderLeft: '1px solid #27272a' }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: '#52525b' }}>Initiatives</p>
                  {ownedInitiatives.map(ini => (
                    <div key={ini.id} className="flex items-start gap-2 flex-wrap">
                      <span className="text-[11px]" style={{ color: '#d4d4d8' }}>{ini.name}</span>
                      <span
                        className="text-[9px] uppercase tracking-wider rounded px-1 py-0.5"
                        style={{
                          color: ini.classification === 'constraint' ? '#f59e0b' : '#60a5fa',
                          border: `1px solid ${ini.classification === 'constraint' ? '#78350f' : '#1e3a5f'}`,
                          background: ini.classification === 'constraint' ? '#1c1007' : '#0c1a2e',
                        }}
                      >
                        {ini.classification}
                      </span>
                      {ini.doneWhen && (
                        <span className="text-[10px] italic truncate max-w-xs" style={{ color: '#52525b' }}>
                          done when: {ini.doneWhen}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Systems */}
              {ownedSystems.length > 0 && (
                <div className="space-y-1 pl-2" style={{ borderLeft: '1px solid #27272a' }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: '#52525b' }}>Systems</p>
                  {ownedSystems.map(sys => (
                    <div key={sys.id} className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px]" style={{ color: '#d4d4d8' }}>{sys.name}</span>
                      <span
                        className="text-[9px] font-mono"
                        style={{ color: SYSTEM_STATE_COLORS[sys.activationState] || '#a1a1aa' }}
                      >
                        {sys.activationState}
                      </span>
                      <span className="text-[10px] italic" style={{ color: '#52525b' }}>every {sys.cycle}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Projects + artifacts */}
              {ownedProjects.length > 0 && (
                <div className="space-y-1.5 pl-2" style={{ borderLeft: '1px solid #27272a' }}>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: '#52525b' }}>Projects</p>
                  {ownedProjects.map(proj => {
                    const projArtifacts = artifactsByProject[proj.id] || [];
                    return (
                      <div key={proj.id} className="space-y-0.5">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="text-[11px]" style={{ color: '#d4d4d8' }}>{proj.name}</span>
                          {proj.successMetric && (
                            <span className="text-[10px] italic truncate max-w-xs" style={{ color: '#4ade80', opacity: 0.6 }}>
                              → {proj.successMetric}
                            </span>
                          )}
                        </div>
                        {projArtifacts.map(art => (
                          <div key={art.id} className="flex items-start gap-1.5 pl-3">
                            <span className="text-[9px] mt-0.5 flex-shrink-0" style={{ color: '#52525b' }}>◦</span>
                            <span className="text-[10px]" style={{ color: '#a1a1aa' }}>{art.name}</span>
                            {art.completionEvidence && (
                              <span className="text-[9px] italic truncate max-w-[220px]" style={{ color: '#3f3f46' }}>
                                {art.completionEvidence}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Cross-cutting (unowned) */}
      {hasUnowned && (
        <div className="rounded-md p-2 space-y-1" style={{ background: '#1c1007', border: '1px solid #78350f4d' }}>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: '#d97706', opacity: 0.6 }}>
            Cross-cutting (no entity owner)
          </p>
          {(initiativesByOwner['__unowned__'] || []).map(n => (
            <p key={n.id} className="text-[11px] pl-2" style={{ color: '#a1a1aa' }}>⟡ {n.name} <span style={{ color: '#52525b' }}>initiative</span></p>
          ))}
          {(systemsByOwner['__unowned__'] || []).map(n => (
            <p key={n.id} className="text-[11px] pl-2" style={{ color: '#a1a1aa' }}>⟡ {n.name} <span style={{ color: '#52525b' }}>system</span></p>
          ))}
          {(projectsByEntity['__unowned__'] || []).map(n => (
            <p key={n.id} className="text-[11px] pl-2" style={{ color: '#a1a1aa' }}>⟡ {n.name} <span style={{ color: '#52525b' }}>project</span></p>
          ))}
        </div>
      )}
    </div>
  );
}

// REALITY GAPS — resource grid (the work, not "finish intake")
function ResourceGapGrid({ matrix }) {
  const initiatives = useMemo(() => Object.values(matrix?.initiativesById || {}), [matrix?.initiativesById]);
  const profiles = matrix?.resourceProfilesById || {};
  const bindingDim = matrix?.bindingConstraint?.bindingDimension || null;

  const profileByInitiativeId = useMemo(() => {
    const m = {};
    Object.values(profiles).forEach(p => { if (p.initiativeId) m[p.initiativeId] = p; });
    return m;
  }, [profiles]);

  const profiledCount = Object.keys(profileByInitiativeId).length;

  if (initiatives.length === 0) {
    return null; // Nothing to show until initiatives exist
  }

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: '#0c0c0c', border: '1px solid #1c1917' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: '#78716c' }}>
          Resource Gap Grid — Section 9
        </p>
        {profiledCount < initiatives.length && (
          <span className="text-[10px] font-mono" style={{ color: '#f59e0b', opacity: 0.7 }}>
            ○ {initiatives.length - profiledCount} initiative{initiatives.length - profiledCount !== 1 ? 's' : ''} unprofiled — intake gap
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left pb-1.5 pr-4 text-[9px] uppercase tracking-wider font-normal" style={{ color: '#52525b' }}>
                Initiative
              </th>
              {DIMENSIONS.map(dim => (
                <th
                  key={dim}
                  className="pb-1.5 px-2 text-[9px] uppercase tracking-wider font-normal text-center"
                  style={{ color: dim === bindingDim ? '#f59e0b' : '#52525b' }}
                >
                  {DIMENSION_LABELS[dim]}
                  {dim === bindingDim && <span className="ml-1" style={{ color: '#f59e0b' }}>⬆</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {initiatives.map(ini => {
              const profile = profileByInitiativeId[ini.id];
              return (
                <tr key={ini.id}>
                  <td className="py-1 pr-4 whitespace-nowrap">
                    <span style={{ color: '#d4d4d8' }}>{ini.name}</span>
                    <span
                      className="ml-1.5 text-[9px]"
                      style={{ color: ini.classification === 'constraint' ? '#f59e0b' : '#60a5fa' }}
                    >
                      {ini.classification}
                    </span>
                  </td>
                  {!profile ? (
                    <td colSpan={DIMENSIONS.length} className="py-1 px-2">
                      <span className="text-[9px] font-mono" style={{ color: '#f59e0b', opacity: 0.5 }}>
                        ○ profile not yet elicited
                      </span>
                    </td>
                  ) : (
                    DIMENSIONS.map(dim => {
                      const cell = profile.dimensions?.[dim];
                      if (!cell) {
                        return (
                          <td key={dim} className="py-1 px-2 text-center">
                            <span className="text-[9px] font-mono" style={{ color: '#3f3f46' }}>—</span>
                          </td>
                        );
                      }
                      const hasGap = cell.gap !== null && cell.gap !== undefined;
                      return (
                        <td key={dim} className="py-1 px-1.5">
                          <div
                            className="rounded px-1.5 py-1"
                            style={{
                              background: hasGap ? '#1c0505' : '#011c0e',
                              border: `1px solid ${hasGap ? '#7f1d1d66' : '#14532d66'}`,
                            }}
                          >
                            <p
                              className="text-[9px] font-mono font-bold text-center"
                              style={{ color: hasGap ? '#f87171' : '#4ade80' }}
                            >
                              {hasGap ? 'GAP' : '✓'}
                            </p>
                            {hasGap && cell.gap && (
                              <p
                                className="text-[9px] mt-0.5 leading-tight"
                                style={{ color: '#f87171', opacity: 0.65 }}
                                title={cell.gap}
                              >
                                {cell.gap.length > 40 ? cell.gap.slice(0, 40) + '…' : cell.gap}
                              </p>
                            )}
                            {cell.need && (
                              <p
                                className="text-[9px] mt-0.5 leading-tight"
                                style={{ color: '#52525b' }}
                                title={cell.need}
                              >
                                {cell.need.length > 30 ? cell.need.slice(0, 30) + '…' : cell.need}
                              </p>
                            )}
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Binding constraint = the bottleneck (reality: this shapes the plan)
function BindingConstraintPanel({ matrix }) {
  const bc = matrix?.bindingConstraint;
  if (!bc) return null;
  return (
    <div
      className="rounded-lg p-3 flex items-start gap-3"
      style={{ background: '#1c1007', border: '1px solid #78350f66' }}
    >
      <span className="text-sm flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }}>⬆</span>
      <div className="space-y-0.5">
        <p className="text-[9px] uppercase tracking-[0.16em]" style={{ color: '#f59e0b', opacity: 0.65 }}>
          Binding Constraint — Section 9
        </p>
        <p className="text-sm font-semibold" style={{ color: '#fde68a' }}>
          {DIMENSION_LABELS[bc.bindingDimension] || bc.bindingDimension}
          <span className="ml-2 text-xs font-normal" style={{ color: '#78716c' }}>
            is the bottleneck — plan sequences around this
          </span>
        </p>
        {bc.rationale && (
          <p className="text-[11px]" style={{ color: '#f59e0b', opacity: 0.6 }}>{bc.rationale}</p>
        )}
      </div>
    </div>
  );
}

// Edges — dependencies (§7) and convergence (§8)
function EdgePanel({ matrix }) {
  const deps = useMemo(() => Object.values(matrix?.dependenciesById || {}), [matrix?.dependenciesById]);
  const convEdges = useMemo(() => Object.values(matrix?.convergenceEdgesById || {}), [matrix?.convergenceEdgesById]);
  const nameMap = useMemo(() => buildNodeNameMap(matrix), [matrix]);

  const name = id => nameMap[id] || id;

  const DEP_STYLES = {
    hard_gate:    { verb: 'blocks',  color: '#f87171', bgBorder: ['#1c0505', '#7f1d1d66'] },
    directional:  { verb: 'feeds',   color: '#a1a1aa', bgBorder: ['#18181b', '#3f3f4666'] },
    informational:{ verb: 'informs', color: '#52525b', bgBorder: ['#0c0c0c', '#27272a66'] },
  };

  const hasBroken = convEdges.some(e => e.broken);

  if (deps.length === 0 && convEdges.length === 0) return null;

  return (
    <div className="rounded-lg p-3 space-y-2.5" style={{ background: '#0c0c0c', border: '1px solid #1c1917' }}>
      <p className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: '#78716c' }}>
        Edges — Sections 7–8
      </p>

      {deps.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: '#3f3f46' }}>Dependencies (§7)</p>
          {deps.map(dep => {
            const s = DEP_STYLES[dep.type] || DEP_STYLES.informational;
            return (
              <div key={dep.id} className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono" style={{ color: '#d4d4d8' }}>{name(dep.upstreamId)}</span>
                <span
                  className="text-[9px] font-mono rounded px-1 py-0.5"
                  style={{ color: s.color, background: s.bgBorder[0], border: `1px solid ${s.bgBorder[1]}` }}
                >
                  {s.verb}
                </span>
                <span className="text-[11px] font-mono" style={{ color: '#d4d4d8' }}>{name(dep.downstreamId)}</span>
              </div>
            );
          })}
        </div>
      )}

      {convEdges.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider" style={{ color: '#3f3f46' }}>Convergence (§8)</p>
          {convEdges.map(edge => (
            <div key={edge.id} className={`flex items-start gap-2 flex-wrap ${edge.broken ? 'opacity-80' : ''}`}>
              <span className="text-[11px] font-mono" style={{ color: '#d4d4d8' }}>{name(edge.fromNodeId)}</span>
              <span className="text-[9px]" style={{ color: '#52525b' }}>gives</span>
              <span className="text-[10px] italic" style={{ color: '#a1a1aa' }}>
                {edge.gives || edge.label || '—'}
              </span>
              <span className="text-[9px]" style={{ color: '#52525b' }}>→</span>
              <span className="text-[11px] font-mono" style={{ color: '#d4d4d8' }}>{name(edge.toNodeId)}</span>
              {edge.broken && (
                <span
                  className="text-[9px] font-mono rounded px-1 py-0.5"
                  style={{ color: '#f87171', background: '#1c0505', border: '1px solid #7f1d1d' }}
                >
                  ⚠ broken — THE WORK
                </span>
              )}
            </div>
          ))}
          {hasBroken && (
            <p className="text-[10px] italic" style={{ color: '#f87171', opacity: 0.5 }}>
              Broken convergence = a reality gap. The plan closes it — not a survey defect.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Bootstrap — startable candidates, ranked
function BootstrapPanel({ matrix }) {
  const bootstrap = matrix?.bootstrap;
  const artifacts = matrix?.artifactsById || {};

  if (!bootstrap?.candidates?.length && !bootstrap?.selectedNodeId) return null;

  const bindingDim = matrix?.bindingConstraint?.bindingDimension || null;

  return (
    <div className="rounded-lg p-3 space-y-2" style={{ background: '#0c0c0c', border: '1px solid #1c1917' }}>
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: '#78716c' }}>
          Bootstrap — Section 10
        </p>
        {bindingDim && (
          <span className="text-[10px] italic" style={{ color: '#f59e0b', opacity: 0.6 }}>
            ranked by {DIMENSION_LABELS[bindingDim] || bindingDim} gap
          </span>
        )}
      </div>

      {(bootstrap.candidates || []).map((artifactId, idx) => {
        const art = artifacts[artifactId];
        const isSelected = artifactId === bootstrap.selectedNodeId;
        return (
          <div
            key={artifactId}
            className="flex items-center gap-3 rounded-md px-2.5 py-2"
            style={{
              background: isSelected ? '#011c0e' : '#111111',
              border: `1px solid ${isSelected ? '#14532d' : '#262626'}`,
            }}
          >
            <span className="text-[10px] font-mono w-4 flex-shrink-0" style={{ color: '#3f3f46' }}>
              #{idx + 1}
            </span>
            <span
              className="text-[11px] font-medium"
              style={{ color: isSelected ? '#6ee7b7' : '#d4d4d8' }}
            >
              {art?.name || artifactId}
            </span>
            {art?.completionEvidence && (
              <span className="text-[10px] italic truncate flex-1" style={{ color: '#52525b' }}>
                {art.completionEvidence}
              </span>
            )}
            {isSelected && (
              <span
                className="ml-auto text-[9px] uppercase tracking-wider rounded px-1.5 py-0.5 flex-shrink-0"
                style={{ color: '#34d399', border: '1px solid #14532d' }}
              >
                start here
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function MatrixInstrument({ matrix }) {
  const isEmpty = useMemo(() => {
    if (!matrix) return true;
    return (
      Object.keys(matrix.entitiesById || {}).length === 0 &&
      Object.keys(matrix.initiativesById || {}).length === 0 &&
      Object.keys(matrix.verificationSourcesById || {}).length === 0
    );
  }, [matrix]);

  if (!matrix) return null;

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#0a0a0a', border: '1px solid #1c1917' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold" style={{ color: '#78716c' }}>
            Captured Structure · State 2
          </p>
          <p className="text-[10px] italic mt-0.5" style={{ color: '#3f3f46' }}>
            What intake elicited. State 3 (standardization) and State 4 (lanes/schedule) are downstream — not yet built.
          </p>
        </div>
        <div
          className="text-[9px] uppercase tracking-wider rounded px-2 py-1 flex-shrink-0"
          style={{ color: '#52525b', border: '1px solid #27272a', background: '#0c0c0c' }}
        >
          matrix
        </div>
      </div>

      {isEmpty ? (
        <div
          className="rounded-lg p-6 text-center space-y-1"
          style={{ background: '#0f0f0f', border: '1px solid #1c1c1c' }}
        >
          <p className="text-sm" style={{ color: '#52525b' }}>Matrix is empty</p>
          <p className="text-xs italic" style={{ color: '#3f3f46' }}>Run intake — all ten sections — to populate this view.</p>
        </div>
      ) : (
        <>
          {/* INTAKE GAPS — isolated punch-list, not mixed with the data */}
          <IntakeCompletenessBar matrix={matrix} />

          {/* Entity spine — §2–6 */}
          <EntitySpineSection matrix={matrix} />

          {/* REALITY GAPS — resource grid */}
          <ResourceGapGrid matrix={matrix} />

          {/* Binding constraint (reality — shapes the plan) */}
          <BindingConstraintPanel matrix={matrix} />

          {/* Edges — §7 dependencies + §8 convergence */}
          <EdgePanel matrix={matrix} />

          {/* Bootstrap — §10 */}
          <BootstrapPanel matrix={matrix} />
        </>
      )}
    </div>
  );
}
