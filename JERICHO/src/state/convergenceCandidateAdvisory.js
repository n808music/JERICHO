/**
 * Convergence Candidate Advisory Builder (Task 6)
 *
 * Pure function that transforms pending convergence detection questions into
 * advisory panel UI data for operator decision-making.
 *
 * Input: Full identity state containing convergenceDetectionState
 * Output: Advisory object (or null if no questions)
 *
 * No side effects, no mutations. Safe to call repeatedly.
 */

/**
 * Build advisory panel data from convergence detection state.
 *
 * Transforms pending convergence questions (deliverables/artifacts sharing
 * deadlines) into actionable UI data with operator response options.
 *
 * @param {object} state - Full identity state
 * @returns {object|null} Advisory object or null if no pending questions
 *
 * @example
 * const advisory = buildConvergenceCandidateAdvisory(state);
 * if (advisory) {
 *   // Render UI with advisory.title, advisory.description, advisory.questions
 *   advisory.questions.forEach(q => {
 *     // q.id, q.sourceIds, q.targetDate, q.label, q.actions
 *   });
 * }
 */
export function buildConvergenceCandidateAdvisory(state) {
  // Extract pending questions from state
  const pendingQuestions = state?.matrix?.convergenceDetectionState?.pendingQuestions || [];

  // If no pending questions, no panel to render
  if (pendingQuestions.length === 0) {
    return null;
  }

  // Transform each question into advisory item
  const advisory = {
    title: 'Convergence Detection',
    description: 'The following deliverables share deadlines without a convergence edge.',
    questions: pendingQuestions.map((question) => ({
      id: question.id,
      sourceIds: question.sourceIds,
      targetDate: question.targetDate,
      label: question.sourceIds.join(' + '), // e.g., "d1 + d2"
      actions: [
        {
          type: 'Declared',
          label: 'Yes, declare convergence',
          description: 'These items should converge',
        },
        {
          type: 'DeadlineAlignment',
          label: 'No, deadline alignment only',
          description: 'These happen to share a date, no convergence needed',
        },
      ],
    })),
  };

  return advisory;
}
