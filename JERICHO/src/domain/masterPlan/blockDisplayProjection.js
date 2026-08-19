function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shortenOperationEndgamePhrases(title) {
  let next = normalizeText(title);
  if (!next) {
    return next;
  }

  next = next.replace(/\s+for the cross-lane Operation Endgame review\b/gi, '');
  next = next.replace(/\s+for Operation Endgame\b/gi, '');
  next = next.replace(/\s+in P\d\s+[^,]+?\s+lane\b/gi, '');
  next = next.replace(/\bconversion-readiness\b/gi, 'conversion');
  next = next.replace(/\bagainst the success standard and outcome target\b/gi, 'against success standard');

  return normalizeText(next.replace(/\s+,/g, ','));
}

function buildDisplayTitle(block, context = {}) {
  const canonicalTitle = normalizeText(block?.canonicalTitle || block?.title || block?.label || 'Untitled block');
  if (!canonicalTitle) {
    return 'Untitled block';
  }

  const compressed = shortenOperationEndgamePhrases(canonicalTitle);
  if (compressed && compressed.length < canonicalTitle.length) {
    return compressed;
  }

  return canonicalTitle;
}

export function projectBlockForDisplay(block, context = {}) {
  if (!block || typeof block !== 'object') {
    return block;
  }

  const canonicalTitle = normalizeText(block.canonicalTitle || block.title || block.label || 'Untitled block');
  const existingDisplayTitle = normalizeText(block.displayTitle);
  const displayTitle = existingDisplayTitle || buildDisplayTitle({ ...block, canonicalTitle }, context);
  const detailTitle = normalizeText(block.detailTitle || canonicalTitle);

  return {
    ...block,
    canonicalTitle,
    displayTitle,
    detailTitle,
    displayMeta: {
      phaseLabel: block?.phaseLabel || null,
      laneLabel: block?.laneLabel || null,
      commitmentState: block?.commitmentState || null,
      dayKey: block?.dayKey || block?.date || block?.startISO?.slice(0, 10) || null,
      surface: context?.surface || null,
    },
  };
}

export function projectBlocksForDisplay(blocks, context = {}) {
  return Array.isArray(blocks) ? blocks.map((block) => projectBlockForDisplay(block, context)) : [];
}
