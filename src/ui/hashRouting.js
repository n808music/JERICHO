// Helper for detecting when the legacy app should delegate to the Zion hash routes.
// Kept as plain JS (no JSX) so unit tests can run in the Node environment.

export function shouldRenderZionFromHash(hash) {
  if (hash == null) return false;
  if (typeof hash !== 'string') return false;
  const normalized = hash.trim().toLowerCase();
  if (normalized === '') return true;

  // Accept common hash variants like #/structure, #/structure/, #/structure?foo=bar
  const base = normalized.split('?')[0].replace(/\/+$|^\/+/g, '');
  // base will be '#/structure' or '#/today' or '#/stability'
  return base === '#/structure' || base === '#/today' || base === '#/stability';
}
