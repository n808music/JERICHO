const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toSentence(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function formatDayHeading(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey))) {
    return String(dayKey || '(no day)');
  }
  const [y, m, d] = dayKey.split('-').map((part) => Number(part));
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = WEEKDAY_SHORT[date.getUTCDay()] || '';
  return `${dow} ${dayKey}`;
}

function isoTimeToHHMM(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function formatBlockTimeLine(block) {
  const start = isoTimeToHHMM(block?.startISO);
  const end = isoTimeToHHMM(block?.endISO);
  const minutes = Number.isFinite(block?.durationMinutes) ? block.durationMinutes : null;
  let range = '';
  if (start && end) {
    range = `${start}–${end}`;
  } else if (start) {
    range = `${start}`;
  }
  if (minutes != null) {
    return range ? `${range}  (${minutes}m)` : `${minutes}m`;
  }
  return range || '(no time)';
}

function joinTags(...tags) {
  return tags.filter((t) => t != null && String(t).trim() !== '').join(' · ');
}

function asList(values) {
  if (!Array.isArray(values)) return [];
  return values.map((v) => String(v)).filter((v) => v.length > 0);
}

function parseDayKey(dayKey) {
  if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(String(dayKey))) return null;
  return new Date(`${dayKey}T12:00:00.000Z`);
}

