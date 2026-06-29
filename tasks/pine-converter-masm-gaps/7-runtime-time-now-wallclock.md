# `time.now()` Wall-Clock + `timenow` Mapping

> **Status: TODO**

## Goal

Add a `time.now()` accessor to chartlang (host-injected wall-clock, ms
epoch) and map Pine's `timenow` builtin onto it. This unblocks
real-time alert idioms like `ms_until_close = time_close - timenow`. The
injection seam already exists (`createScriptRunner` takes `now: () =>
number`), so this is mostly *exposing* an existing host input through
the `time` namespace — determinism is preserved by keeping `now` a host
input that is never serialised into snapshots/goldens.

## Prerequisites

Task 3 (shares the `BUILTIN_CALL_MAP` / `time` namespace touch-points;
sequence after it to avoid mapping-table merge churn).

## Current Behavior

- `timenow` is unmapped → `unknown-identifier` (MASM line 566:
  `ms_until_close = time_close - timenow`).
- The runtime already accepts a host clock but does not expose it to
  scripts:

```ts
// runtime/src/createScriptRunner.ts
now?: () => number   // (~line 187) arg
const now = args.now ?? Date.now;  // (~line 312)
state.now = now;     // (~line 336) — used ONLY for snapshot cadence today
```

- The `time.*` namespace is a core sentinel surface; runtime supplies
  real closures:

```ts
// core/src/time-accessors/timeAccessors.ts (~line 6)
const sentinel = (name) => { throw new Error(`${name} called outside an active script step`); };
// runtime/src/time-accessors/timeAccessors.ts
createTimeNamespace(getDefaultTz, getIntervalMs, onDstUnsupported)  // (~line 50)
buildTimeNamespace(ctx)                                             // (~line 147)
// runtime/src/buildComputeContext.ts (~line 46): time: buildTimeNamespace(state.runtimeContext)
```

Determinism rules: `packages/runtime/CLAUDE.md:147` (snapshots
deterministic, no host variance); the whole `time.*` namespace exists to
keep output byte-reproducible (no `Date`/`Intl` on the script path).

## Desired Behavior

- `time.now()` returns the host-injected wall-clock epoch (ms) at call
  time; defaults to `Date.now` when the host doesn't inject one.
- `timenow` → `time.now()`.
- Conformance/goldens that touch `time.now()` inject a **fixed** `now`
  so snapshots stay reproducible.

## Requirements

### 1. core — add the sentinel stub (`packages/core`)

In `src/time-accessors/timeAccessors.ts`, add `now(): Time` to the
frozen `time` object (throwing `sentinel("time.now")`) and to the
`TimeNamespace` type. Type/contract only — no behavior. Add the JSDoc
block matching sibling accessors' shape (`@example` + stability marker),
but set `@since` to the **next published version**, not the siblings'
`@since 1.5` (this is net-new surface — check the current
`packages/core` version and use the next minor). Note in `packages/core/CLAUDE.md` that `time.now()` is a
host-injected, non-deterministic input excluded from snapshots.

### 2. runtime — wire the real closure (`packages/runtime`)

- `src/time-accessors/timeAccessors.ts`: add a `getNow: () => number`
  parameter to `createTimeNamespace`, and a `now: () => getNow()`
  member on the returned frozen namespace.
- `buildTimeNamespace`: thread the now-getter through. `RuntimeContext`
  does not currently hold `now`; prefer passing `state.now` directly at
  the `buildComputeContext.ts:46` call site
  (`buildTimeNamespace(state.runtimeContext, state.now)`) — smaller diff
  than adding a `RuntimeContext.now` field.
- `args.now` plumbing is unchanged (already defaults to `Date.now`).

The accessor is read at call time and `buildTimeNamespace` is rebuilt
per step, so `time.now()` correctly reflects the live clock on each
tick.

### 3. converter — map `timenow` (`packages/pine-converter`)

