const REASON_TEXT = {
  over_weighted_domain: 'This area is already heavily represented in recent cycles.',
  under_weighted_domain: 'This area is underrepresented and needs attention.',
  deferred_by_compression: 'Deferred to protect capacity and keep this cycle realistic.',
  dropped_by_compression: 'Dropped from this cycle to prevent overload.',
  above_cycle_cap: "Above this cycle's task cap; kept but inactive this round.",
  deadline_priority: 'Prioritized because its deadline is approaching.',
  identity_priority: 'Prioritized because it reinforces your target identity.'
};

export function explainReasonCode(code) {
  if (!code) return 'Reason unavailable';
  return REASON_TEXT[code] || `Reason: ${code}`;
}

export function explainTaskReasons(task) {
  const decision = task?.decision;
  const governanceEligible = !!task?.governanceEligible;
  let headline = null;

  if (decision === 'keep' && governanceEligible) {
    headline = 'Scheduled for this cycle.';
  } else if (decision === 'keep' && !governanceEligible) {
    headline = 'Kept, but inactive this cycle due to load limits.';
  } else if (decision === 'defer') {
    headline = 'Deferred to a later cycle to protect capacity.';
  } else if (decision === 'drop') {
    headline = 'Dropped from the current plan.';
  }

  const details = Array.isArray(task?.reasons) ? task.reasons.map((r) => explainReasonCode(r)) : [];

  return { headline, details };
}

export const zionModeSpec = {
  purpose:
    'Zion Mode schedules and executes GSPD output over time: minimal surface, dense structure, legible without a tutorial.',
  visualSystem: {
    primitives: ['dot (state)', 'line (dependency)', 'block (time)', 'atom (task unit)', 'row (discipline)', 'column (horizon/day)'],
    palette: {
      base: 'neutral grays for backgrounds/frames',
      accent: 'single accent (e.g., cyan) for priority/on-track',
      drift: 'muted amber for drift',
      offTrack: 'muted red for off-track',
      discipline: 'low-saturation functional tints only'
    },
    type: {
      sizes: ['lg for Identity/Objective headers', 'sm for labels/metrics'],
      style: 'monoweight, high contrast, no decorative faces'
    },
    spacing: '8px grid, more whitespace around IdentityBar/ObjectiveCard; dense but aligned grids elsewhere'
  },
  layout: {
    today: {
      identityBar: 'Orb on left + one-line status; optional mini trend dots.',
      objectiveCard:
        'One-line objective, weight badge, status dot, next-step time; actions: Commit (primary), Reveal (secondary).',
      disciplineGrid:
        'Grid of DisciplineTiles; rows=domains, columns=horizon (Today, Week, Month, Goal); label + status dot + metric + optional delta. Collapsible/compact by default.',
      blockColumn:
        'Right side or overlay on narrow screens; vertical hours with TimeBlocks tinted by discipline. Primary objective uses accent border/stripe only.'
    },
    week: {
      identityStrip: 'Compact IdentityBar with week alignment score + mini trend dots.',
      grid: 'WeekGrid with 7 BlockColumns; height = duration; optional discipline lane tinting.',
      streakRibbon: 'Row of DisciplineTile variants or StreakDots. Hover highlights linked blocks.'
    },
    month: {
      identity: 'IdentityBar variant summarizing month drift/alignment.',
      matrix: 'MonthMatrix of 5–6 rows; each day shows streak dots, tiny load bar, missed markers.',
      pattern: 'PatternBar strip with stacked bars per week by discipline plus inline inflection alerts.'
    }
  },
  components: {
    Orb: { props: "state: 'on-track'|'drifting'|'off-track', label?, delta?", variants: 'sm/md/lg; ring thickness = urgency' },
    IdentityBar: { props: '{ state, message, trend? }', layout: 'Orb + one-line text + optional trend dots' },
    ObjectiveCard: { props: '{ title, weight, status, nextStepTime }', actions: 'Commit, Reveal' },
    DisciplineTile: {
      props: '{ domain, horizon, label, state, metric, delta?, todayLink? }',
      behavior: 'Opens RevealPanel with history/metrics + “Insert Block” shortcut'
    },
    GridHeaders: { labels: 'Domain rows; horizon columns = Today/Week/Month/Goal' },
    TimeBlock: { props: '{ label, discipline, start, end, priority?, state }', visual: 'fill = discipline tint, accent stripe for priority' },
    BlockColumn: { props: '{ date, blocks[] }', behavior: 'renders vertical axis; hover detail' },
    WeekGrid: { props: '{ weekStart, days[] }', layout: '7 BlockColumns' },
    MonthMatrix: { props: '{ month, dayData[] }', contents: 'streak dots, load bar, missed flag per day' },
    PatternBar: { props: '{ weeks[] }', visual: 'stacked bars per week by discipline' },
    StreakDots: { props: '{ streakLength, misses[] }' },
    DriftAlert: { props: "{ type: 'miss'|'overload'|'imbalance', message }" },
    RevealPanel: { purpose: 'slide-over details/dependencies/metrics/history with scheduling shortcut' },
    CommitBar: { purpose: 'primary CTA + duration selector + confirm' }
  },
  interactions: {
    reveal: [
      'Hover/tap Orb → alignment trend + short explanation',
      'Tap ObjectiveCard → dependencies + suggested next atoms',
      'Tap DisciplineTile → RevealPanel with history/metrics + Insert Block prefilled',
      'Hover TimeBlock → detail card + chain lines to linked blocks/objective',
      'View toggle Today/Week/Month keeps grammar; only density/aggregation shifts'
    ],
    commit: [
      'ObjectiveCard Commit → quick composer (duration, start, discipline) → creates TimeBlock linked to objective',
      'DisciplineTile Insert Block → schedules minimum viable block for that habit with one confirm',
      'Tap TimeBlock → toggle complete/missed/pending',
      'Empty slot click → create TimeBlock prefilled from context'
    ],
    navigation: [
      'Keyboard: 1=Today, 2=Week, 3=Month; arrows move focus; Space commits/toggles focused item; ESC closes RevealPanel'
    ],
    density: 'Week/Month compress vertically; swap text for dots/bars; details always on hover/tap.',
    feedback: [
      'Identity drift → ring pulse + amber label',
      'Objective-linked block → thin accent line on hover from ObjectiveCard to block',
      'Completed habit = filled dot; missed = hollow; pending = neutral'
    ]
  },
  buildOrder: [
    'IdentityBar + ObjectiveCard skeleton',
    'Discipline periodic grid (GridHeaders + DisciplineTiles)',
    'Today BlockColumn with commit/reveal hooks',
    'WeekGrid reusing BlockColumn/TimeBlock',
    'MonthMatrix + PatternBar using the same primitives',
    'Wire GSPD data so Zion schedules/updates, flows completion back into alignment calculations'
  ]
};

