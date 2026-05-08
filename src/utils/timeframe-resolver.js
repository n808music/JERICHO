/**
 * Timeframe resolution utility
 * Resolves natural language timeframes to structured deadline data
 * Used by Agent 1 (goal structure), Agent 3 (deadline recalculation), Agent 7 (recovery)
 */

export function resolveTimeframe(timeframe) {
  const input = timeframe.toLowerCase().trim();
  const now = new Date();

  // Relative months — "by June", "by April"
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                      'july', 'august', 'september', 'october', 'november', 'december'];
  for (let i = 0; i < monthNames.length; i++) {
    if (input.includes(monthNames[i])) {
      const year = now.getMonth() >= i ? now.getFullYear() + 1 : now.getFullYear();
      const deadline = new Date(year, i + 1, 0); // last day of that month
      return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'HIGH' };
    }
  }

  // Relative duration — "in 3 months", "in 6 weeks"
  const monthMatch = input.match(/in (\d+) months?/);
  if (monthMatch) {
    const deadline = new Date(now);
    deadline.setMonth(deadline.getMonth() + parseInt(monthMatch[1]));
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'HIGH' };
  }

  const weekMatch = input.match(/in (\d+) weeks?/);
  if (weekMatch) {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + parseInt(weekMatch[1]) * 7);
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'HIGH' };
  }

  // This year
  if (input.includes('this year') || input.includes('end of year')) {
    const deadline = new Date(now.getFullYear(), 11, 31);
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'MED' };
  }

  // Seasonal
  if (input.includes('summer')) {
    const deadline = new Date(now.getFullYear(), 5, 21);
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'MED' };
  }
  if (input.includes('fall') || input.includes('autumn')) {
    const deadline = new Date(now.getFullYear(), 8, 22);
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'MED' };
  }
  if (input.includes('spring')) {
    const deadline = new Date(now.getFullYear(), 2, 20);
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'MED' };
  }
  if (input.includes('winter')) {
    const deadline = new Date(now.getFullYear(), 11, 21);
    return { targetDeadline: deadline.toISOString(), deadlineConfidence: 'MED' };
  }

  // Vague — soon, eventually
  if (input.includes('soon') || input.includes('eventually')) {
    return { targetDeadline: null, deadlineConfidence: 'LOW' };
  }

  // Could not resolve
  return { targetDeadline: null, deadlineConfidence: 'LOW' };
}