---
"@invinite-org/chartlang-core": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-conformance": minor
"@invinite-org/chartlang-compiler": patch
---

Phase-2 Task 5 — cross-functional `ta.*` primitives + `STATEFUL_PRIMITIVES`
shape evolution.

Ships six new Pine-canonical `ta.*` primitives under
`packages/runtime/src/ta/`:

- `ta.nz(value, replacement?)` — stateless NaN-replacement.
- `ta.highest(source, length)` — rolling max (monotone deque + window
  recompute).
- `ta.lowest(source, length)` — rolling min (mirror of `highest`).
- `ta.change(source, opts)` — first-difference `source[0] − source[length]`.
- `ta.valuewhen(condition, source, occurrence)` — source value at the
  n-th most recent matching bar.
- `ta.barssince(condition)` — bars since the last `condition === true`.

Each primitive ships the §22.10 set: impl + unit + property + golden +
bench pair + conformance scenario (using the Phase-2 `inlineSource`
extension from Task 1) + auto-generated `docs/primitives/ta/<id>.md`.

`STATEFUL_PRIMITIVES` widens from `ReadonlySet<string>` to
`ReadonlySet<{ name: string; slot: boolean }>` so `ta.nz` (the only
stateless cross-functional primitive) can opt out of compiler slot-id
injection. Phase-1 entries flip to `slot: true`; `ta.nz` is the only
`slot: false` entry; the set cardinality grows from 12 → 18. The shape
update cascades through every compiler consumer
(`packages/compiler/src/api.ts`, `program.ts`,
`analysis/statefulCallInLoop.ts`, `transformers/callsiteIdInjection.ts`,
and their tests). The `statefulCallInLoop` analysis still flags every
entry inside a loop body — `slot: false` primitives are forbidden in
loops by Pine-parity convention.

`TA_REGISTRY` cardinality grows from 9 → 15. `RuntimeTaNamespace`
mirrors core's `TaNamespace` 1:1 with the standard `slotId` first-arg
on every method except `nz` (which carries the script-author signature
verbatim).

Compiler change is `patch`-level — the public API surface is
unchanged; only the internal `STATEFUL_PRIMITIVES` parameter shape
widens. Core/runtime/conformance bump `minor` for the new exports and
the new scenarios.
