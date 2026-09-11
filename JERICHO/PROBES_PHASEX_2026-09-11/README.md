# Phase X load probes — what each one establishes

Two probes, run against `reference_matrix_v3_1.json` at `nowISO
2026-08-28T00:00:00Z` (the same value the mutation tests use). They answer
different questions and are easy to conflate, so keep them apart.

Committed because the claims below were previously supported only by files in
`/tmp` on one machine — the same auditable-looking-but-not-auditable shape that
`.gitignore`'s `*.log` rule created for the Phase 0 comparator.

## probe2 — named diffs, ONE row mutated

`probe2_named_diffs.txt`. Mutates a single Children Initiative to carry a
`completion_value`, then diffs every class map against the clean load **by
identity, not by count**.

```
CONTROL   entities 7  initiatives 29  projects 59  deliverables 63  artifacts 188  systems 10
MUTATION  entities 6  initiatives 28  projects 56  deliverables 60  artifacts 181  systems  8
```

Dropped: initiative `initiative-global-state-solutions-foundation`, entity
`entity-global-state-solutions`, and 3 projects / 3 deliverables / 7 artifacts /
2 systems, all Global-State-Solutions-owned.

**Establishes:** the early return preserves the partially-built matrix and drops
exactly the offending node's subtree. The "early return hands back a fresh
matrix" hypothesis is **disconfirmed** — and that conclusion depends on the drop
being *partial*. A 7 → 0 here would have proved the opposite.

## probe3 — the 7 → 0 mechanism, ALL 18 rows dropped

`probe3_7to0_mechanism.txt`. Forces rejection on all 18 Children (Foundation)
rows, reproducing the pre-fix drop-set through the fixture rather than by
reverting source.

```
entities 0   initiatives 11 (29 − 18)   projects 0   deliverables 0
artifacts 0  systems 1
```

**Establishes:** `entitiesById: 0` — matching `matrix.referenceSeed`'s
`expected [] to have a length of 7 but got +0` at line 12, and matching why it
aborted at line 12 rather than line 13. Every entity resolves
`foundation_initiative` against a Foundation lane, so dropping all 18 dangles
all 7.

**Scope limit, stated plainly:** this reproduces the *mechanism*, not the
specific pre-fix commit. It shows that dropping all 18 Foundation rows yields
0 entities. It does not, by itself, prove the pre-fix gate dropped exactly those
18 — that follows separately from the gate having demanded `completion_value`
from every Terminating row while all 18 Children lanes carry none. Pinning it to
the commit would require reverting the gate under `git`, which was not done.

## Do not conflate them

probe2 is 7 → **6**. probe3 is 7 → **0**. Citing "7 → 0 was reproduced" is
correct and refers to probe3. Citing it as the result of a single-row mutation
is wrong — that is probe2, and its partial drop is the whole basis for
disconfirming the fresh-matrix hypothesis.

## Method notes worth keeping

- The isolated-dispatch technique in the same session read `lastPlanError`
  immediately after one `DECLARE_INITIATIVE`, before any cascade could overwrite
  it. That is how `INITIATIVE_COMPLETION_VALUE_FORBIDDEN` was confirmed as the
  code the gate actually writes — the final scalar never shows it, because
  last-write-wins leaves `SYSTEM_OWNER_UNRESOLVED` on top.
- Both probes print `ABSENT` rather than omitting a line when a class map is
  missing, so a renamed map cannot read as a clean run with one less line of
  output.
- Mutation setup was copied verbatim from the failing test rather than
  reconstructed, and throws if the target row is not found, so a setup that
  silently no-ops cannot present as a passing control.
