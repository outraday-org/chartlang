# Runtime `plotcandle` / `plotbar` emit + capability gate

> **Status: TODO**

## Goal

Implement the runtime behavior for `plotcandle` / `plotbar`: resolve the
four per-bar OHLC values + colors into a `kind: "candle"` /
`"ohlc-bar"` `PlotEmission`, route through the existing capability gate,
and cover it with runtime tests.

## Prerequisites

Task 4 (wire styles + validation), Task 5 (core holes + signatures).

## Current Behavior

`packages/runtime/src/emit/plot.ts` turns a `plot()` call into a
`PlotEmission`: `buildStyle()` (~lines 28-86) maps each author style
kind to the wire style, and `plotImpl()` (~lines 108-184) builds the
emission and applies the capability gate (~lines 117-127,
`unsupported-plot-kind`). `candle-override` / `bar-override` /
`filled-band` all flow through here. There is no `plotcandle` /
`plotbar` handler.

## Desired Behavior

Each call reads its four OHLC sources to per-bar scalars, resolves the
body color, and emits one `PlotEmission` whose `style` carries the OHLC
quad. Tick vs close needs **no bespoke handling in the impl**:
`plotImpl` (`emit/plot.ts:108-184`) emits a point on every call and the
per-bar reconciliation happens downstream in the step/drain machinery —
mirror that exactly (a tick-then-close sequence must behave the same as
an equivalent `plot()` call; do not invent a `replaceHead` path in the
emit layer).

## Requirements

### 1. Emit handlers (`packages/runtime/src/emit/plot.ts`, or a sibling)

Add `plotcandleImpl(slotId, open, high, low, close, opts)` and
`plotbarImpl(...)`. Each:

1. Resolve the four sources to scalars via `resolveValue()` — the
   file-private reader at `emit/plot.ts:23-26` (`typeof value ===
   "number" ? value : value.current`, finite-checked → `number | null`).
   Reuse it (colocate the impls in `plot.ts`, or export it to a
   sibling); do **not** add a parallel reader. A non-finite input
   becomes `null` in the wire style.
2. **Quad coherence:** if the four resolved values are a mix of finite
   and `null`, emit `null` for all four (a partial candle is not
   renderable — collapse to a gap) OR push a `malformed-emission`
   diagnostic — match the invariant chosen in Task 4's
   `validateEmission` (all-four-or-none). Keep runtime + validation in
   agreement; add a unit test pinning the chosen behavior.
3. Resolve colors: `candle` → `bull`/`bear`/`doji`. There is **no
   existing runtime palette constant** to reuse (`candle-override`'s
   `bull`/`bear` are author-required, and the documented reference
   values `#26a69a` / `#ef5350` appear only in the `plot.ts:167` JSDoc
   example) — define module-level `DEFAULT_CANDLE_BULL` /
   `DEFAULT_CANDLE_BEAR` constants (those documented values) in ONE
   place next to the impls; the wire style's `bull`/`bear` are required
   (Task 4), so the emit always fills them. `ohlc-bar` → `color`, with
   `upColor`/`downColor` selected by `close ≥ open` when provided.
4. Build the wire style (`kind: "candle" | "ohlc-bar"` + quad + colors)
   and the `PlotEmission` (mirror `plotImpl`: `slotId`, `title`,
   `style`, `bar`, `time`, `value: close ?? null`, `pane`, and the
   omit-when-default `visible` / `z` spread). `value: close ?? null`
   is load-bearing: the conformance `plot-hash` covers `{ bar, value }`
   tuples, so this is what makes Task 8's scenarios pinnable.
5. Route through the **existing** capability gate — if
   `ctx.capabilities.plots` lacks `"candle"` / `"ohlc-bar"`, push the
   `unsupported-plot-kind` warning and return (silent no-op). Do not
   duplicate the gate; call the same path `plotImpl` uses
   (`emit/plot.ts:117-127`).

### 2. Register the runtime holes

Install `plotcandle` / `plotbar` on the `ComputeContext` in
`packages/runtime/src/buildComputeContext.ts` (lines 36-40 install
`plot` / `hline` / `bgcolor` / `barcolor`). Mirror the `bgcolor` /
`barcolor` chain exactly: impl module in `packages/runtime/src/emit/`
(`bgcolor.ts` / `barcolor.ts` are the precedent — each dispatches into
the shared plot-emit machinery), re-exported through `emit/index.ts`
and `primitives.ts`. The core-side `ComputeContext` members landed in
Task 5 (`packages/core/src/types.ts`).

### 3. Tests (`packages/runtime/src/emit/*.test.ts`)

- **Unit:** a `plotcandle` call emits one `candle` emission with the
  resolved OHLC quad + default colors; a `plotbar` emits an `ohlc-bar`.
  All-null bar ⇒ a gap emission (all four `null`). Mixed-null bar ⇒ the
  Task-4-agreed behavior (all-null collapse or `malformed-emission`).
  `upColor`/`downColor` selection by `close ≥ open`.
- **Capability gate:** against a capability set lacking `"candle"`, the
  call emits no plot and pushes exactly one `unsupported-plot-kind`
  warning (mirror the existing gate test).
- **Tick:** a tick-then-close sequence produces the same emission-stream
  shape as an equivalent `plot()` call over the same bars (parity with
  `plotImpl` — the impl adds no tick-specific branching).
- **Validation round-trip:** feed the emitted style through
  `validateEmission` (Task 4) and assert `ok` for a well-formed candle,
  `bad` for a hand-crafted mixed-null quad.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/plot.ts` (or new `plotCandle.ts` sibling reusing `resolveValue`) | Modify/Create | `plotcandleImpl` / `plotbarImpl` + default-color constants |
| `packages/runtime/src/buildComputeContext.ts` | Modify | install both on `ComputeContext` (lines 36-40 block) |
| `packages/runtime/src/emit/index.ts` + `packages/runtime/src/primitives.ts` | Modify | re-export chain (the `bgcolor`/`barcolor` precedent) |
| `packages/runtime/src/emit/*.test.ts` | Modify/Create | unit + gate + tick-parity + validation tests |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (runtime 100% coverage — every branch: finite/null/mixed,
  gate hit/miss, tick/close)
- `pnpm bench:ci` (plot emit is a hot path — `plot.bench.ts` +
  `plot.bench.test.ts` exist with a 4000 ms / 10k-emission threshold;
  keep them green)

## Changeset

`.changeset/runtime-plotcandle-plotbar.md` —
`"@invinite-org/chartlang-runtime": minor`. Body: "Emit `candle` /
`ohlc-bar` plot styles from `plotcandle` / `plotbar`, gated on adapter
capability."

## Acceptance Criteria

- `plotcandle` / `plotbar` emit well-formed `candle` / `ohlc-bar`
  emissions with the OHLC quad + resolved colors, reusing `resolveValue`
  and the existing capability gate (no duplication); default bull/bear
  constants defined once.
- Quad-coherence behavior matches Task 4 validation and is pinned by a
  test; tick behavior is `plotImpl`-parity (no bespoke tick branch);
  missing capability is a silent no-op.
- Runtime coverage 100%; validation round-trip green; changeset committed.
