---
name: sandboxed-grep-false-negatives
description: "ctx_execute(language \"shell\") grep returns false negatives in the JERICHO repo; use Node fs walks for evidence instead"
metadata: 
  node_type: memory
  type: reference
  originSessionId: e7554127-88c3-40e7-afb8-e694c2b974ca
  modified: 2026-08-23T06:28:08.081Z
---

In the JERICHO repo, `ctx_execute(language: "shell")` running `grep -r` returns
**zero matches for strings that demonstrably exist**. Confirmed 2026-08-23:
`grep -rc "targetDate" src/` returned nothing, while a Node `fs` walk over the same
tree found `targetDate` in 44 files. `ls` in the same sandbox call worked, so cwd
and mount were correct — grep itself is the broken surface.

The `Bash` tool's own grep is a **different** surface and was not implicated
(Bash `git show` calls returned correct output in the same session).

**Why:** a null grep result from the sandbox is indistinguishable from "this
doesn't exist anywhere," which is exactly the shape of a CONSTRAINT-resolving
finding. A false negative here silently manufactures confident wrong conclusions.

**How to apply:** never cite a sandboxed-shell grep null result as evidence of
absence. Use `ctx_execute(language: "javascript")` with an `fs.readdirSync`
recursive walk reading file contents, and state the file count walked so the
scope of the claim is visible. Scope matters too — walking only `src/` misses
`frontend/`, `tests/`, `docs/`; walk from the repo root when claiming "anywhere".

Related: [[e15-phase-2b-initiative-terminal-date]]
