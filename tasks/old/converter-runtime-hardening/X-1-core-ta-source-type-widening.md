# Widen `ta.*` source type to `number | Series<number>`

> **Status: TODO**

## Goal

Make the `ta.*` author-facing type match the compiler/runtime it already
lowers to: every numeric `source` parameter should accept `number |
Series<number>`, not just `Series<number>`. This removes the false `tsc`
error on a computed scalar source — `ta.ema((ma - ma[1]) / ma[1] * 100,
n)` — which is the defining idiom of every slope / turnover / distance
indicator (and the bulk of converter output), and which **already
compiles and runs correctly** today.

## Prerequisites

None.

## Current Behavior

`TaNamespace` (`packages/core/src/ta/ta.ts:2370-2482`) declares each
numeric source inline as `source: Series<number>`:

```ts
// ta.ts:2371-2373, 2389
sma(source: Series<number>, length: number, opts?: SmaOpts): Series<number>;
ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
change(source: Series<number>, opts?: ChangeOpts): Series<number>;
```

But the runtime accepts a scalar. `readSourceValue`
(`packages/runtime/src/ta/lib/sourceValue.ts:35-38`) returns a plain
number untouched, and every runtime primitive declares its source as
`ScalarOrSeries = number | Series<number>` (`sourceValue.ts:20`). The
compiler splices the source arg through verbatim with no type branching
(`packages/compiler/src/transformers/callsiteIdInjection.ts:175-192`:
`ta.ema(X, n)` → `ta.ema("<slot>", X, n)` regardless of `X`'s type).

**Result:** a scalar source runs fine at runtime but the author surface
rejects it under `tsc` (`number is not assignable to Series<number>`) —
a false error on correct code. Converter output for Trend Wizard shows
92 such errors, MASM Strat 11, none of which affect compilation or
execution.

## Desired Behavior

Every numeric `source` (and the `crossover`/`crossunder` `a` operand)
accepts `number | Series<number>`. Existing `Series<number>` callers
keep type-checking unchanged; scalar sources stop erroring. No runtime,
wire, golden, or manifest change.

## Design

Introduce a single exported core alias and swap the numeric source
params to it — do **not** hand-widen each site to a bare union (keep one
name so the intent is greppable and documented):

```ts
/**
 * A `ta.*` numeric source. A `Series<number>` (the common case,
 * `bar.close` / another `ta.*`) OR a per-bar scalar `number` — the
 * compiler keys each `ta.*` callsite by source position and the runtime
 * coerces a scalar via `readSourceValue`, so a computed expression like
 * `(ma.current - ma[1]) / ma[1] * 100` is a valid source without a
 * `state.series` wrapper.
 */
export type TaSource = number | Series<number>;
```

Mirror the runtime's `ScalarOrSeries` semantics exactly (they are the
same union); the core alias is the author-facing name.

## Requirements

### 1. Add the `TaSource` alias (`packages/core/src/ta/ta.ts`)

Declare `TaSource` near the other shared `ta` types and export it from
core's public surface (follow how `SmaOpts` / `Series` are exported from
`packages/core/src/ta/index.ts` + root `index.ts`). Add the JSDoc above
so hover documents *why* a scalar is allowed.

### 2. Swap numeric source params to `TaSource` (`ta.ts:2370-2482`)

Change **every** numeric `source: Series<number>` in `TaNamespace` to
`source: TaSource`. This includes the single-source primitives
(`sma`, `ema`, `rsi`, `change`, `alma`, `wma`, `hma`, `dema`, `tema`,
`smma`, `stdev`, `median`, `cci`, `mfi`, `roc`, `momentum`, `cmo`,
`trix`, … — all of them) and the widen-eligible operands below.

**Also widen (still numeric sources):**
- `crossover(a, b)` / `crossunder(a, b)` (`ta.ts:2378-2383`) — widen
  `a: Series<number>` → `TaSource` (`b` is already `Series<number> |
  number`; leave it, or rename its type to `TaSource` for consistency).
- `valuewhen(condition, source, …)` (`ta.ts:2390-2395`) — widen
  `source`; **leave `condition: Series<boolean>` untouched**.

**Do NOT touch:**
- `condition: Series<boolean>` params (`valuewhen`, `barssince`
  `ta.ts:2396`) — boolean series, not numeric sources.
