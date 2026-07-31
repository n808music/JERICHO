# Gate 4 Stage 2: Disclosure Standard Rewrite — BRIEF

**Status: GO**

---

## Task

Rewrite all Partial and Fail message classes from the Disclosure Standard audit. Apply four rulings from Stage 1. Deliver evidence of live rendering and full 27+1/19 reconcile. Do not merge if reconcile is incomplete.

---

## Rulings (Non-Negotiable)

### Ruling 1: RESIDUAL-PHASE Reference Status — FIX & KEEP

Add missing §5 citation to RESIDUAL-PHASE message. Restore to PASS. Keep reference-implementation title on merit.

### Ruling 2: Gate 3 Application Consistency — Internal Alignment

Gate 3 produced two PASS and two FAIL codes in the same file. PASS codes cite §5; FAIL codes do not. Treat as application-consistency gap, not blanket defect. Fix all five codes in Gate 3 to meet the same citation standard.

### Ruling 3: Affordance Verification — Three FAIL Items

Before rewriting GRID-PHANTOM, UNRESOLVABLE_SEQUENCE, and NO_DECLARED_SEQUENCE, verify whether a concrete remedy affordance exists in the UI:

- Does the UI allow merge/delete of grid rows, or visualize dependency cycles?
- Is there a user-facing remediation path the operator can execute?

**If affordance exists**: Rewrite to name it concretely.  
**If affordance does NOT exist**: Flag as **deferred finding**. Do not ship vague text that implies a remedy the operator cannot execute. Defer to future wave, do not force-fit into this gate.

### Ruling 4: Voice Standardization — Two Legitimate Registers

- **Elicitation-context** (asking during intake): modal voice
- **Advisory/violation** (flagging something wrong): declarative voice

Standardize terminology (attested/residual/referent) *within* each register, not across them.

---

## Scope & Priorities

**Priority 1** (PASS candidate):
- RESIDUAL-PHASE (add §5 cite)
- DECLARED_PHASE_CONTRADICTS_DEPENDENCIES (Gate 3, already PASS)
- PROJECT_PHASE_CONTRADICTS_INITIATIVE (Gate 3, already PASS)

**Priority 2** (FAIL, affordance-verify required):
- GRID-PHANTOM
- UNRESOLVABLE_SEQUENCE
- NO_DECLARED_SEQUENCE

**Priority 3** (PARTIAL, text-only fix):
- ~8 remaining message classes (copy rewrite, missing citation/example)

---

## Deliverables

1. **Tests first**: Assert message content for Partial and Fail classes before any rewrite.
2. **Rewrite in priority order**: Address Priorities 1, 2, 3 in sequence.
3. **Affordance findings**: For Priority 2 items, document findings explicitly:
   - Affordance exists → name it concretely in rewrite
   - Affordance absent → flag as deferred finding, do not rewrite
4. **Full 27+1/19 reconcile**: Run entire suite after rewrites. Reconcile must complete; partial runs do not close the gate.
5. **Evidence**: 
   - Raw test output (full reconcile)
   - Real screenshot of at least RESIDUAL-PHASE and one Gate-3 fix rendering live
   - Affordance findings summary (per-item: exists/absent/deferred)

---

## Evidence Standards

- **Batches are expected and OK**: Scope is larger; evidence may come in multiple rounds.
- **Partial reconciles are NOT OK**: Full 27+1/19 run or the gate does not close.
- **Screenshots are non-negotiable**: Real image, opened and reviewed, not a description.
- **Raw logs, not summaries**: Full test output, full reconcile, not a prose summary of the results.

---

## Contingency: Affordance Gap

If Ruling 3 finds that one or more FAIL items have no remedy UI:

- **Do not** rewrite to sound more concrete. That writes a check the UI can't cash.
- **Do** flag as **deferred finding** with clear explanation: "This message cannot ship until [specific UI affordance] exists."
- **Defer to future wave**, do not force-fit into this gate.
- Report finding explicitly in evidence.

---

## Stop Conditions

- Full 27+1/19 reconcile completes ✓
- Evidence (raw logs + screenshot) provided ✓
- Affordance findings (per-item) documented ✓
- No FAIL items shipped with unverified affordances ✓

Gate 2 opened when all four are met.
