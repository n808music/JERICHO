# Core Domain Demotion 1.0.6.4

Date: 2026-03-09

## Objective

Demote `Body/Resources/Creation/Focus` from core execution governance so
category labels are advisory metadata, not core execution law.

## Scope Applied

Core governance contracts now use an empty `domainsAllowed` set in
synthesized/bootstrapped paths. This removes domain-gating from core
suggestion/probability authorization when using these contracts.

## Code Paths Updated

- `src/state/identityCompute.js`
  - synthesized governance contract (`collectGovernanceContracts`):
    `domainsAllowed: []`
  - onboarding/new-cycle governance contracts: `domainsAllowed: []`
- `src/state/engine/probabilityScore.ts`
  - synthesized governance contract fallback (`collectContracts`):
    `domainsAllowed: []`
- `src/state/identityStore.js`
  - initialized and admission-governance contracts: `domainsAllowed: []`

## What this changes

- Core engine no longer requires a directive to match legacy domain categories
  in these governance paths.
- P.O.S./feasibility identity and execution paths remain keyed by canonical
  goal/cycle, not wellness/productivity buckets.

## What this does not change

- UI/domain labels may still display category strings.
- Historical/tests may still include legacy domain values as metadata.
- This step does not remove domain fields from schemas; it demotes their
  authority in core governance.

## Follow-on Work (next list item)

- Define universal cycle-dynamics laws independent of domain taxonomy:
  - time passage
  - due/missed/rescheduled/expired transitions
  - dynamic P.O.S. response to execution reality
