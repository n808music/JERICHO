import { DEV } from '../utils/devFlags.js';

type TraceType = 'action' | 'noop' | 'read';

export type UIWiringTrace = {
  type: TraceType;
  name: string;
  atISO: string;
  payload?: unknown;
  reason?: string;
};

const MAX_TRACES = 40;
let traces: UIWiringTrace[] = [];
const listeners = new Set<(next: UIWiringTrace[]) => void>();

function emitTrace(trace: UIWiringTrace) {
  if (!DEV) return;
  traces = [trace, ...traces].slice(0, MAX_TRACES);
  listeners.forEach((listener) => listener(traces));
}

export function traceAction(name: string, payload?: unknown) {
  emitTrace({ type: 'action', name, atISO: new Date().toISOString(), payload });
}

export function traceNoop(name: string, reason: string) {
  emitTrace({ type: 'noop', name, atISO: new Date().toISOString(), reason });
}

export function traceRead(name: string, payload?: unknown) {
  emitTrace({ type: 'read', name, atISO: new Date().toISOString(), payload });
}

export function getWiringTraces() {
  return traces;
}

export function clearWiringTraces() {
  traces = [];
  listeners.forEach((listener) => listener(traces));
}

export function subscribeWiringTraces(listener: (next: UIWiringTrace[]) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
