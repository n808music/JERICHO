---
name: direct-db-writes-need-client-updated-at
description: "Writing state_blob directly to jericho_dev.db is silently reverted unless client_updated_at is ALSO advanced past the browser's localStorage stamp"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5b419e21-4f83-4cf6-b1a2-ea970b3f9437
  modified: 2026-08-29T08:19:21.424Z
---

A direct write to `user_states.state_blob` that does not also advance
`client_updated_at` is **silently discarded** by the running app, then
overwritten by the browser's next debounced push. It looks like the write
"didn't persist" — it did; it was reverted seconds later.

Mechanism (verified 2026-08-29, four failed attempts before it was found):
- `syncService.js:71-77` — `client_updated_at` means *when state was last
  written LOCALLY*, not push time. It is the field mount-pull reconciles on.
- `identityStore.js:2295` — `if (comparable && serverAt > localAt)` adopt
  server. **Strictly greater.** `localAt` is `PRE_SEED_LOCAL_SNAPSHOT.updatedAt`,
  read from localStorage `jericho-identity-updated-at` at module load.
- Leave `client_updated_at` untouched → server looks stale → browser keeps
  local → debounce pushes local over your row.

## Procedure for a manual write

1. **Close the browser tab** (not just navigate away). Confirm with
   `lsof -nP -i :5183 -sTCP:ESTABLISHED`. Leave the dev servers running.
2. Write `state_blob` **and** `client_updated_at`, as ISO8601 UTC ms + `Z`
   (24 chars, `new Date().toISOString()` shape), strictly newer than the row's
   current value. Use compact separators (`json.dumps(..., separators=(',',':'))`)
   so blob byte-size stays a forensic signal — Python's default `", "` inflates
   a ~240KB blob by ~18KB and makes it obvious the row is not app-written.
3. Reopen, **then re-query**. A read-back on your own connection proves it
   landed, NOT that it survived the mount.

## Do not use an unknown key as a sentinel

A `TEST_FIELD` added to a Project to detect reversion appears to have *caused*
one: `rehydratePersistedState` returned falsy, so the adopt branch no-op'd at
`identityStore.js:2296 if (hydrated)`. The run that removed it succeeded. Use a
schema-legitimate field as the survival marker instead.

Forensics that identified the clobber: sentinel absent, blob byte-identical to
pre-write, JSON in compact JS style rather than Python's, and `client_updated_at`
newer than the value written.

Escape hatch that bypasses the comparison: `localStorage.clear()` then close the
tab → `hasProfile` false → `identityStore.js:2270` adopts the server copy
unconditionally.

Related: [[task-1-completion-final-2026-08-29]]
