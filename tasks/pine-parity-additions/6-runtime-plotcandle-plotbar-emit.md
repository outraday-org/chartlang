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
quad. On tick, the head emission is replaced (not appended) so a
partial-bar candle does not leave a stale bar — mirror how `plotImpl`
already handles tick vs close.

## Requirements

### 1. Emit handlers (`packages/runtime/src/emit/plot.ts`, or a sibling)

Add `plotcandleImpl(slotId, open, high, low, close, opts)` and
`plotbarImpl(...)`. Each:

1. Resolve the four sources to scalars via the same source-reader the
   runtime uses for `plot(value)` (search how `plotImpl` coerces a
   `number | Series<number>` value — reuse it; do **not** add a parallel
   reader). A non-finite input becomes `null` in the wire style.
2. **Quad coherence:** if the four resolved values are a mix of finite
   and `null`, emit `null` for all four (a partial candle is not
   renderable — collapse to a gap) OR push a `malformed-emission`
   diagnostic — match the invariant chosen in Task 4's
   `validateEmission` (all-four-or-none). Keep runtime + validation in
   agreement; add a unit test pinning the chosen behavior.
3. Resolve colors: `candle` → `bull`/`bear`/`doji` (default to the
   palette bull/bear the `candle-override` emit already uses — reuse
   those defaults, do not hardcode new hex); `ohlc-bar` → `color`, with
   `upColor`/`downColor` selected by `close ≥ open` when provided.
4. Build the wire style (`kind: "candle" | "ohlc-bar"` + quad + colors)
   and the `PlotEmission` (mirror `plotImpl`: `slotId`, `title`,
   `style`, `bar`, `time`, `value: close ?? null`, `pane`, and the
   omit-when-default `visible` / `z` spread).
5. Route through the **existing** capability gate — if
   `ctx.capabilities.plots` lacks `"candle"` / `"ohlc-bar"`, push the
   `unsupported-plot-kind` warning and return (silent no-op). Do not
   duplicate the gate; call the same path `plotImpl` uses.

### 2. Register the runtime holes

Wherever the runtime installs plot-family callables on the
`ComputeContext` (the same place `bgcolor` / `barcolor` are installed),
install `plotcandle` / `plotbar` → the new impls. Mirror the existing
plot-family installation exactly.

### 3. Tests (`packages/runtime/src/emit/*.test.ts`)

- **Unit:** a `plotcandle` call emits one `candle` emission with the
  resolved OHLC quad + default colors; a `plotbar` emits an `ohlc-bar`.
  All-null bar ⇒ a gap emission (all four `null`). Mixed-null bar ⇒ the
  Task-4-agreed behavior (all-null collapse or `malformed-emission`).
  `upColor`/`downColor` selection by `close ≥ open`.
- **Capability gate:** against a capability set lacking `"candle"`, the
  call emits no plot and pushes exactly one `unsupported-plot-kind`
  warning (mirror the existing gate test).
- **Tick:** a tick after a close `replaceHead`s the emission rather than
  appending a second candle for the same bar.
- **Validation round-trip:** feed the emitted style through
  `validateEmission` (Task 4) and assert `ok` for a well-formed candle,
  `bad` for a hand-crafted mixed-null quad.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/plot.ts` (or new `plotCandle.ts` sibling) | Modify/Create | `plotcandleImpl` / `plotbarImpl` |
| `packages/runtime/src/<compute-context install>.ts` | Modify | install holes on `ComputeContext` |
| `packages/runtime/src/emit/*.test.ts` | Modify/Create | unit + gate + tick + validation tests |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (runtime 100% coverage — every branch: finite/null/mixed,
  gate hit/miss, tick/close)
- `pnpm bench:ci` (plot emit is a hot path — assert no regression if a
  bench exists for `plotImpl`)

## Changeset

`.changeset/runtime-plotcandle-plotbar.md` —
`"@invinite-org/chartlang-runtime": minor`. Body: "Emit `candle` /
`ohlc-bar` plot styles from `plotcandle` / `plotbar`, gated on adapter
capability."

## Acceptance Criteria

- `plotcandle` / `plotbar` emit well-formed `candle` / `ohlc-bar`
  emissions with the OHLC quad + resolved colors, reusing the existing
  source reader, color defaults, and capability gate (no duplication).
- Quad-coherence behavior matches Task 4 validation and is pinned by a
  test; tick replaces the head; missing capability is a silent no-op.
- Runtime coverage 100%; validation round-trip green; changeset committed.
