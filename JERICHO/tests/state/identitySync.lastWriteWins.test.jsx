import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

// Both sync entry points are mocked so the merge DECISION is observable:
//   - server wins  -> store adopts the server marker
//   - local wins   -> store keeps the local marker AND pushes up (self-heal)
const pushState = vi.fn(async () => ({ ok: true }));
const pullState = vi.fn(async () => null);
vi.mock('../../src/services/syncService.js', () => ({
  pushState: (...args) => pushState(...args),
  pullState: (...args) => pullState(...args),
}));

import {
  IdentityProvider,
  buildBlankIdentityState,
  buildPersistableIdentityState,
  useIdentityStore,
} from '../../src/state/identityStore.js';

const IDENTITY_KEY = 'jericho-identity';
const UPDATED_AT_KEY = 'jericho-identity-updated-at';

let store = null;
function StoreProbe() {
  store = useIdentityStore();
  return null;
}

// meta.scenarioLabel survives computeDerivedState; profilesById.displayName does
// NOT (it is sanitized back to the default), so it cannot discriminate here.
function markerOf(s) {
  return s?.meta?.scenarioLabel ?? null;
}

// A persistable blob tagged with a marker we can read back off the live store.
function makeBlob(marker) {
  const s = buildBlankIdentityState({});
  s.meta = { ...(s.meta || {}), scenarioLabel: marker };
  return buildPersistableIdentityState(s);
}

function seedLocal(marker, updatedAtISO) {
  const blob = makeBlob(marker);
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(blob));
  if (updatedAtISO) localStorage.setItem(UPDATED_AT_KEY, updatedAtISO);
  return blob;
}

const OLDER = '2026-08-26T10:00:00.000Z';
const NEWER = '2026-08-26T12:00:00.000Z';

// This environment does not supply localStorage (see the vi.stubGlobal pattern
// in AppShell.structureRoute.contract.test.jsx). Stub a real in-memory one —
// the code under test reads and writes it, so a no-op stub would prove nothing.
function installMemoryStorage() {
  const map = new Map();
  const storage = {
    getItem: (k) => (map.has(String(k)) ? map.get(String(k)) : null),
    setItem: (k, v) => { map.set(String(k), String(v)); },
    removeItem: (k) => { map.delete(String(k)); },
    clear: () => { map.clear(); },
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  vi.stubGlobal('localStorage', storage);
  return storage;
}

beforeEach(() => {
  installMemoryStorage();
  pushState.mockClear();
  pullState.mockClear();
  store = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('identityStore mount sync — last-write-wins, not server-always-wins', () => {
  // THE REGRESSION. Before the fix the mount pull applied server state
  // unconditionally, so a client whose final debounced push never landed
  // (sign-out inside the 1500ms window) had its newer work silently replaced
  // by the older server copy on next sign-in.
  it('keeps LOCAL when the server copy is older, and pushes local up to self-heal', async () => {
    const local = seedLocal('local-newer', NEWER);
    pullState.mockResolvedValue({ state: makeBlob('server-stale'), clientUpdatedAt: OLDER });

    render(
      <IdentityProvider initialState={local}>
        <StoreProbe />
      </IdentityProvider>
    );

    await waitFor(() => expect(pullState).toHaveBeenCalled());
    // Server state must NOT have been adopted.
    await waitFor(() => expect(markerOf(store)).toBe('local-newer'));
    expect(markerOf(store)).not.toBe('server-stale');
    // And local is pushed up so the stale server row is healed.
    await waitFor(() => expect(pushState).toHaveBeenCalled());
  });

  it('adopts SERVER when the server copy is strictly newer', async () => {
    const local = seedLocal('local-older', OLDER);
    pullState.mockResolvedValue({ state: makeBlob('server-newer'), clientUpdatedAt: NEWER });

    render(
      <IdentityProvider initialState={local}>
        <StoreProbe />
      </IdentityProvider>
    );

    await waitFor(() => expect(markerOf(store)).toBe('server-newer'));
  });

  it('adopts SERVER when there is no local profile at all (fresh browser)', async () => {
    // No IDENTITY_KEY written — the case the mount pull exists to serve.
    pullState.mockResolvedValue({ state: makeBlob('server-only'), clientUpdatedAt: OLDER });

    render(
      <IdentityProvider initialState={buildBlankIdentityState({})}>
        <StoreProbe />
      </IdentityProvider>
    );

    await waitFor(() => expect(markerOf(store)).toBe('server-only'));
  });

  it('keeps LOCAL when the local stamp is missing (ambiguous — never clobber)', async () => {
    // Existing installs have an identity blob but no stamp yet. Overwriting is
    // the destructive direction, so ambiguity must resolve toward local.
    const local = seedLocal('local-unstamped', null);
    pullState.mockResolvedValue({ state: makeBlob('server-stale'), clientUpdatedAt: OLDER });

    render(
      <IdentityProvider initialState={local}>
        <StoreProbe />
      </IdentityProvider>
    );

    await waitFor(() => expect(pullState).toHaveBeenCalled());
    await waitFor(() => expect(markerOf(store)).toBe('local-unstamped'));
    expect(markerOf(store)).not.toBe('server-stale');
  });
});

describe('identityStore pending push — flushed on unmount, not cancelled', () => {
  // THE SECOND REGRESSION. The debounce cleanup ran clearTimeout on unmount,
  // discarding a save that had not yet fired. Signing out inside the 1500ms
  // window meant the answers reached localStorage but never the server.
  it('flushes the pending debounced push when the provider unmounts', async () => {
    pullState.mockResolvedValue(null); // no self-heal push — any push is the flush
    const local = seedLocal('local-pending', NEWER);

    const { unmount } = render(
      <IdentityProvider initialState={local}>
        <StoreProbe />
      </IdentityProvider>
    );
    await waitFor(() => expect(pullState).toHaveBeenCalled());

    // The 1500ms debounce has NOT elapsed, so nothing has been pushed yet.
    expect(pushState).not.toHaveBeenCalled();

    unmount();

    // Unmount must send it rather than cancel it.
    expect(pushState).toHaveBeenCalled();
  });

  it('sends the flush with keepalive so it survives page teardown', async () => {
    pullState.mockResolvedValue(null);
    const local = seedLocal('local-keepalive', NEWER);

    const { unmount } = render(
      <IdentityProvider initialState={local}>
        <StoreProbe />
      </IdentityProvider>
    );
    await waitFor(() => expect(pullState).toHaveBeenCalled());
    unmount();

    expect(pushState).toHaveBeenCalled();
    const [, options] = pushState.mock.calls[pushState.mock.calls.length - 1];
    expect(options?.keepalive).toBe(true);
  });
});
