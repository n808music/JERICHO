const ARTIFACT_REQUIRED_BLOCK_TYPES = new Set([
  'action',
  'audit',
  'execution',
  'readiness',
  'review',
  'validation',
  'gate',
  'terminal-readiness',
  'milestone',
]);

const PRODUCT_LIFECYCLE_PATTERNS = [
  ['requirements', /\b(requirement|requirements|define|scope|plan)\b/i],
  ['architecture_design', /\b(design|spec|architecture)\b/i],
  ['implementation', /\b(implement|build|ship|feature|experiment)\b/i],
  ['integration', /\b(integrat|instrument|data\/state|dashboard|tracking)\b/i],
  ['qa', /\b(test|acceptance|audit|validate|validation)\b/i],
  ['beta_feedback', /\b(beta|feedback)\b/i],
  ['release', /\b(release|launch|publish|rollout)\b/i],
  ['post_release_review', /\b(review|retention|handoff|post-release|durability)\b/i],
];

const COMMERCIAL_STAGE_PATTERNS = [
  ['target_criteria', /\b(criteria|buyer profile|readiness criteria|qualification)\b/i],
  ['target_list', /\b(prospect list|target list|shortlist|stakeholder map|agency and coalition target list)\b/i],
  ['capital_memo', /\b(capital memo|budget memo|proposal memo|pricing memo|diligence packet)\b/i],
  ['outreach_batch', /\b(outreach|meeting requests|submit outreach|deliver outreach batch)\b/i],
  ['response_tracking', /\b(reply status|response|tracking|log)\b/i],
  ['discovery', /\b(discovery|call notes|meeting|partner discovery)\b/i],
  ['proposal_terms', /\b(proposal|terms|pricing|memorandum|contract|agreement)\b/i],
  ['decision_gate', /\b(gate|readiness|viability|deployment readiness)\b/i],
  ['follow_up_contingency', /\b(follow-up|follow up|risk|contingency|reconcile)\b/i],
];

function compareBlocks(left, right) {
  const leftDay = String(left?.dayKey || left?.date || '');
  const rightDay = String(right?.dayKey || right?.date || '');
  if (leftDay !== rightDay) return leftDay.localeCompare(rightDay);
  const leftStart = String(left?.startISO || left?.start || '');
  const rightStart = String(right?.startISO || right?.start || '');
  if (leftStart !== rightStart) return leftStart.localeCompare(rightStart);
  return String(left?.id || '').localeCompare(String(right?.id || ''));
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isArtifactRequired(block) {
  return ARTIFACT_REQUIRED_BLOCK_TYPES.has(String(block?.blockType || '').trim().toLowerCase());
}

function buildArtifactName(block) {
  return (
    String(block?.producesArtifact || '').trim()
    || String(block?.expectedOutput || '').trim()
    || String(block?.title || '').trim()
    || 'Unnamed artifact'
  );
}

function buildArtifactId(block) {
  return `artifact:${String(block?.id || 'unknown')}`;
}

function buildAcceptanceCriteria(block) {
  if (block?.gateCriteria?.acceptanceCriteria) {
    return block.gateCriteria.acceptanceCriteria;
  }
  if (block?.passEvidence) {
    return String(block.passEvidence);
  }
  if (block?.expectedOutput) {
    return `Expected output delivered: ${String(block.expectedOutput)}`;
  }
  return 'Completed evidence package recorded for downstream use.';
}

function latestPriorArtifact(artifacts, predicate) {
  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    const artifact = artifacts[index];
    if (predicate(artifact)) {
      return artifact;
    }
  }
  return null;
}

function collectLaneArtifacts(artifactTimeline, laneId) {
  return artifactTimeline.filter((artifact) => artifact?.laneId === laneId);
}

function deriveLifecycleStage(block) {
  if (block?.lifecycleStage) return block.lifecycleStage;
  const laneFamily = String(block?.executionContext?.laneFamily || '');
  if (laneFamily !== 'product_software') return null;
  const text = [block?.title, block?.expectedOutput, block?.derivationReason].filter(Boolean).join(' ');
  for (const [stage, pattern] of PRODUCT_LIFECYCLE_PATTERNS) {
    if (pattern.test(text)) return stage;
  }
  if (String(block?.blockType || '').toLowerCase() === 'review') return 'post_release_review';
  return null;
}

function deriveCommercialStage(block) {
  if (block?.commercialStage) return block.commercialStage;
  if (block?.isExternalBdMechanic !== true && block?.isExternalStakeholderTouchpoint !== true) {
    return null;
  }
  const text = [block?.title, block?.expectedOutput, block?.producesArtifact].filter(Boolean).join(' ');
  for (const [stage, pattern] of COMMERCIAL_STAGE_PATTERNS) {
    if (pattern.test(text)) return stage;
  }
  return 'follow_up_contingency';
}

