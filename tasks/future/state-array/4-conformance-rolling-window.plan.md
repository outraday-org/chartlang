# Task 4 — Plan: Conformance scenario `state.array` rolling window

## Context

Add a shared conformance scenario that compiles + runs an indicator using
`state.array<number>(5)` to maintain a rolling window of the last K closes,
plots its window mean alongside `ta.sma(bar.close, 5)`, and pins each plot to
its own SHA-256. Locks the new persistent-collection primitive into the
cross-host / cross-adapter suite.

Mirror `barCloseDirectIndex.scenario.ts` (two distinct-hash plots + a
`diagnostic-code-absent: lookback-exceeded` assertion).

## Pre-existing work (verified in the workspace)

- Task 1 (core): `state.array<T>(capacity)` hole in
  `packages/core/src/state/state.ts:116` returning
  `MutableArraySlot<T>` (`arraySlot.ts`: `push`/`get`/`last`/`clear` +
  readonly `size`/`capacity`). Registry entry present. Confirmed by
  `packages/core/CLAUDE.md`'s `state.array` invariant.
- Task 2 (runtime): `arrayStateSlot.ts`, `arrayNamespace`, `arrayLifecycle`,
  `arrayPersistence` all present under `packages/runtime/src/state/`.
- Task 3 (compiler): capacity-literal guard (changeset documents
  `state-array-capacity-not-literal` / `state-array-capacity-exceeds-max`).
- Changeset `.changeset/state-array.md` already exists covering
  core/compiler/runtime/pine-converter/cli. **Conformance fixtures need no
  separate bump** (repo convention, per task §Changeset) — no changeset edit.
- **Build note:** runtime `dist/` was stale (no array files). Rebuilt
  `core`, `runtime`, `compiler` so the conformance suite (consumes runtime
  via `dist`) sees the array slot. Done.

## Issues found

- None blocking. The example script in the task uses `bar.close.current`
  (scalar head) and an in-loop `win.get(i)` (handle method, loop-legal).
  Both are supported by the landed core/runtime. The in-loop `get` must NOT
  trip `stateful-call-inside-loop` (it is a handle method, not a registry
  callsite) — if it does, Task 1/3 regressed; fail loudly.

## Steps

1. Create `packages/conformance/src/scenarios/stateArrayRollingWindow.scenario.ts`
   mirroring `barCloseDirectIndex.scenario.ts`:
   - inline `SOURCE` = the task §Requirements-2 script verbatim.
   - virtual `sourcePath` derives from `id` =
     `<inline:state-array-rolling-window>.chart.ts:<line>:<col>#0`.
   - two `plot-hash` assertions (window-mean, ta.sma) + one
     `diagnostic-code-absent: lookback-exceeded`.
   - placeholder hashes/slotIds, then re-pin from the runner's "expected vs
     actual" message.
   - JSDoc with `@since 1.4` + `@stable` + `@example`, MIT header.
2. Register in `packages/conformance/src/scenarios/index.ts`: import,
   re-export (alpha-ish position near other `state*` entries), and add to
   `ALL_SCENARIOS` (next to `STATE_SERIES_HISTORY_SCENARIO`).
3. Run the scenario in isolation to mint the real slotIds + hashes; pin them.
4. Run the full conformance suite test to confirm green.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `packages/conformance/src/scenarios/stateArrayRollingWindow.scenario.ts` | Create | `state.array` rolling-window mean is a stable finite series; ta.sma pins to its own hash. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Import + re-export + register in `ALL_SCENARIOS`. |

## Gates to keep green

- `pnpm -F @invinite-org/chartlang-conformance test`
- `pnpm conformance`, `pnpm conformance:check` (suite green)
- `pnpm typecheck`, `pnpm lint` (per-package, not full-workspace per task instr)

## Changeset

Covered by `.changeset/state-array.md` (Task 1's feature changeset). No new
bump for conformance fixtures — matches repo convention.

## Acceptance criteria

- New scenario compiles + runs + is registered in `ALL_SCENARIOS`.
- Window-mean plot pins to a stable SHA-256; `ta.sma(5)` pins to its own;
  `lookback-exceeded` absent.
- Conformance suite green; typecheck/lint green for the conformance package.
- No `stateful-call-inside-loop` from the in-loop `win.get(i)`.