// Control Room Copilot specification
export const controlRoomCopilotSpec = {
  role: 'Single bot that blends navigation (Operator) and analysis (Analyst) in one thread; intent inferred from user sentences.',
  stateShape: {
    view: 'today | week | month | integrity',
    timeRange: { start: 'ISO string', end: 'ISO string' },
    objective: {
      title: 'string',
      nextBlock: 'ISO datetime',
      priority: 'high | medium | low',
      status: 'in_progress | pending | completed'
    },
    disciplines: [
      { name: 'Health', todayMinutes: 0, weekMinutes: 0, streak: 0, drift: 0 }
      // additional disciplines...
    ],
    blocks: [
      {
        id: 'b1',
        discipline: 'Craft',
        label: 'Ship',
        start: 'ISO datetime',
        end: 'ISO datetime',
        completed: false,
        linkedToObjective: false
      }
    ],
    integrity: {
      alignmentScore: 0,
      driftIndex: 0,
      pendingTasks: 0,
      completedTasks: 0,
      streakDays: 0
    }
  },
  navigationCommands: [
    { intent: 'show today', action: 'setView("today")' },
    { intent: 'zoom week', action: 'setView("week")' },
    { intent: 'open month', action: 'setView("month")' },
    { intent: 'integrity', action: 'setView("integrity")' },
    { intent: 'insert block', action: 'addBlock({ ... })' },
    { intent: 'complete block', action: 'completeBlock(id)' },
    { intent: 'shift blocks', action: 'shiftBlocks(...)' }
  ],
  analysisCapabilities: [
    'Assess drift sources by discipline (under/over scheduled)',
    'Check streak breaks and density vs available time',
    'Compare objective linkage to actual blocks',
    'Flag overload or idle gaps',
    'Recommend 1–3 precise adjustments (add/move blocks, rebalance disciplines)'
  ],
  responsePattern:
    'If navigation requested, execute minimal actions and confirm. If analysis requested, summarize state in 1–3 sentences, name primary risk, and give 1–3 concrete adjustments. Combine nav + analysis in one reply when both are implied.',
  audio:
    'Same reasoning path; output can be sent to TTS for narration of schedule or context—no extra logic layer.',
  constraint: 'One bot, one shared ControlRoomState, one conversation thread; nav and analysis share state/action set.'
};

export default {
  explainReasonCode,
  explainTaskReasons,
  zionModeSpec
};
