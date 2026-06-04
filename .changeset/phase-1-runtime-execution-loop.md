---
"@invinite-org/chartlang-runtime": minor
---

Add `createScriptRunner` + the per-bar execution loop (`onHistory` /
`onBarClose` / `onBarTick` / `drain` / `dispose`) per PLAN §6.1 + §6.7.
The runner owns the `bar` / `series` synchronisation invariants, the
per-bar emission queue reset, and the `ACTIVE_RUNTIME_CONTEXT` slot
mutation around `compute`. Introduces a throw-stub `primitives.ts`
seam at `ta` / `plot` / `hline` / `alert` that Tasks 7-8 replace with
the real stateful implementations. End-to-end no-primitive `compute`
scripts now run through the full lifecycle, pinned by a 500-bar
determinism test and four §6.7 property invariants under fast-check.
