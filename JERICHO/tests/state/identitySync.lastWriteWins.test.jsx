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
  __recapturePreSeedSnapshotForTests,
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
  // The pre-seed snapshot is captured at module load; re-capture so this test
  // models a fresh page load that starts with the storage just written above.
  __recapturePreSeedSnapshotForTests();
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
  __recapturePreSeedSnapshotForTests();
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

// ─────────────────────────────────────────────────────────────────────────────
// THE 2026-08-26 DATA-DESTRUCTION REGRESSION.
//
// Recovery cleared localStorage, then buildInitialIdentityState() (module scope)
// immediately rewrote a BLANK state and stamped it `now`. The mount pull judged
// that blank state newer than the populated server row and the self-heal push
// overwrote 200KB of real work with an empty state.
//
// Two independent guards must hold, either of which alone prevents the loss:
//   1. content floor — empty local never overwrites populated server
//   2. push floor    — a self-heal push never fires when the server is richer
// ─────────────────────────────────────────────────────────────────────────────
describe('identityStore mount sync — a blank local state can never wipe a populated server', () => {
  function populatedBlob(marker) {
    const s = buildBlankIdentityState({});
    s.meta = { ...(s.meta || {}), scenarioLabel: marker };
    s.cyclesById = { 'cycle-real': { id: 'cycle-real', status: 'Active' } };
    s.intakeSessionByCycleId = {
      'cycle-real': { currentSlotId: 'slot:project', engineSnapshot: { slotId: 'slot:project' } },
    };
    s.matrix = {
      ...(s.matrix || {}),
      entitiesById: { e1: { id: 'e1' }, e2: { id: 'e2' } },
      initiativesById: { i1: { id: 'i1' }, i2: { id: 'i2' }, i3: { id: 'i3' } },
    };
    return buildPersistableIdentityState(s);
  }

  it('adopts the populated server copy even when the blank local state is stamped NEWER', async () => {
    // Local: blank, stamped NOW (what the seed does right after a storage clear).
    const blankLocal = makeBlob('blank-seeded-local');
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(blankLocal));
    localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
    __recapturePreSeedSnapshotForTests();
    // Server: real work, stamped HOURS EARLIER.
    pullState.mockResolvedValue({ state: populatedBlob('real-server-work'), clientUpdatedAt: OLDER });

    render(
      <IdentityProvider initialState={blankLocal}>
        <StoreProbe />
      </IdentityProvider>
    );

    // The server copy must win on CONTENT, despite losing on timestamp.
    await waitFor(() => expect(markerOf(store)).toBe('real-server-work'));
  });

  it('never pushes a blank local state over a richer server copy', async () => {
    const blankLocal = makeBlob('blank-seeded-local');
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(blankLocal));
    localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
    __recapturePreSeedSnapshotForTests();
    pullState.mockResolvedValue({ state: populatedBlob('real-server-work'), clientUpdatedAt: OLDER });

    render(
      <IdentityProvider initialState={blankLocal}>
        <StoreProbe />
      </IdentityProvider>
    );
    await waitFor(() => expect(pullState).toHaveBeenCalled());

    // The destructive push is what actually destroyed the row. It must not fire.
    const pushedBlanks = pushState.mock.calls.filter(
      ([blob]) => (Object.keys(blob?.matrix?.entitiesById || {}).length === 0)
    );
    expect(pushedBlanks).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// THE SECOND DESTRUCTION (2026-08-26, after the first fix).
//
// The content floor guarded only the self-heal push INSIDE the pull handler.
// The debounced push had no guard at all, so a blank seeded state was pushed
// over a populated server row whenever the pull had not yet resolved — or had
// failed. Byte evidence: the restored 200,254-byte row came back as 334,257
// bytes, the size of local, proving the server copy was never adopted.
// ─────────────────────────────────────────────────────────────────────────────
describe('identityStore push gate — nothing is written before reconciliation', () => {
  function populated(marker) {
    const s = buildBlankIdentityState({});
    s.meta = { ...(s.meta || {}), scenarioLabel: marker };
    s.cyclesById = { 'c-real': { id: 'c-real', status: 'Active' } };
    s.intakeSessionByCycleId = { 'c-real': { currentSlotId: 'slot:project', engineSnapshot: {} } };
    s.matrix = { ...(s.matrix || {}), entitiesById: { e1: {}, e2: {} }, initiativesById: { i1: {}, i2: {} } };
    return buildPersistableIdentityState(s);
  }

  it('does not push while the pull is still in flight (the debounce must not win the race)', async () => {
    vi.useFakeTimers();
    try {
      let resolvePull;
      pullState.mockReturnValue(new Promise((r) => { resolvePull = r; }));
      const blankLocal = makeBlob('blank-local');
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(blankLocal));
      localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
      __recapturePreSeedSnapshotForTests();

      render(
        <IdentityProvider initialState={blankLocal}>
          <StoreProbe />
        </IdentityProvider>
      );

      // Advance well past the 1500ms debounce WITHOUT resolving the pull.
      await vi.advanceTimersByTimeAsync(5000);

      // Pre-fix this fired and overwrote the server. It must not.
      expect(pushState).not.toHaveBeenCalled();
      resolvePull(null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not push a blank state when the pull returned a populated server copy', async () => {
    const blankLocal = makeBlob('blank-local');
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(blankLocal));
    localStorage.setItem(UPDATED_AT_KEY, new Date().toISOString());
    __recapturePreSeedSnapshotForTests();
    pullState.mockResolvedValue({ state: populated('server-real'), clientUpdatedAt: OLDER });

    render(
      <IdentityProvider initialState={blankLocal}>
        <StoreProbe />
      </IdentityProvider>
    );
    await waitFor(() => expect(pullState).toHaveBeenCalled());

    const blankPushes = pushState.mock.calls.filter(
      ([b]) => Object.keys(b?.matrix?.entitiesById || {}).length === 0
    );
    expect(blankPushes).toHaveLength(0);
  });
});
