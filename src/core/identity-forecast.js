// Simple deterministic identity trajectory forecaster (stub).
export function forecastIdentityTrajectory({ history = [], horizonCycles = 5 }) {
  const recent = history.slice(-5);
  const integritySeries = recent.map((s) => s?.integrity?.score ?? 0);
  const pressureSeries = recent.map((s) => averagePressure(s?.capabilities || []));

  const integritySlope = slope(integritySeries);
  const pressureSlope = slope(pressureSeries);

  const startIntegrity = integritySeries.length ? integritySeries[integritySeries.length - 1] : 0;
  const startPressure = pressureSeries.length ? pressureSeries[pressureSeries.length - 1] : 0;

  const projectedIntegrity = clamp(startIntegrity + integritySlope * horizonCycles, 0, 100);
  const projectedAveragePressure = clamp(startPressure + pressureSlope * horizonCycles, 0, 1);

  return { projectedIntegrity, projectedAveragePressure };
}

export function classifyRiskFromForecast(forecast) {
  const integ = forecast.projectedIntegrity ?? 0;
  const pressure = forecast.projectedAveragePressure ?? 0;
  if (integ < 30 && pressure > 0.6) return 'burnout';
  if (integ >= 70 && pressure < 0.5) return 'growth';
  if (integ >= 40 && integ < 70 && pressure < 0.7) return 'plateau';
  return 'recovery';
}

function averagePressure(caps = []) {
  if (!caps.length) return 0;
  return caps.reduce((acc, c) => acc + (c.pressureScore || 0), 0) / caps.length;
}

function slope(arr = []) {
  if (arr.length < 2) return 0;
  return arr[arr.length - 1] - arr[0];
}

function clamp(val, min, max) {
  const num = Number(val) || 0;
  return Math.min(Math.max(num, min), max);
}
