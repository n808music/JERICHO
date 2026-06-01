# Documentation

## Architecture

| Document | What it covers |
|---|---|
| [Execution Model](architecture/execution-model.md) | End-to-end pipeline: goal intake → deliverables → blocks → execution → POS |
| [Authority Maps](architecture/authority-maps.md) | UI write-authority classification + probability authority invariants |
| [Scheduling Semantics](architecture/scheduling-semantics.md) | Canonical Generate → Propose → Apply → Render contract; scheduler inputs/outputs |
| [Source of Truth Ownership](architecture/source-of-truth.md) | Runtime ownership lock: which field is canonical, who writes it, what the mirrors are |

## Reference

| Document | What it covers |
|---|---|
| [POS Trust State](reference/pos-trust-state.md) | withheld / provisional / trusted rules; QUALIFYING_EXTERNAL_STAGES; display policy |
| [Plan Quality Gate](reference/plan-quality-gate.md) | evaluatePlanQualityGate checks, failure codes, and how to add new checks |
| [Terminal Endpoint Rules](reference/terminal-endpoint-rules.md) | What counts as "finished"; binding invariant; contamination rule |
| [Goal Admission Policy](reference/goal-admission-policy.md) | 8-phase hard gate; all GoalRejectionCode values and conditions |
| [Execution Event Ledger](reference/execution-event-ledger.md) | Append-only log invariants; event schema; what may and may not replay into the ledger |
| [Goal-to-Deliverable Contract](reference/goal-to-deliverable.md) | Canonical planning semantics: goal → deliverables → actions → sessions → blocks |

## Development

| Document | What it covers |
|---|---|
| [Setup](development/SETUP.md) | Dev environment setup |
| [Testing](development/TESTING.md) | Test patterns and practices |
| [Contributing](development/CONTRIBUTING.md) | Contribution guidelines |
| [CI/CD](development/CI-CD.md) | Pipeline configuration |

## Archive

[docs/archive/](archive/) — historical working documents (briefs, freeze packages, phase closures). Not maintained.
