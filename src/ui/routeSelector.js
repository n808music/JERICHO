// Route selection helper for the main UI entrypoint.
// This module is intentionally a plain .js file so tests can execute it without needing JSX compilation.

// Feature gate: Intake Dev is experimental and should be off by default.
// Enable with VITE_ENABLE_INTAKE_DEV=true (Vite).
export const ENABLE_INTAKE_DEV =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENABLE_INTAKE_DEV === 'true';

/**
 * Return the canonical root component key for a given pathname + gate.
 * This avoids importing React/JSX components so it remains testable in Jest.
 */
export function resolveRootComponentKey({ pathname = '/', enableIntakeDev = ENABLE_INTAKE_DEV } = {}) {
  if (pathname === '/black') return 'BlackViewPage';
  if (enableIntakeDev && pathname === '/intake-dev') return 'IntakeDev';
  return 'App';
}
