// Deterministic pacing controller (stub).
export function selectPacingMode({ integrity = 0, averagePressure = 0, recentCompletionRate = 0 }) {
  let mode = 'build';
  let maxTasksDelta = 0;
  let difficultyBias = 0;

  if (integrity < 40 || averagePressure > 0.6 || recentCompletionRate < 0.4) {
    mode = 'stabilize';
    maxTasksDelta = -1;
    difficultyBias = -0.5;
  } else if (integrity > 70 && averagePressure < 0.6 && recentCompletionRate >= 0.6) {
    mode = 'advance';
    maxTasksDelta = 1;
    difficultyBias = 0.5;
  } else {
    mode = 'build';
    maxTasksDelta = 0;
    difficultyBias = 0;
  }

  return { mode, maxTasksDelta, difficultyBias };
}
