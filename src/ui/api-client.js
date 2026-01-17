const API_BASE = 'http://localhost:3000';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data = null;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  const hasOk = data && Object.prototype.hasOwnProperty.call(data, 'ok');
  if (!res.ok || (hasOk && data.ok === false)) {
    const err = new Error(data?.reason || data?.error || res.statusText || 'Request failed');
    err.code = data?.errorCode;
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data ?? {};
}

export function fetchPipeline() {
  return request('/pipeline');
}

export function fetchHealth() {
  return request('/health');
}

export function postGoal(goal) {
  return request('/goals', { method: 'POST', body: JSON.stringify(goal) });
}

export function postIdentity(payload) {
  return request('/identity', { method: 'POST', body: JSON.stringify(payload) });
}

export function patchIdentity(updates) {
  return request('/identity', { method: 'PATCH', body: JSON.stringify({ updates }) });
}

export function postTaskStatus(payload) {
  return request('/task-status', { method: 'POST', body: JSON.stringify(payload) });
}

export function resetState() {
  return request('/reset', { method: 'POST' });
}

export function runCycleNext() {
  return request('/cycle/next', { method: 'POST' });
}

export function fetchDiagnostics() {
  return request('/internal/diagnostics');
}