- Add `timenow` to the builtin name set (`src/semantic/builtins.ts`).
- Add the mapping. `timenow` is a bare value read, so add to
  `BUILTIN_IDENTIFIER_MAP` (`src/mapping/builtinIdentifiers.ts`):
  ```ts
  ["timenow", "time.now()"],
  ```
  (Confirm whether the converter models `timenow` as identifier or
  no-arg call; if call-form, add to `BUILTIN_CALL_MAP` instead,
  mirroring the `time`/`time_close` entries.)
- `ms_until_close = time_close - timenow` then converts to
  `time.timeClose(bar.time) - time.now()`.

### 4. Determinism / conformance

- Do **not** serialise `now` into snapshots (it already isn't).
- If adding a conformance scenario exercising `time.now()`, the harness
  must inject a fixed `now` (e.g. `now: () => 1_700_000_000_000`) so the
  golden is reproducible. If the conformance runner construction doesn't
  currently accept `now`, thread a fixed value in for that scenario
  only. If this widens scope too far, defer the conformance scenario and
  cover `time.now()` with a runtime unit test injecting a fixed clock
  instead — and note the deferral.

### 5. Tests

- core: type test that `time.now` exists on `TimeNamespace` and the
  stub throws outside a step.
- runtime: unit test injecting `now: () => 123_456` and asserting
  `time.now()` returns it inside compute; and that the default falls
  back to `Date.now` (mock).
- converter: golden fixture trio:
  ```pine
  //@version=6
  indicator("timenow")
  ms_left = time_close - timenow
  plot(ms_left)
  ```
  Regenerate with `UPDATE_FIXTURES=1`; confirm `time.timeClose(bar.time)
  - time.now()` and zero `unknown-identifier`. Must compile.

### 6. Docs / JSDoc gate

`pnpm docs:check` / `pnpm hover:check` may require the new core export to
carry full JSDoc and be present in the hover registry — regenerate
(`pnpm gen-hover-registry`) if the gate flags it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/time-accessors/timeAccessors.ts` | Modify | `now()` stub + type |
| `packages/core/src/time-accessors/*.test.ts` | Modify | Type + sentinel coverage |
| `packages/runtime/src/time-accessors/timeAccessors.ts` | Modify | Real `now` closure |
| `packages/runtime/src/buildComputeContext.ts` | Modify | Thread `state.now` |
| `packages/runtime/src/time-accessors/*.test.ts` | Modify | Injected/default clock coverage |
| `packages/pine-converter/src/semantic/builtins.ts` | Modify | Register `timenow` |
| `packages/pine-converter/src/mapping/builtinIdentifiers.ts` (or `builtinCalls.ts`) | Modify | `timenow → time.now()` |
| `packages/pine-converter/fixtures/NN-timenow.{pine,expected.chart.ts,expected.diagnostics.json}` | Create | Golden trio (compiles) |
| `packages/pine-converter/src/tests/golden.test.ts` | Modify | Bump fixture count assertion |
| `packages/core/CLAUDE.md`, `packages/runtime/CLAUDE.md`, `packages/pine-converter/CLAUDE.md` | Modify | Invariant notes |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (core + runtime + pine-converter 100% coverage)
- `pnpm docs:check` / `pnpm hover:check` (new core export)
- `pnpm conformance` / `pnpm conformance:check` (if a scenario is added)

## Changeset

`.changeset/runtime-time-now-wallclock.md` — `@invinite-org/chartlang-core: minor`, `@invinite-org/chartlang-runtime: minor`, `@invinite-org/chartlang-pine-converter: minor` (each on its own line).

## Acceptance Criteria

- `time.now()` exists in core (sentinel) + runtime (host-injected,
  defaults to `Date.now`); read fresh per call/tick.
- `timenow` maps to `time.now()`; MASM's `time_close - timenow`
  converts and compiles.
- Determinism preserved: `now` never serialised; any golden/conformance
  uses a fixed injected clock.
- 100% coverage across all three packages; JSDoc/hover gates green.
- All three `CLAUDE.md` files updated; multi-package changeset committed.
