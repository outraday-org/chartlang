# Task 7 — Runtime: 9 `ta.*` Primitives + Math Helpers (First Port)

> **Status: TODO**

## Goal

Port the 9 Phase-1 `ta.*` primitive implementations from
`../invinite/src/components/trading-chart/indicators/` into
`packages/runtime/src/ta/`, plus the chained-MA / source-field /
offset helpers they share. Each primitive ships with the §16.6
five-file test set (impl + property + golden + bench + conformance
hook). This is the **first port** in the project — the conventions
established here (origin header, behavioural reference, NOT
transcribed style) set the precedent for Phase 2's full-parity
work.

## Prerequisites

- Task 1 (core types + `ta` namespace surface).
- Tasks 5-6 (runtime data structures + execution loop:
  `RingBuffer`, `RuntimeContext`, `ACTIVE_RUNTIME_CONTEXT`,
  `StateStore`, `ScriptRunner`).

## Desired Behavior

After this task:

- `import { ta } from "@invinite-org/chartlang-runtime"` exposes
  the same `TaNamespace` shape as core, with real stateful
  implementations.
- The compiler-emitted bundle resolves `ta.ema("<slot>", src, 20)`
  to `runtime.ta.ema(...)` (Task 3's bundler rewrites the import
  source via esbuild's `alias` or — simpler — by emitting the
  compiled module as `import { ta, plot, hline, alert } from
  "@invinite-org/chartlang-runtime"`).
- Each `ta.*` primitive:
  - Allocates a `Series<number>` Proxy on first call against its
    slot id; caches it via `state.taSlots.set(slotId, series)`.
  - Returns the same Proxy identity on subsequent calls — required
    by §6.6 (`const ema = ta.ema(...)` must work across bars).
  - Implements a `replaceHead` mode triggered when
    `RuntimeContext.isTick === true` so realtime ticks recompute
    the head slot from the previous closed state, not append (§6.7).
  - Honours NaN warmup (§6.3 / §16.2): emits `NaN` until the
    primitive's warmup count is satisfied.
- The 5-file convention is in place for every primitive (`<id>.ts`,
  `<id>.test.ts`, `<id>.property.test.ts`, `<id>.golden.test.ts`,
  `<id>.bench.test.ts`). Conformance scenarios land in Task 12.

## Requirements

### 1. Port convention (`packages/runtime/src/ta/CLAUDE.md`)

Document the conventions every port follows. This file IS the
deliverable — Phase 2 ports honour it.

Conventions:

