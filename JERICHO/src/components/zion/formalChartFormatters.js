// View-model formatters for the formal plan chart.
// Pure functions — no React, no state, no DOM.
// Engine substrate (block.id, consumedArtifactIds, gateCriteria) is never mutated.

import { projectEnterpriseDisplay } from '../../domain/enterprise/enterpriseDisplayProjection';

const FH_PREFIX = /^(fh-|artifact:fh-)/;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_HEX_HEAVY = /^[a-z0-9-]{30,}$/i;

export function isInternalId(value) {
  if (typeof value !== 'string' || !value) {return false;}
  if (FH_PREFIX.test(value)) {return true;}
  if (UUID_SHAPE.test(value)) {return true;}
  if (LONG_HEX_HEAVY.test(value) && /-/.test(value) && value.length >= 30) {return true;}
  return false;
}

export function shortenInternalId(value) {
  const s = typeof value === 'string' ? value : '';
  if (!s) {return '';}
  if (s.length <= 14) {return s;}
  const dateMatch = s.match(/\d{4}-\d{2}-\d{2}-\d+$/);
  if (dateMatch) {return dateMatch[0];}
  return s.slice(-12);
}

function familyTokenFromLane(laneLabel) {
  const t = String(laneLabel || '').trim();
  if (!t) {return null;}
  const projection = projectEnterpriseDisplay({
    laneId: t,
    laneLabel: t,
    intakeSignals: { goalText: '', declaredLaneIds: [] },
  });
  return projection.companyCategory || null;
}

export function formatBlockRef(block, index) {
  const idx = String((Number(index) || 0) + 1).padStart(3, '0');
  const phase = String(block?.phaseLabel || '').trim();
  const family = familyTokenFromLane(block?.laneLabel || block?.laneTitle || '');
  if (phase && family) {return `${phase}·${family}·${idx}`;}
  if (phase) {return `${phase}·${idx}`;}
  return `Block ${idx}`;
}

export function formatArtifactLabel(idOrName, artifactRegistry = {}) {
  const s = typeof idOrName === 'string' ? idOrName : '';
  if (!s) {return '—';}
  if (!isInternalId(s)) {return s;}
  const reg = artifactRegistry?.[s] || artifactRegistry?.byId?.[s] || null;
  const name = reg?.artifactName || reg?.name;
  if (name) {return name;}
  return shortenInternalId(s);
}

export function formatConsumedArtifacts(consumedArtifactIds, artifactRegistry = {}, idToBlock = new Map()) {
  if (!Array.isArray(consumedArtifactIds) || consumedArtifactIds.length === 0) {return '—';}
  const ids = consumedArtifactIds.filter(Boolean);
  if (ids.length === 0) {return '—';}
  const labels = ids.map((id) => {
    const reg = artifactRegistry?.[id] || artifactRegistry?.byId?.[id] || null;
    if (reg?.artifactName) {return reg.artifactName;}
    const upstream = idToBlock.get(id);
    const upstreamName =
      upstream?.outputArtifact?.artifactName ||
      (typeof upstream?.outputArtifact === 'string' ? upstream.outputArtifact : null);
    if (typeof upstreamName === 'string' && upstreamName) {return upstreamName;}
    if (typeof upstream?.producesArtifact === 'string') {return upstream.producesArtifact;}
    return shortenInternalId(id);
  });
  if (labels.length === 1) {return labels[0];}
  const first = labels[0];
  if (first && !isInternalId(first) && !/^\d{4}-\d{2}-\d{2}/.test(first)) {
    return `${first} (+${labels.length - 1} more)`;
  }
  return `${labels.length} upstream artifacts`;
}

function shortenPhrase(text, maxLen = 80) {
  const s = String(text || '').trim();
  if (s.length <= maxLen) {return s;}
  return s.slice(0, maxLen - 1) + '…';
}

function toSentence(text) {
  const s = String(text || '').trim();
  if (!s) {return '';}
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

export function formatGateSummary(block) {
  const type = String(block?.blockType || '').toLowerCase();
  if (type !== 'gate') {return '—';}
  const gc = block?.gateCriteria;
  if (!gc) {return '—';}
  if (typeof gc === 'string') {return shortenPhrase(gc, 200);}
  if (typeof gc !== 'object') {return '—';}
  const gateName = String(gc.gateName || block?.gateName || '').trim();
  const metric = String(gc.metricName || '').trim();
  const criteria = String(gc.acceptanceCriteria || gc.passCriteria || block?.passCriteria || '').trim();
  const threshold = String(gc.threshold || '').trim();
  const evidence = String(gc.evidenceArtifactId || gc.evidenceRequired || block?.evidenceRequired || '').trim();
  const segments = [
    gateName || metric,
    criteria ? `Criteria: ${toSentence(criteria)}` : '',
    threshold ? `Threshold: ${threshold}` : '',
    evidence ? `Evidence: ${evidence}` : '',
  ].filter(Boolean);
  return segments.length > 0 ? shortenPhrase(segments.join(' · '), 200) : '—';
}