function buildGateCriteria(block, outputArtifact) {
  const blockType = String(block?.blockType || '').trim().toLowerCase();
  if (blockType !== 'gate' && blockType !== 'terminal-readiness') {
    return null;
  }
  const phaseLabel = String(block?.phaseLabel || '').trim() || 'phase';
  const laneLabel = String(block?.laneLabel || 'lane').trim();
  const terminal = blockType === 'terminal-readiness';
  const metricName = terminal
    ? `${phaseLabel} terminal evidence completeness`
    : `${phaseLabel} gate readiness for ${laneLabel}`;
  const threshold = terminal
    ? 'terminal_evidence_packages >= 1 && unresolved_blockers = 0 && handoff_readiness_reviews_passed >= 1'
    : phaseLabel === 'P1'
      ? 'validated_proof_artifacts >= 1 && critical_blockers_open = 0'
      : 'repeatability_artifacts >= 1 && operating_readiness_reviews_passed >= 1';
  const acceptanceCriteria = terminal
    ? `Terminal evidence for ${laneLabel} is complete, approved by ${block?.owner || 'owner'}, and mapped to the declared success standard.`
    : String(block?.passCriteria || '').trim()
      || `Gate criteria satisfied for ${laneLabel}.`;
  return {
    metricName,
    threshold,
    evidenceArtifactId: outputArtifact?.artifactId || null,
    owner: block?.owner || null,
    passBranch: block?.passBranch || (terminal ? 'advance:terminal-review' : `advance:${phaseLabel}`),
    failBranch: block?.failBranch || `hold:${phaseLabel}:remediate`,
    acceptanceCriteria,
  };
}

function rewriteDecorativeUsingTitle(title, consumedArtifacts) {
  const raw = String(title || '');
  if (consumedArtifacts.length > 0) {
    return raw;
  }
  return raw.replace(/\s+using\s+(.+?)\s+for\s+the\s+/i, ' focused on $1 for the ');
}

function resolveDependencyArtifacts(block, artifactTimeline, artifactById) {
  const resolved = [];
  const laneId = block?.laneId || null;
  const dependencies = Array.isArray(block?.dependsOn) ? block.dependsOn : [];

  const pushArtifact = (artifact) => {
    if (!artifact?.artifactId) return;
    if (resolved.some((entry) => entry.artifactId === artifact.artifactId)) return;
    resolved.push(artifact);
  };

  for (const dependency of dependencies) {
    const value = String(dependency || '').trim();
    if (!value) continue;
    if (value.startsWith('phase:')) {
      const phaseLabel = value.slice(6);
      const artifact = latestPriorArtifact(artifactTimeline, (entry) => (
        entry?.laneId === laneId && entry?.phase === phaseLabel
      ));
      if (artifact) {
        pushArtifact(artifact);
        continue;
      }
      const crossLaneFallback = latestPriorArtifact(artifactTimeline, (entry) => entry?.phase === phaseLabel);
      if (crossLaneFallback) {
        pushArtifact(crossLaneFallback);
      }
      continue;
    }
    if (value.startsWith('lane:')) {
      const dependencyLaneId = value.slice(5).split(':')[0];
      const artifact = latestPriorArtifact(artifactTimeline, (entry) => entry?.laneId === dependencyLaneId);
      if (artifact) pushArtifact(artifact);
      continue;
    }
    if (artifactById.has(value)) {
      pushArtifact(artifactById.get(value));
    }
  }

  if (resolved.length === 0) {
    const artifact = latestPriorArtifact(artifactTimeline, (entry) => entry?.laneId === laneId);
    if (artifact) {
      pushArtifact(artifact);
    }
  }

  return resolved;
}

function buildPhaseExitCriteriaByPhase(artifacts, blocksById) {
  const grouped = { P1: [], P2: [], P3: [] };
  for (const artifact of artifacts) {
    const block = blocksById.get(artifact?.producerBlockId) || null;
    const gateCriteria = block?.gateCriteria || null;
    const phaseLabel = String(artifact?.phase || '').trim();
    if (!grouped[phaseLabel]) continue;
    if (!gateCriteria) continue;
    grouped[phaseLabel].push({
      laneId: artifact.laneId || null,
      laneTitle: block?.laneLabel || null,
      gateBlockId: artifact.producerBlockId,
      metricName: gateCriteria.metricName,
      threshold: gateCriteria.threshold,
      evidenceArtifactId: gateCriteria.evidenceArtifactId,
      owner: gateCriteria.owner,
      passBranch: gateCriteria.passBranch,
      failBranch: gateCriteria.failBranch,
      acceptanceCriteria: gateCriteria.acceptanceCriteria,
    });
  }
  return grouped;
}

