# Temporal Engine Rules (Deterministic)

- **Streaks**: streaks increment on consecutive completes; drop to 0 when a miss occurs.
- **Rollover**: streak rollover is capped (see config rolloverCap) and never exceeds that cap.
- **Decay**: if no tasks are completed within a cycle, streak resets after the decay window.
- **Penalty/Bonus**: bonuses apply only once per cycle; penalties do not stack beyond the rollover cap.
- **Cycle Indexing**: all temporal updates are computed per cycle index, not wall-clock time, to ensure determinism.
- **Duplicate tasks**: identical tasks within the same cycle contribute only once to streaks/penalties to avoid double counting.

These rules are internal-only and keep the temporal subsystem deterministic for long-horizon simulations and patent diagrams.
