import { OPERATION_ENDGAME_INITIATIVES } from './operationEndgameInitiativeRegistry.js';

// D1 bridge only: this resolver improves initiative display for the current
// Operation Endgame plan. Future multi-entity plans should derive initiative
// structure from explicit Organizational Architecture Intake rather than
// relying on alias projection alone.

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function lowerText(value) {
  return normalizeText(value).toLowerCase();
}

function explicitInitiativeName(block, context = {}) {
  return (
    normalizeText(context?.initiative?.label || context?.initiative?.title || context?.initiative?.name || context?.initiative) ||
    normalizeText(block?.initiativeName || block?.projectName || block?.ventureName || block?.initiativeTitle || block?.initiativeLabel) ||
    normalizeText(block?.initiative)
  );
}

function candidateHaystacks(block, context = {}) {
  return [
    block?.displayTitle,
    block?.title,
    block?.label,
    block?.laneLabel,
    block?.laneName,
    block?.mission,
    block?.cluster,
    block?.clusterName,
    block?.venture,
    context?.lane?.label,
    context?.lane?.title,
    context?.lane?.name,
    context?.lane,
    context?.mission,
    context?.cluster,
  ]
    .map(lowerText)
    .filter(Boolean);
}

function findRegistryMatch(block, context = {}, registry = OPERATION_ENDGAME_INITIATIVES) {
  const haystacks = candidateHaystacks(block, context);
  let bestMatch = null;

  for (const entry of registry || []) {
    const aliases = Array.isArray(entry?.aliases) ? entry.aliases.map(lowerText).filter(Boolean) : [];
    for (const alias of aliases) {
      if (!alias) continue;
      const hit = haystacks.find((haystack) => haystack.includes(alias));
      if (!hit) continue;
      const score = alias.length;
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          entry,
          alias,
          score,
          source: hit === lowerText(block?.title) || hit === lowerText(block?.displayTitle) ? 'alias:title' : 'alias:context',
        };
      }
    }
  }

  return bestMatch;
}

export function resolveInitiativeDisplay(block = {}, context = {}) {
  const explicitName = explicitInitiativeName(block, context);
  const fallbackLane =
    normalizeText(context?.lane?.label || context?.lane?.title || context?.lane?.name || context?.lane) ||
    normalizeText(block?.laneLabel || block?.laneName || block?.lane);

  if (explicitName) {
    return {
      initiative: explicitName,
      lane: fallbackLane,
      confidence: 'high',
      source: 'explicit',
    };
  }

  const matched = findRegistryMatch(block, context, context?.registry || OPERATION_ENDGAME_INITIATIVES);
  if (matched?.entry) {
    return {
      initiative: matched.entry.name,
      lane: normalizeText(matched.entry.laneLabel) || fallbackLane,
      confidence: 'high',
      source: matched.source,
      id: matched.entry.id,
    };
  }

  return {
    initiative: fallbackLane,
    lane: fallbackLane,
    confidence: 'fallback',
    source: 'lane',
  };
}

export default resolveInitiativeDisplay;