export function applyArtifactDependencyIntegrity(blocks = []) {
  const ordered = [...blocks].sort(compareBlocks);
  const artifactTimeline = [];
  const artifactById = new Map();
  const enriched = [];
  const issues = [];

  for (const originalBlock of ordered) {
    const block = { ...originalBlock };
    const outputArtifact = isArtifactRequired(block)
      ? {
          artifactId: buildArtifactId(block),
          artifactName: buildArtifactName(block),
          producerBlockId: block.id,
          owner: block.owner || null,
          phase: block.phaseLabel || null,
          laneId: block.laneId || null,
          consumedByBlockIds: [],
          acceptanceCriteria: buildAcceptanceCriteria(block),
          passEvidence: block.passEvidence || null,
          status: 'forecast',
        }
      : null;

    const consumedArtifacts = resolveDependencyArtifacts(block, artifactTimeline, artifactById);
    const consumedArtifactIds = consumedArtifacts.map((artifact) => artifact.artifactId);
    const dependsOnBlockIds = consumedArtifacts
      .map((artifact) => artifact.producerBlockId)
      .filter(Boolean);

    for (const artifact of consumedArtifacts) {
      artifact.consumedByBlockIds.push(block.id);
    }

    block.outputArtifact = outputArtifact;
    block.outputArtifactId = outputArtifact?.artifactId || null;
    block.outputArtifactJustification = outputArtifact ? null : 'No durable artifact required for this block class.';
    block.consumedArtifactIds = consumedArtifactIds;
    block.dependsOnBlockIds = dependsOnBlockIds;
    block.lifecycleStage = deriveLifecycleStage(block);
    block.commercialStage = deriveCommercialStage(block);
    block.riskFlag = block.isExternalStakeholderTouchpoint === true || block.isExpansionAction === true;
    block.title = rewriteDecorativeUsingTitle(block.title, consumedArtifacts);
    block.displayTitle = rewriteDecorativeUsingTitle(block.displayTitle || block.title, consumedArtifacts);
    block.gateCriteria = buildGateCriteria(block, outputArtifact);

    if (outputArtifact) {
      artifactTimeline.push(outputArtifact);
      artifactById.set(outputArtifact.artifactId, outputArtifact);
    }

    if (String(originalBlock?.title || '').includes(' using ') && consumedArtifactIds.length === 0) {
      issues.push({
        type: 'decorative_using_rewritten',
        blockId: block.id,
      });
    }

    if (consumedArtifactIds.length === 0 && Array.isArray(block.dependsOn) && block.dependsOn.length > 0) {
      issues.push({
        type: 'unresolved_dependency',
        blockId: block.id,
        dependsOn: block.dependsOn,
      });
    }

    enriched.push(block);
  }

  const artifactRegistry = Object.fromEntries(
    artifactTimeline.map((artifact) => [
      artifact.artifactId,
      {
        artifactId: artifact.artifactId,
        artifactName: artifact.artifactName,
        producerBlockId: artifact.producerBlockId,
        owner: artifact.owner,
        phase: artifact.phase,
        laneId: artifact.laneId,
        consumedByBlockIds: [...artifact.consumedByBlockIds],
        acceptanceCriteria: artifact.acceptanceCriteria,
        passEvidence: artifact.passEvidence,
        status: artifact.status,
      },
    ])
  );

  const blocksById = new Map(enriched.map((block) => [block.id, block]));
  const phaseExitCriteriaByPhase = buildPhaseExitCriteriaByPhase(artifactTimeline, blocksById);
  const integrityReport = {
    totalBlocks: enriched.length,
    totalArtifacts: artifactTimeline.length,
    unresolvedConsumedArtifacts: issues.filter((issue) => issue.type === 'unresolved_dependency').length,
    gateCriteriaCoverage: enriched.filter((block) => block.blockType === 'gate' || block.blockType === 'terminal-readiness')
      .every((block) => block.gateCriteria?.metricName && block.gateCriteria?.threshold && block.gateCriteria?.evidenceArtifactId)
      ? 'complete'
      : 'incomplete',
    phaseExitCriteriaCoverage: Object.values(phaseExitCriteriaByPhase).every((items) => Array.isArray(items) && items.length > 0)
      ? 'complete'
      : 'incomplete',
    decorativeUsingRewrites: issues.filter((issue) => issue.type === 'decorative_using_rewritten').length,
    requiredArtifactCoverage: enriched
      .filter((block) => isArtifactRequired(block))
      .every((block) => block.outputArtifact?.artifactId)
      ? 'complete'
      : 'incomplete',
  };

  return {
    blocks: enriched.sort(compareBlocks),
    artifactRegistry,
    integrityReport,
    phaseExitCriteriaByPhase,
  };
}

export default applyArtifactDependencyIntegrity;
