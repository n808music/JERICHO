import { getInitiativeRegistrySyncOrEmpty } from './initiativeRegistryLoader.js';
import { resolveLaneEntity } from '../enterprise/laneToEntity.ts';

// Initiative resolver: derives initiative names and lanes from live matrix data.
// The registry is loaded from the Operation Morning Sun Google Sheet at app startup.
// Supports explicit names from context, alias matching against matrix data, and fallback lanes.
//
// To preload the registry at startup, call initializeInitiativeRegistry() once in your app init.

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

function findRegistryMatch(block, context = {}, registry = null) {
  // Use provided registry, or fall back to the live-loaded registry
  const effectiveRegistry = registry || context?.registry || getInitiativeRegistrySyncOrEmpty();
  const haystacks = candidateHaystacks(block, context);
  let bestMatch = null;

  for (const entry of effectiveRegistry || []) {
    const aliases = Array.isArray(entry?.aliases) ? entry.aliases.map(lowerText).filter(Boolean) : [];
    for (const alias of aliases) {
      if (!alias) {continue;}
      const hit = haystacks.find((haystack) => haystack.includes(alias));
      if (!hit) {continue;}
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
    // When an explicit initiative name is provided, look it up in the registry
    // to get the owner. This ensures entity resolution is consistent with the registry.
    const registry = context?.registry || getInitiativeRegistrySyncOrEmpty();
    const registryEntry = registry.find((entry) => {
      const entryNameLower = lowerText(entry.name);
      const explicitLower = lowerText(explicitName);
      return entryNameLower === explicitLower;
    });

    if (registryEntry && registryEntry.owner) {
      return {
        initiative: registryEntry.name,
        lane: registryEntry.name,
        entity: normalizeText(registryEntry.owner),
        confidence: 'high',
        source: 'explicit:registry',
        id: registryEntry.id,
      };
    }

    // Explicit name provided but not found in registry; use fallback entity
    return {
      initiative: explicitName,
      lane: explicitName,
      entity: fallbackLane || '',
      confidence: 'high',
      source: 'explicit',
    };
  }

  const matched = findRegistryMatch(block, context, context?.registry || getInitiativeRegistrySyncOrEmpty());
  if (matched?.entry) {
    return {
      initiative: matched.entry.name,
      lane: matched.entry.name, // Use initiative name as lane (retired lane taxonomy)
      entity: normalizeText(matched.entry.owner) || fallbackLane || '',
      confidence: 'high',
      source: matched.source,
      id: matched.entry.id,
    };
  }

  // No registry match and no explicit initiative: return unresolved state.
  // This signals that the block lacks sufficient context for proper entity resolution.
  // Callers should provide explicit initiative or ensure block fields match registry aliases.
  return {
    initiative: fallbackLane || 'Unspecified Initiative',
    lane: fallbackLane || 'Unspecified Initiative',
    entity: '', // No entity resolution without a known Initiative
    confidence: 'fallback',
    source: 'fallback',
  };
}

/**
 * Preload the live initiative registry from the Google Sheet.
 * Call this once at app startup to populate the registry before rendering.
 * If not called, the resolver will use an empty registry until async loading completes.
 */
export async function initializeInitiativeRegistry() {
  const { loadInitiativeRegistry } = await import('./initiativeRegistryLoader.js');
  try {
    await loadInitiativeRegistry();
    console.log('[resolveInitiativeDisplay] Initiative registry loaded from Operation Morning Sun matrix.');
  } catch (error) {
    console.error('[resolveInitiativeDisplay] Failed to initialize registry:', error.message);
  }
}

export default resolveInitiativeDisplay;