- Any multi-output *return* type (`BbResult`, `MacdResult`,
  `SupertrendResult`, …) — these are results, not source params.
- A `ta.*` whose source is *documented* to require a real series with
  history (none found — every primitive reads its source per-bar via
  `readSourceValue`; if the implementer finds one, note it and keep it
  `Series<number>`).

### 3. Regenerate the hover registry

`pnpm hover:check` **will fail** — `scripts/gen-hover-registry.ts`
snapshots the core `TaNamespace` param types into
`packages/language-service/src/hoverRegistry.generated.ts` (currently
46 `"type": "Series<number>"` entries, e.g. `hoverRegistry.generated.ts:5866`).
Regenerate with `pnpm gen-hover-registry` (drop `--check`) and commit
the updated snapshot; confirm
`packages/language-service/src/hoverRegistry.generated.test.ts` passes
against it.

### 4. Add a type-level regression test

Add (or extend) an `expect-type` assertion proving both shapes compile —
co-locate with the compiler's `packages/compiler/src/api.types.test.ts`
or add `packages/core/src/ta/ta.types.test.ts`:

```ts
// both must type-check; the scalar one is the regression guard
ta.ema(bar.close, 20);                                  // Series source
ta.ema((bar.close.current - bar.close[1]) * 10, 5);     // scalar source (was TS2345)
ta.crossover((a.current - b.current), 0);               // scalar a + scalar b
```

Assert via `expectTypeOf`/`@ts-expect-error`-free compilation that the
scalar forms are accepted and the return stays `Series<number>` /
`Series<boolean>`.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/ta/ta.ts` | Modify | add `TaSource` alias + JSDoc; swap numeric `source` params (`ta.ts:2370-2482`) |
| `packages/core/src/ta/index.ts` + root `packages/core/src/index.ts` | Modify | export `TaSource` |
| `packages/language-service/src/hoverRegistry.generated.ts` | Generate | regenerate via `pnpm gen-hover-registry` |
| `packages/core/src/ta/ta.types.test.ts` (or extend `compiler/src/api.types.test.ts`) | Create | scalar-source + series-source type regression |

## Non-Goals

- **No runtime change.** `ScalarOrSeries` / `readSourceValue` already do
  the coercion; this task only aligns the author type to it.
- **No converter change.** With the core type widened, the converter's
  existing scalar emissions become type-clean automatically. (The
  alternative converter-slotting fix is deferred — see README.)
- **No skills / docs regen expected.** `pnpm skills:gate` reads the
  *runtime* signatures (already `ScalarOrSeries`), so `primitives.md`
  does not change. `pnpm docs:check` compiles JSDoc `@example` blocks,
  which stay valid under a wider type. Confirm both are green rather than
  regenerating.

## Gates

- `pnpm typecheck` — passes (the point: false errors on scalar sources
  gone; series callers unaffected).
- `pnpm hover:check` — passes **after** regenerating the registry.
- `pnpm test` — passes, incl. `hoverRegistry.generated.test.ts` and the
  new type-regression test.
- `pnpm lint`, `pnpm format`.
- `pnpm skills:gate`, `pnpm docs:check` — confirm unchanged/green.

## Changeset

`.changeset/ta-source-scalar.md` — `"@invinite-org/chartlang-core":
minor`. Body: "Widen `ta.*` numeric source parameters to `number |
Series<number>` (`TaSource`) to match the runtime, which already accepts
a per-bar scalar. A computed source like `ta.ema((ma - ma[1]) / ma[1] *
100, n)` now type-checks — no `state.series` wrapper required."

## Acceptance Criteria

- A single exported `TaSource = number | Series<number>` alias exists in
  core with JSDoc explaining the scalar path; every numeric `ta.*`
  `source` param (plus `crossover`/`crossunder` `a`, `valuewhen`
  `source`) uses it.
- Boolean `condition` params and multi-output return types are
  untouched.
- `ta.ema((ma.current - ma[1]) / ma[1] * 100, n)` type-checks; a series
  source (`ta.ema(bar.close, 20)`) still type-checks; return types
  unchanged.
- Re-converting Trend Wizard / MASM Strat and running `tsc --noEmit`
  over the emitted `.chart.ts` yields **0** `number is not assignable to
  Series<number>` errors (from ~92 / ~11).
- Hover registry regenerated and committed; all gates green; changeset
  committed.