function addYears(dayKey, years) {
  const date = parseDayKey(dayKey);
  if (!date) return null;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function summarizeMilestonePhaseBuckets(milestones, blocks, horizonStart, horizonEnd) {
  const p1End = addYears(horizonStart, 1) || '2027-12-31';
  const p2End = addYears(horizonStart, 3) || '2029-12-31';
  const buckets = [
    { key: 'P1', label: `P1 launch/proof milestones: ${String(horizonStart || '').slice(0, 4) || '2026'}–${String(p1End).slice(0, 4)}` },
    { key: 'P2', label: `P2 conversion/operating-system milestones: ${String(p1End).slice(0, 4)}–${String(p2End).slice(0, 4)}` },
    { key: 'P3', label: `P3 scale/terminal-readiness milestones: ${String(p2End).slice(0, 4)}–${String(horizonEnd || '').slice(0, 4) || '2031'}` },
  ];

  const bucketed = new Map(buckets.map((bucket) => [bucket.key, []]));
  const addItem = (bucketKey, item) => {
    if (!bucketed.has(bucketKey)) return;
    const bucket = bucketed.get(bucketKey);
    if (bucket.some((entry) => entry.date === item.date && entry.title === item.title)) return;
    bucket.push(item);
  };

  for (const milestone of milestones) {
    const date = String(milestone?.targetDate || '').trim();
    if (!date) continue;
    const item = {
      date,
      title: String(milestone?.title || '').trim() || 'Untitled milestone',
      lane: String(milestone?.laneTitle || 'Cross-lane').trim(),
    };
    if (date <= p1End) addItem('P1', item);
    else if (date <= p2End) addItem('P2', item);
    else addItem('P3', item);
  }

  const strategicBlocks = blocks.filter((block) => ['milestone', 'gate', 'terminal-readiness'].includes(String(block?.blockType || '').trim()));
  for (const block of strategicBlocks) {
    const date = String(block?.dayKey || '').trim();
    if (!date) continue;
    const item = {
      date,
      title: String(block?.displayTitle || block?.title || '').trim() || 'Untitled waypoint',
      lane: String(block?.laneTitle || 'Cross-lane').trim(),
    };
    if (date <= p1End) addItem('P1', item);
    else if (date <= p2End) addItem('P2', item);
    else addItem('P3', item);
  }

  return buckets.map((bucket) => ({
    ...bucket,
    items: (bucketed.get(bucket.key) || [])
      .sort((a, b) => `${a.date}|${a.title}`.localeCompare(`${b.date}|${b.title}`))
      .slice(0, 4),
  }));
}

function formatGateDetail(block) {
  const gate = block?.gateCriteria;
  if (!gate) return [];
  if (typeof gate === 'string') {
    return [{ text: [{ text: 'Gate: ', bold: true }, gate], margin: [0, 0, 0, 1] }];
  }
  const lines = [];
  const gateName = String(gate?.gateName || block?.gateName || '').trim();
  const purpose = String(gate?.metricName || '').trim();
  const criteria = String(gate?.acceptanceCriteria || block?.passCriteria || gate?.passCriteria || '').trim();
  const evidence = String(gate?.evidenceRequired || block?.evidenceRequired || gate?.evidenceArtifactId || '').trim();
  const threshold = String(gate?.threshold || '').trim();
  const passBranch = String(gate?.passBranch || block?.passBranch || '').trim();
  const failBranch = String(gate?.failBranch || block?.failBranch || '').trim();
  const failCriteria = String(block?.failCriteria || gate?.failCriteria || '').trim();

  if (gateName) lines.push({ text: [{ text: 'Gate: ', bold: true }, gateName], margin: [0, 0, 0, 1] });
  if (purpose) lines.push({ text: [{ text: 'Purpose: ', bold: true }, toSentence(purpose)], margin: [0, 0, 0, 1] });
  if (criteria) lines.push({ text: [{ text: 'Criteria: ', bold: true }, toSentence(criteria)], margin: [0, 0, 0, 1] });
  if (evidence) lines.push({ text: [{ text: 'Required evidence: ', bold: true }, evidence], margin: [0, 0, 0, 1] });
  if (threshold) lines.push({ text: [{ text: 'Pass threshold: ', bold: true }, threshold], margin: [0, 0, 0, 1] });
  if (passBranch) lines.push({ text: [{ text: 'If passed: ', bold: true }, passBranch], margin: [0, 0, 0, 1] });
  if (failCriteria || failBranch) {
    lines.push({
      text: [
        { text: 'If held/failed: ', bold: true },
        [toSentence(failCriteria), failBranch].filter(Boolean).join(' '),
      ],
      margin: [0, 0, 0, 1],
    });
  }
  return lines;
}

function formatDependencyAuditSummary(report) {
  const audit = report?.dependencyAudit;
  if (!audit) return [];
  const counts = audit.failureCounts || {};
  return [
    {
      text: [
        `Dependency audit: ${audit.status}`,
        `Blocks checked: ${audit.blocksChecked}`,
        `Artifacts checked: ${audit.artifactsChecked}`,
        `Future block refs: ${counts.FUTURE_BLOCK_DEPENDENCY || 0}`,
        `Future artifact refs: ${counts.FUTURE_ARTIFACT_CONSUMPTION || 0}`,
        `Missing refs: ${(counts.MISSING_DEPENDENCY_BLOCK || 0) + (counts.MISSING_CONSUMED_ARTIFACT || 0)}`,
        `Circular refs: ${counts.CIRCULAR_DEPENDENCY || 0}`,
      ].join(' · '),
      margin: [0, 0, 0, 10],
      color: audit.status === 'PASS' ? '#355b3f' : '#8a2d2d',
    },
  ];
}

function buildBlockStack(block, options = {}) {
  const titleText = block?.displayTitle || block?.title || block?.id || '(untitled block)';
  const riskFlag = block?.riskFlag === true;
  const tags = joinTags(block?.laneTitle, block?.phaseLabel, block?.blockType);
  const expected = block?.expectedOutput ? String(block.expectedOutput) : '';
  const produces = block?.producesArtifact;
  const outputArtifactId = block?.outputArtifactId || block?.outputArtifact || null;
  const outputArtifactJustification = block?.outputArtifactJustification || null;
  const consumed = asList(block?.consumedArtifactIds);
  const dependsOn = asList(block?.dependsOnBlockIds);

  const lines = [];
  lines.push({
    text: [
      { text: formatBlockTimeLine(block), bold: true },
      { text: '  ' },
      { text: titleText, bold: true },
      ...(riskFlag ? [{ text: '  [risk]', color: '#a33', bold: true }] : []),
    ],
    margin: [0, 4, 0, 1],
  });
  if (tags) {
    lines.push({ text: tags, italics: true, color: '#555', margin: [0, 0, 0, 1] });
  }
  if (expected) {
    lines.push({ text: [{ text: 'Output: ', bold: true }, expected], margin: [0, 0, 0, 1] });
  }
  if (block?.owner) {
    lines.push({ text: [{ text: 'Owner: ', bold: true }, String(block.owner)], margin: [0, 0, 0, 1] });
  }
  if (produces && outputArtifactId) {
    const justified = outputArtifactJustification
      ? `${outputArtifactId} — ${outputArtifactJustification}`
      : outputArtifactId;
    lines.push({ text: [{ text: 'Produces: ', bold: true }, justified], margin: [0, 0, 0, 1] });
  }
  if (consumed.length > 0) {
    lines.push({ text: [{ text: 'Consumes: ', bold: true }, consumed.join(', ')], margin: [0, 0, 0, 1] });
  }
  if (dependsOn.length > 0) {
    const resolved = options.blockTitleById
      ? dependsOn.map((id) => {
          const title = options.blockTitleById.get(id);
          return title ? `${id} (${title})` : id;
        })
      : dependsOn;
    lines.push({
      text: [{ text: 'Depends on: ', bold: true }, resolved.join(', ')],
      margin: [0, 0, 0, 1],
    });
  }
  lines.push(...formatGateDetail(block));

  return { stack: lines, margin: [10, 0, 0, 6] };
}

function groupBlocksByDay(blocks = []) {
  const groups = new Map();
  for (const block of blocks) {
    const key = block?.dayKey || '(no day)';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(block);
  }
  const sortedDays = Array.from(groups.keys()).sort();
  for (const day of sortedDays) {
    groups.get(day).sort((a, b) => {
      const left = String(a?.startISO || a?.title || '').trim();
      const right = String(b?.startISO || b?.title || '').trim();
      return left.localeCompare(right);
    });
  }
  return { sortedDays, groups };
}

export function buildFullSchedulePdfDocDefinition(bundle) {
  if (!bundle) {
    return null;
  }
  const plan = bundle.masterPlan || {};
  const meta = bundle.meta || {};
  const blocks = Array.isArray(bundle.fullHorizonBlocks) ? bundle.fullHorizonBlocks : [];
  const milestones = Array.isArray(bundle.milestones) ? [...bundle.milestones] : [];

  const blockTitleById = new Map();
  for (const block of blocks) {
    if (block?.id) {
      blockTitleById.set(block.id, block.displayTitle || block.title || block.id);
    }
  }

  const content = [];

  content.push({
    text: plan.title || 'Master Plan',
    style: 'planTitle',
    margin: [0, 0, 0, 4],
  });
  content.push({
    text: 'Full schedule',
    style: 'subTitle',
    margin: [0, 0, 0, 8],
  });
  if (plan.coreMission) {
    content.push({ text: plan.coreMission, italics: true, margin: [0, 0, 0, 6] });
  }
  if (plan.northStarOutcome) {
    content.push({ text: [{ text: 'North star: ', bold: true }, plan.northStarOutcome], margin: [0, 0, 0, 6] });
  }

  const horizonStart = plan.horizonStart || meta?.range?.startDayKey || null;
  const horizonEnd = plan.horizonEnd || plan.fullHorizonEndDayKey || meta?.range?.endDayKey || null;
  if (horizonStart || horizonEnd) {
    content.push({
      text: [
        { text: 'Horizon: ', bold: true },
        `${horizonStart || '?'} → ${horizonEnd || '?'}`,
      ],
      margin: [0, 0, 0, 4],
    });
  }
  content.push({
    text: [
      { text: 'Generated: ', bold: true },
      meta.extractedAtISO || new Date().toISOString(),
    ],
    margin: [0, 0, 0, 4],
  });
  content.push({
    text: [{ text: 'Blocks: ', bold: true }, String(blocks.length)],
    margin: [0, 0, 0, 4],
  });
  content.push(...formatDependencyAuditSummary(bundle.integrityReport || null));

  if (milestones.length > 0 || blocks.length > 0) {
    const milestoneBuckets = summarizeMilestonePhaseBuckets(milestones, blocks, horizonStart, horizonEnd);
    content.push({ text: 'Key milestones', style: 'sectionHeading', margin: [0, 0, 0, 4] });
    for (const bucket of milestoneBuckets) {
      if (!bucket.items.length) continue;
      content.push({ text: bucket.label, bold: true, margin: [0, 0, 0, 2] });
      content.push({
        ul: bucket.items.map((item) => `${item.date} · ${item.lane} · ${item.title}`),
        margin: [0, 0, 0, 6],
      });
    }
    content.push({ text: '', margin: [0, 0, 0, 4] });
  }

  if (blocks.length === 0) {
    content.push({
      text: 'No blocks in this schedule.',
      italics: true,
      color: '#777',
      margin: [0, 12, 0, 0],
    });
  } else {
    const { sortedDays, groups } = groupBlocksByDay(blocks);
    for (const day of sortedDays) {
      content.push({
        text: formatDayHeading(day),
        style: 'dayHeading',
        margin: [0, 10, 0, 2],
      });
      content.push({
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#bbb' },
        ],
        margin: [0, 0, 0, 4],
      });
      for (const block of groups.get(day)) {
        content.push(buildBlockStack(block, { blockTitleById }));
      }
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { fontSize: 9, lineHeight: 1.2 },
    styles: {
      planTitle: { fontSize: 18, bold: true },
      subTitle: { fontSize: 11, color: '#555' },
      dayHeading: { fontSize: 12, bold: true, color: '#222' },
      sectionHeading: { fontSize: 11, bold: true, color: '#222' },
    },
    footer: (currentPage, pageCount) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      margin: [0, 16, 0, 0],
      fontSize: 8,
      color: '#888',
    }),
    content,
  };
}

export function buildFullSchedulePdfFilename(planTitle, dateOverride = null) {
  const slug = String(planTitle || 'master-plan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const today = dateOverride || new Date().toISOString().slice(0, 10);
  return `jericho-${slug || 'master-plan'}-full-schedule-${today}.pdf`;
}
