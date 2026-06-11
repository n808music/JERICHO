import { resolveInitiativeDisplay } from './resolveInitiativeDisplay.js';

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function stripOperationEndgamePhrasing(title) {
  return normalizeText(title)
    .replace(/\bfor Operation Endgame [^,]+/gi, '')
    .replace(/\bin P\d [^,]+ lane/gi, '')
    .replace(/\busing [^,]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractReviewWindow(text) {
  const match = normalizeText(text).match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}\s+(review window|operating cycle|sprint)\b/i
  );
  return match ? normalizeText(match[0]) : '';
}

function monthYearFromDayKey(dayKey) {
  const normalized = normalizeText(dayKey);
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(normalized);
  if (!match) {
    return '';
  }
  const [, year, month] = match;
  const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${monthLabels[Number(month) - 1] || month} ${year}`;
}

function currentWindowLabel(block, hierarchy = {}) {
  const explicit = normalizeText(hierarchy?.operatingCycle || hierarchy?.sprint || hierarchy?.currentWindow);
  if (explicit) {
    return explicit;
  }
  return monthYearFromDayKey(block?.startDayKey || String(block?.start || '').slice(0, 10));
}

function defaultArtifact(block, initiativeDisplay) {
  return (
    normalizeText(block?.expectedOutput || block?.artifactLabel || block?.outputLabel || block?.deliverableLabel) ||
    (initiativeDisplay?.initiative && initiativeDisplay.initiative !== initiativeDisplay.lane
      ? `${initiativeDisplay.initiative} progress note`
      : 'Progress note or blocker report')
  );
}

function onboardingBreakdown(block, hierarchy, initiativeDisplay) {
  return {
    intent: 'Test Jericho onboarding and login behavior enough to clear the current launch blocker.',
    plainAction: 'Run the product like a user and verify the onboarding path works end to end.',
    steps: [
      'Open the app as a user.',
      'Sign in and confirm access succeeds.',
      'Refresh and verify profile restoration still lands in the correct context.',
      'Confirm the expected goal or initiative loads without a blocker.',
      'Record any blocker that prevents activation or use.',
    ],
    doneWhen: 'The onboarding path works without a blocker, or the blocker is clearly documented for repair.',
    artifact: defaultArtifact(block, initiativeDisplay),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'high',
  };
}

function genericBreakdown(block, hierarchy, initiativeDisplay) {
  const cleanedTitle = stripOperationEndgamePhrasing(block?.title || block?.label || block?.displayTitle);
  const initiativeName = initiativeDisplay?.initiative || hierarchy?.initiative || hierarchy?.lane || 'the current initiative';
  return {
    intent: cleanedTitle
      ? `${cleanedTitle.charAt(0).toUpperCase()}${cleanedTitle.slice(1)}.`
      : `Advance ${initiativeName} with this scheduled block.`,
    plainAction: `Move ${initiativeName} forward by completing the work described in this block and recording the result.`,
    steps: [
      'Review the formal title and hierarchy for context.',
      'Complete the concrete work needed to move this block forward.',
      'Capture the result, blocker, or evidence produced by the work.',
    ],
    doneWhen: 'The scheduled work is completed or the blocking condition is clearly recorded.',
    artifact: defaultArtifact(block, initiativeDisplay),
    originalWindow: extractReviewWindow(block?.title || block?.label),
    currentWindow: currentWindowLabel(block, hierarchy),
    confidence: 'inferred',
  };
}

export function resolveBlockPlainLanguage(block = {}, context = {}) {
  const hierarchy = context?.hierarchy || {};
  const initiativeDisplay = resolveInitiativeDisplay(block, {
    initiative: hierarchy?.initiative,
    lane: hierarchy?.lane,
  });
  const title = normalizeText(block?.title || block?.label || block?.displayTitle).toLowerCase();

  if (
    /(onboarding|sign-in|sign in|login|log in|profile restoration|launch blocker)/i.test(title) ||
    (title.includes('app platform') && title.includes('onboarding'))
  ) {
    return onboardingBreakdown(block, hierarchy, initiativeDisplay);
  }

  return genericBreakdown(block, hierarchy, initiativeDisplay);
}

export default resolveBlockPlainLanguage;