- **Origin header.** Every ported file carries the 4-line
  CONTRIBUTING §4 provenance block (commit SHA pinned at port
  time — `d2d1043c1b039f66d2f3674526d303d31cf2f1e0` if Task 7
  ships against today's invinite HEAD), plus a one-line
  translate-not-transcribe note:
  ```ts
  // Copyright (c) 2026 Invinite. Licensed under the MIT License.
  // See the LICENSE file in the repo root for full license text.
  //
  // Ported from invinite/src/components/trading-chart/indicators/<id>.ts
  //   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
  // Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
  // provenance contract; the math is the reference, the code style is not.
  // Structural choices (callsite-id slot, Series<T> proxy, replaceHead
  // mode) follow chartlang's primitive shape — NOT invinite's
  // IndicatorPlugin shape.
  ```
- **Float64 everywhere.** Source values arrive as `number` (Float64).
  Outputs land in `Float64RingBuffer`. No Decimal, no BigInt.
- **Two callsites per primitive:** `append(bar)` and `replaceHead(bar)`.
  The dispatcher reads `RuntimeContext.isTick` and picks one.
- **Slot state.** Each primitive stores its hidden state under
  `taSlots.get(slotId)`. Phase 1's slot value is a typed record
  (e.g. `{ series, lastEma, count }` for EMA). Phase 5 persistence
  serialises this — keep the slot value JSON-clean.
- **Output Series identity.** Cached on first call; returned
  thereafter. Stored as `taSlots.get(slotId).series`.
- **Universal `opts.offset`** — Phase 1 ships the helper but uses
  default `0` everywhere. Phase 4 wires the option per §9.1.

### 2. Helpers (`packages/runtime/src/ta/lib/`)

Port the helpers PLAN.md §9.4 enumerates as Phase-1 prerequisites:

All `Source` paths below are relative to
`../invinite/src/components/trading-chart/indicators/lib/`. Invinite
HEAD when these references were verified:
`d2d1043c1b039f66d2f3674526d303d31cf2f1e0`.

| File | Source | Purpose |
|---|---|---|
| `lib/applyOffset.ts` | `apply-offset.ts` | Pine-parity bar shift (default 0 in Phase 1). |
| `lib/readSourceField.ts` | `read-source-field.ts` (note: invinite uses `extract-source-series.ts` for some flows; cross-check both when porting) | "open"/"high"/etc. → Series accessor. |
| `lib/pickCandleSource.ts` | `pick-candle-source.ts` | Helper around `readSourceField` for hl2/hlc3/ohlc4/hlcc4. |
| `lib/emaFloat64.ts` | `ema-of-float64.ts` | EMA core for `ta.ema` + MACD lines. |
| `lib/smaFloat64.ts` | `sma-of-float64.ts` (NOTE: no equivalent file named `sma-of-float64.ts` exists at HEAD; the SMA core lives inline in `compute-ma-of-float64.ts`. Extract it during the port and document the extraction in the file's provenance header.) | SMA core for `ta.sma` + BB middle. |
| `lib/rollingStddev.ts` | `rolling-stddev.ts` | Welford-style rolling stddev for `ta.stdev`/`ta.bb`. |
| `lib/trSeries.ts` | `tr-series.ts` | True Range / ATR helper. |
| `lib/wilderSmoothing.ts` | NEW (extracted from inline Wilder smoothing in invinite's `indicators/rsi.ts` and `indicators/atr.ts`; **no standalone `wilder-smoothing.ts` exists upstream** — `wilder-directional.ts` is a different helper for ADX-style directional indicators). | Wilder's smoothing α = 1/N for RSI + ATR. |

Each helper has a co-located `*.test.ts` against
`buildVisualBaselineCandles(100)`-equivalent fixtures. Port the
invinite test verbatim, then retarget array indices onto the
`Float64RingBuffer` / numeric `at(n)` shape.

### 3. The 9 `ta.*` primitives

For each:

- Public signature matches the `TaNamespace` shape from Task 1.
- Internal signature is `(slotId: string, ...rest) → Series<...>`.
- The compiler injects `slotId` as the first argument; the runtime
  uses it to find / create the slot.

#### 3.1 `ta/sma.ts`

```ts
export function sma(
    slotId: string,
    source: Series<number>,
    length: number,
    _opts?: SmaOpts,
): Series<number>;
```

Math: rolling mean over the last `length` values of `source`.
Warmup: `length - 1` bars NaN. Reference: `indicators/sma.ts` +
`lib/sma-of-float64.ts`.

Slot value: `{ outBuffer: Float64RingBuffer, series: Series<number>,
sumWindow: number, count: number }`.

#### 3.2 `ta/ema.ts`

Recursive `EMA[t] = α·x[t] + (1-α)·EMA[t-1]`, α = 2/(N+1).
Warmup: `length - 1`. Reference: `indicators/ema.ts` +
`lib/ema-of-float64.ts`.

Slot value: `{ outBuffer, series, alpha, prevEma, count }`.

#### 3.3 `ta/stdev.ts`

Rolling sample standard deviation over `length`. Welford's online
algorithm keeps numerical accuracy. Default `biased: false`
(sample). Warmup: `length - 1`. Reference:
`lib/rolling-stddev.ts`.

Slot value: `{ outBuffer, series, window: Float64RingBuffer of size length, sumX, sumX2 }`.

#### 3.4 `ta/bb.ts` (multi-output)

```ts
export function bb(
    slotId: string,
    source: Series<number>,
    length: number,
    opts?: BbOpts,
): BbResult;   // { upper, middle, lower } per Task 1.
```

Default `multiplier = 2`. Middle = SMA(length); upper / lower =
middle ± multiplier × stdev(length). Returns three `Series<number>`
all sized to `length + 1`. Warmup matches SMA.

Slot value: cached `{ upper, middle, lower }` triple — same record
returned on every call so consumers can destructure once.

#### 3.5 `ta/rsi.ts`

Wilder RSI. Warmup: `length`. Reference: `indicators/rsi.ts`
(Wilder smoothing is inline there — no separate
`lib/wilder-smoothing.ts` exists upstream; the helper extraction
lives in `lib/wilderSmoothing.ts` per the §2 table). Output range
`[0, 100]` (asserted by property test).

Slot value: `{ outBuffer, series, prevClose, avgGain, avgLoss, count }`.

#### 3.6 `ta/macd.ts` (multi-output)

```ts
export function macd(
    slotId: string,
    source: Series<number>,
    opts?: MacdOpts,
): MacdResult;  // { macd, signal, hist }
```

Defaults: `fastLength: 12`, `slowLength: 26`, `signalLength: 9`.
`macd = ema(src, fast) - ema(src, slow)`, `signal = ema(macd,
signalLength)`, `hist = macd - signal`. Warmup matches the slowest
chain. Reference: `indicators/macd.ts` (folding the private EMA
copy onto the `emaFloat64` helper per §9.4).

Slot value: chained sub-slots (`fastEma`, `slowEma`, `signalEma`)
each storing prev-ema + alpha. Output triple cached.

#### 3.7 `ta/atr.ts`

Wilder ATR = Wilder smoothing of True Range. Wilder α = 1/length.
Warmup: `length`. Reference: `indicators/atr.ts` + `lib/tr-series.ts`.

`ta.atr(length)` takes no `source` — derives from
`mainStream.ohlcv.high / low / close` via the runtime context.

Slot value: `{ outBuffer, series, prevAtr, prevClose, count }`.

#### 3.8 `ta/crossover.ts`

Boolean series, `true` exactly at the bar `a[0] > b[0] && a[1] <=
b[1]`. NaN-safe: if any of the four values is NaN, result is
`false`.

**No invinite reference.** Cross-detection is not a standalone
indicator in invinite — the math implemented here follows the
canonical Pine `ta.crossover` / `ta.crossunder` semantics. The
helper-style code lives only in `tools/cross-line-tool.ts` (a
drawing tool, not an indicator) so there's nothing to port.
Document this in the file header as "no invinite source — Phase-1
new code, semantics per Pine".

`b` can be a scalar `number` — internally wrap as a constant
series.

Slot value: `{ outBuffer: RingBuffer<boolean>, series }`. No
state across bars beyond the output series — current vs prev is
read from `a`/`b` directly.

#### 3.9 `ta/crossunder.ts`

Mirror: `a[0] < b[0] && a[1] >= b[1]`. Same "no invinite source"
note in the header.

### 4. Wiring into the runtime

The compiler emits **direct calls** to runtime primitive functions
— no callable-wrapper shim. The runtime exports `ta.ema` as the
function the bundled script invokes; the compiler inlines the
`slotId` literal as the first argument (Task 2's transformer).
Make every runtime impl accept `slotId` as the leading param:

```ts
function ema(
    slotId: string,
    source: Series<number>,
    length: number,
    _opts?: EmaOpts,
): Series<number> {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("ta.ema called outside an active script step");
    // ... slot lookup, compute, return
}
```

`packages/runtime/src/ta/registry.ts`:

```ts
export const TA_REGISTRY = Object.freeze({
    sma, ema, stdev, bb, rsi, macd, atr, crossover, crossunder,
} as const);

export const ta: RuntimeTaNamespace = /* @__PURE__ */ Object.freeze({
    sma, ema, stdev, bb, rsi, macd, atr, crossover, crossunder,
});
```

**Type wiring.** Core's `TaNamespace` is the SCRIPT-FACING type
(no slot). Runtime declares a separate `RuntimeTaNamespace` whose
methods take an extra leading `slotId: string`. The compiler
bundles script imports against `RuntimeTaNamespace`, transparent
to the author. Define `RuntimeTaNamespace` in `registry.ts` and
re-export it from the runtime barrel so Task 9's worker boot can
import the right type.

### 5. Tests (§16.6 five-file set per primitive)

For each primitive `<id>`:

| File | Coverage |
|---|---|
| `<id>.test.ts` | Unit tests pinning math against `buildVisualBaselineCandles(100)`-equivalent fixtures (port verbatim from invinite). |
| `<id>.property.test.ts` | `fast-check` invariants — length, warmup, NaN-correctness, range invariants (e.g. RSI ∈ [0, 100]), determinism, reference-equivalence (full recompute vs incremental). |
| `<id>.golden.test.ts` | Run primitive against `packages/conformance/fixtures/goldenBars.json` (Task 12 generates the fixture; this task hashes the output and pins). |
| `<id>.bench.test.ts` | Vitest bench, `THRESHOLD_MS = ceil(median × 3)`. |
| Conformance scenario | Lands in Task 12 — primitive must be used in one scenario. |

`fast-check ^3.20.0` is already a `packages/runtime` devDep —
added in Task 5 as the first consumer. No root-level dep needed:
the runtime package owns property-test tooling.

### 6. JSDoc on every primitive

Per §17.2:

```ts
/**
 * Exponential moving average.
 *
 * @formula EMA[t] = α·x[t] + (1−α)·EMA[t−1], α = 2/(N+1)
 * @warmup length-1
 * @experimental
 * @since 0.1
 * @example
 *     import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "EMA(20)",
 *         apiVersion: 1,
 *         compute({ bar, ta, plot }) {
 *             plot(ta.ema(bar.close, 20));
 *         },
 *     });
 */
export function ema(...): Series<number>;
```

The `@example` block uses the **core** import surface (script
author POV), so the Task-3 doc-check executor compiles it through
the full pipeline. Broken example → red build.

### 7. Coverage exemptions

Per §16.1 exclude list:
- `packages/runtime/src/ta/index.ts` (barrel) — excluded.
- `packages/runtime/src/ta/registry.ts` — included; tested via
  `expect(TA_REGISTRY.size).toBe(9)` plus per-key existence.
- `packages/runtime/src/ta/lib/*.ts` — included; tested via the
  consumer primitive tests AND dedicated `<helper>.test.ts` for
  any branch the primitives don't exercise (e.g. extreme inputs).

### 8. NaN handling (§6.3 / §16.2)

Every primitive returns `NaN` for `series[N]` when `N >=
filled-length`. The `Float64RingBuffer.at()` already returns
`NaN` for OOR (Task 5). Primitives must propagate `NaN` cleanly
(the execution loop in Task 6 owns the bar↔series sync that lets
these propagation invariants hold):

- Skip the bar's update if `source.current` is `NaN`.
- Output `NaN` for `output[0]` on bars where state isn't warm.
- Property test asserts: first `warmupBars` outputs are `NaN`,
  every subsequent output is finite.

`crossover`/`crossunder`: NaN inputs → `false` output (not NaN).
This matches Pine — boolean-typed series can't carry NaN.

### 9. Reference-equivalence test

Per §16.2: a full recompute over `N` bars must equal incremental
compute over `N-1` bars + 1 new bar:

```ts
it.prop([fc.array(arbitraryBar, { minLength: 30 })])("full == incremental + 1", (bars) => {
    const full = computeAllAtOnce(bars);
    const incremental = computeIncremental(bars);
    expect(arraysClose(full, incremental, 1e-12)).toBe(true);
});
```

This property catches every place a primitive's `replaceHead` mode
diverges from `append` mode.

### 10. Remove `PACKAGE_VERSION` (already removed in Task 5)

Confirm Task 5's removal stands; the runtime barrel re-exports
the data-structures surface (Task 5), `createScriptRunner` (Task
6), AND `ta` (this task).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/ta/CLAUDE.md` | Create | Port convention reference. |
| `packages/runtime/src/ta/lib/applyOffset.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/readSourceField.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/pickCandleSource.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/emaFloat64.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/smaFloat64.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/rollingStddev.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/trSeries.ts` | Create | Port. |
| `packages/runtime/src/ta/lib/wilderSmoothing.ts` | Create | Extract from RSI/ATR. |
| `packages/runtime/src/ta/lib/*.test.ts` | Create | Helper-only unit tests. |
| `packages/runtime/src/ta/sma.ts` | Create | Primitive impl. |
| `packages/runtime/src/ta/ema.ts` | Create | Primitive impl. |
| `packages/runtime/src/ta/stdev.ts` | Create | Primitive impl. |
| `packages/runtime/src/ta/bb.ts` | Create | Multi-output. |
| `packages/runtime/src/ta/rsi.ts` | Create | Wilder RSI. |
| `packages/runtime/src/ta/macd.ts` | Create | Multi-output. |
| `packages/runtime/src/ta/atr.ts` | Create | Derives from runtime context's OHLC. |
| `packages/runtime/src/ta/crossover.ts` | Create | Boolean primitive. |
| `packages/runtime/src/ta/crossunder.ts` | Create | Boolean primitive. |
| `packages/runtime/src/ta/<id>.test.ts` | Create (×9) | Per-primitive unit tests. |
| `packages/runtime/src/ta/<id>.property.test.ts` | Create (×9) | `fast-check` invariants. |
| `packages/runtime/src/ta/<id>.golden.test.ts` | Create (×9) | Hash of output against goldenBars fixture. |
| `packages/runtime/src/ta/<id>.bench.test.ts` | Create (×9) | Bench + threshold. |
| `packages/runtime/src/ta/registry.ts` | Create | `TA_REGISTRY` frozen map. |
| `packages/runtime/src/ta/index.ts` | Create | Re-exports `ta`. |
| `packages/runtime/src/index.ts` | Modify | Add `ta` to the runtime barrel. |
| `packages/runtime/package.json` | (no change — `fast-check` already added in Task 5) | n/a |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-runtime test` passes with 100%
  coverage across every metric.
- Every primitive has 5 test files (unit + property + golden +
  bench + co-existing conformance hook). Conformance scenarios
  themselves land in Task 12.
- `TA_REGISTRY` has exactly 9 entries.
- A compiled EMA-cross script (from Task 3) runs end-to-end against
  the Task-5 runtime + this task's primitives and produces:
  - 1 EMA series matching `ema-of-float64.ts` output byte-for-byte.
  - 1 crossover Boolean series matching the
    `indicators/cross-overlay-builder.ts` reference.
- NaN-warmup property tests pass for all 9 primitives.
- RSI output ∈ [0, 100] property holds.
- Reference-equivalence property (full == incremental) holds for
  every primitive at `N ∈ [warmup, 1000]`.
- Bench median × 3 thresholds pass on local Apple-silicon.
- `pnpm docs:check` succeeds — every `@example` block in `ta/*`
  compiles via the Task-3 compiler.
- All earlier gates (lint, format, readme, conformance,
  coverage:report) stay green.

## Note on §22.10 / CONTRIBUTING §4 "seven-item" set

CONTRIBUTING.md §4 lists "auto-generated `docs/primitives/ta/<id>.md`"
as the seventh item of the per-port set. Phase 1 ships the JSDoc
source for every primitive (with `@formula` + `@warmup` + `@since`
+ `@example` + `@experimental` so `gen-docs.ts` has everything it
needs to read later), but **does not** ship `gen-docs.ts` or the
generated pages. Per the Phase-1 README "Deferred / Follow-Up
Work" section, that pair lands with Phase 2's full-parity ports.
This is the deliberate scope cut — no missing docs page in this
task constitutes a failure.
