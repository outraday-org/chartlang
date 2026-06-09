# Task 9 — PlotKind expansion (8 new kinds) + canvas2d renderers

> **Status: TODO**

## Goal

Widen `PlotKind` from 9 to 17 by adding the eight PLAN §7.2 kinds:
`shape`, `character`, `arrow`, `candle-override`, `bar-override`,
`bg-color`, `bar-color`, `horizontal-histogram`. Widen the matching
`PlotStyle` discriminated union in `@invinite-org/chartlang-adapter-kit`,
extend the runtime emit dispatch, add canvas2d renderers, and ship
one conformance scenario per new kind.

## Prerequisites

- Task 8: `host-quickjs` complete. Phase 5 host work behind us;
  Tier-2 ergonomics work begins here.

## Current Behavior

- `packages/core/src/plot/plot.ts` `PlotKind` is a 9-entry union.
- `packages/core/src/plot/plot.ts` `PlotOptsStyle` covers `line` /
  `step-line` / `histogram` / `marker`. Phase-4 added `marker`
  details but no glyph / arrow / override kinds.
- `packages/adapter-kit/src/types.ts` `PlotStyle` is a 7-variant
  discriminated union; no entries for the new kinds.
- `packages/runtime/src/emit/plotEmission.ts` dispatches on `style.kind`;
  no case branches for the new kinds.
- `examples/canvas2d-adapter/src/render/` houses one file per kind
  (`line.ts`, `histogram.ts`, `marker.ts`, …). Renders the existing 9
  kinds; no support for the new 8.

## Desired Behavior

- `PlotKind` widens to 17 entries.
- `PlotOptsStyle` widens with discriminants for every new kind:
  - `{ kind: "shape", shape: "circle" | "triangle-up" | … }`
  - `{ kind: "character", char: string, vAlign: "above" | "below" }`
  - `{ kind: "arrow", direction: "up" | "down" }`
  - `{ kind: "candle-override", bull: Color, bear: Color, doji?: Color }`
  - `{ kind: "bar-override", color: Color }`
  - `{ kind: "bg-color", color: Color, transp?: number }`
  - `{ kind: "bar-color", color: Color }`
  - `{ kind: "horizontal-histogram", buckets: ReadonlyArray<{ price: number, volume: number, color?: Color }> }`
- `adapter-kit` `PlotStyle` widens to match.
- `capabilities.plots(...)` builder accepts all 17 kinds.
- Runtime emit dispatch covers each new kind (emits the matching
  `PlotEmission.style` payload).
- canvas2d-adapter renders each new kind at acceptable visual
  fidelity. Pixel-perfect rendering is out of scope for the
  reference adapter; behavioural conformance is in scope.
- Conformance scenarios (one per new kind, 8 total) exercise each
  emit path.

## Requirements

### 1. `packages/core/src/plot/plot.ts` — widen `PlotKind` + `PlotOptsStyle`

Append the 8 new entries to `PlotKind`. Update the JSDoc preamble
to drop the "Phase 5 will add …" language and replace it with the
final 17-entry inventory.

Extend `PlotOptsStyle` with 8 new discriminants. Exact shape per the
PLAN §7.2 lines 1740–1753 references:

```ts
export type PlotOptsStyle =
    | { readonly kind: "line" }
    | { readonly kind: "step-line" }
    | { readonly kind: "horizontal-line" }
    | { readonly kind: "histogram"; readonly baseline?: number }
    | { readonly kind: "marker"; readonly shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond"; readonly size: number }
    | { readonly kind: "shape"; readonly shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond" | "cross" | "xcross" | "flag"; readonly size: number; readonly location?: "above" | "below" | "absolute" }
    | { readonly kind: "character"; readonly char: string; readonly size: number; readonly location?: "above" | "below" | "absolute" }
    | { readonly kind: "arrow"; readonly direction: "up" | "down"; readonly size: number }
    | { readonly kind: "candle-override"; readonly bull: Color; readonly bear: Color; readonly doji?: Color }
    | { readonly kind: "bar-override"; readonly color: Color }
    | { readonly kind: "bg-color"; readonly color: Color; readonly transp?: number }
    | { readonly kind: "bar-color"; readonly color: Color }
    | { readonly kind: "horizontal-histogram"; readonly buckets: ReadonlyArray<Readonly<{ price: number; volume: number; color?: Color }>> };
```

JSDoc for each new variant cites its Pine analogue (`plotshape`,
`plotchar`, `plotarrow`, `plotcandle`, `plotbar`, `bgcolor`,
`barcolor`, volume-profile horizontal-histogram).

### 2. `packages/adapter-kit/src/types.ts` — widen `PlotStyle`

The adapter-kit `PlotStyle` is the wire-format discriminated union the
runtime emits. Mirror the new variants from step 1 verbatim. The
runtime's `PlotOptsStyle` → `PlotStyle` translation in
`packages/runtime/src/emit/plotEmission.ts` already passes the
discriminant through unchanged for existing kinds; extend the
case branches for the new kinds.

### 3. `packages/adapter-kit/src/capabilities/capabilities.ts` — extend `capabilities.plots`

The existing `capabilities.plots(...)` builder accepts a
`ReadonlyArray<PlotKind>`. With the union widened, no signature
change is needed — but the helper category groupers (e.g.
`PHASE_2_PLOT_KINDS`) want a new `PHASE_5_PLOT_KINDS` constant for
adapters that want to opt into the full set. Add the constant and
export it.

### 4. `packages/adapter-kit/src/validation/validateEmission.ts` — extend

For each new `PlotEmission.style.kind`, add a structural validator
checking the discriminant + numeric ranges (e.g. `bucketize-volume`
non-negative; `transp ∈ [0, 100]` for `bg-color`). Mirror the
existing per-kind validator pattern.

### 5. `packages/runtime/src/emit/plotEmission.ts` — extend dispatch

For each new `PlotOptsStyle.kind`, the dispatch produces a
`PlotEmission` carrying the matching `style` payload. Most new
kinds are pass-through (the runtime doesn't transform the style);
`horizontal-histogram` packs the `buckets` array verbatim.

### 6. `packages/core/src/statefulPrimitives.ts` — no changes

Plot kinds are stateless additions; `STATEFUL_PRIMITIVES` is
unaffected.

### 7. `examples/canvas2d-adapter/src/render/<kind>.ts` — add per-kind renderers

The reference adapter already uses one file per kind under
`examples/canvas2d-adapter/src/render/` (mirroring the established
Phase-2 / Phase-3 pattern: `render/line.ts`, `render/histogram.ts`,
`render/marker.ts`, …). Add eight new sibling files
(`render/shape.ts`, `render/character.ts`, `render/arrow.ts`,
`render/candleOverride.ts`, `render/barOverride.ts`,
`render/bgColor.ts`, `render/barColor.ts`,
`render/horizontalHistogram.ts`), each with the matching
`<kind>.test.ts`. Behavioural acceptance:

- `shape`: render glyph at the world-anchor with `location` aligning
  above/below/at the bar.
- `character`: render UTF-8 char as text at the world-anchor.
- `arrow`: rendered as a filled triangle path pointing up/down.
- `candle-override`: replaces the body fill colour for the bar based
  on bull/bear/doji classification.
- `bar-override`: replaces the bar outline colour.
- `bg-color`: paints a translucent rectangle covering the chart-pane
  background at the bar's x-range.
- `bar-color`: tints the candle wick + body outline at the bar's
  x-range.
- `horizontal-histogram`: renders the `buckets` array as horizontal
  bars at the right edge of the chart's plot area (volume-profile
  visual). The width scales linearly with `bucket.volume`.

Behavioural acceptance: each renderer must emit a deterministic
`Path2D` / `canvas.fillRect` call sequence so the conformance
suite's pixel hash is stable.

### 8. `examples/canvas2d-adapter/src/capabilities.ts` — widen

Update `CANVAS2D_CAPABILITIES.plots` to include all 17 entries (the
existing 9 plus the 8 new).

### 9. Conformance scenarios

Existing scenarios sit flat under `packages/conformance/src/scenarios/`
with the `<name>.scenario.ts` suffix
(e.g. `barstateConfirmed.scenario.ts`). Keep the same convention —
do NOT introduce a `plotKinds/` sub-directory. Add 8 scenarios — one
per new kind — named `plotKind<Kind>.scenario.ts`:

- `inlineSource` declares a minimal `defineIndicator` script that
  calls `plot(value, { style: { kind: "<new-kind>", … } })`.
- Assertions: `plot-hash` against a captured golden output. No
  diagnostic emitted under happy path.
- An additional capability-gated scenario per kind: with
  `Capabilities.plots: new Set(["line"])`, the script's emit
  becomes a silent no-op (per PLAN §7.4 silent no-op semantics) +
  emits `unsupported-plot-kind` diagnostic.

Register all 16 scenarios in `packages/conformance/src/scenarios/index.ts`.

### 10. Tests

#### Unit tests (per kind, per package)

- `packages/core/src/plot/plot.test.ts` extends with type-level
  assertions for each new `PlotOptsStyle` variant.
- `packages/adapter-kit/src/validation/validateEmission.test.ts`
  extends per kind: happy-path + each documented numeric-range
  violation.
- `packages/runtime/src/emit/plotEmission.test.ts` extends per
  kind: emit dispatch produces the expected `PlotEmission.style`.
- Per-kind `examples/canvas2d-adapter/src/render/<kind>.test.ts`
  asserts the renderer produces the expected canvas op sequence
  (spy on `ctx.beginPath` / `ctx.fillRect` / `ctx.fillText` / …).

### 11. JSDoc

Each new `PlotOptsStyle` variant carries `@since 0.5` and an
`@example`:

```ts
/**
 * Glyph at world-anchor — Pine's `plotshape`. Location selects
 * vertical anchoring; `size` is in CSS pixels.
 *
 * @since 0.5
 * @example
 *     plot(bar.close, { style: { kind: "shape", shape: "triangle-up", size: 8, location: "below" } });
 */
```

### 12. CORE_AMBIENT_SHIM

`packages/compiler/src/program.ts` mirrors the widened types so
script-side typechecking under the compiler picks up the new
variants. Append the 8 new discriminants verbatim.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | Widen `PlotKind` (17 entries), extend `PlotOptsStyle` |
| `packages/core/src/plot/plot.test.ts` | Modify | Per-kind type asserts |
| `packages/adapter-kit/src/types.ts` | Modify | Widen `PlotStyle` |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Modify | Add `PHASE_5_PLOT_KINDS` |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | Per-kind structural validators |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | Per-kind validator tests |
| `packages/runtime/src/emit/plotEmission.ts` | Modify | Per-kind dispatch |
| `packages/runtime/src/emit/plotEmission.test.ts` | Modify | Per-kind emit tests |
| `examples/canvas2d-adapter/src/render/shape.ts` (+ 7 sibling per-kind files for `character`, `arrow`, `candleOverride`, `barOverride`, `bgColor`, `barColor`, `horizontalHistogram`) | Create | Per-kind renderers |
| `examples/canvas2d-adapter/src/render/<kind>.test.ts` (8 files) | Create | Per-kind renderer ops |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | Widen `plots` set |
| `packages/conformance/src/scenarios/plotKind<Kind>.scenario.ts` (8 files) + `plotKind<Kind>Gated.scenario.ts` (8 files) | Create | 8 happy + 8 gated scenarios |
| `packages/conformance/src/scenarios/index.ts` | Modify | Register new scenarios |
| `packages/compiler/src/program.ts` | Modify | Mirror new types in `CORE_AMBIENT_SHIM` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`
- `pnpm conformance`
- `pnpm readme:check`

## Changeset

`.changeset/phase5-plotkind-expansion.md` — `minor` bump for all
five touched packages. Body cites PLAN §7.2 + §7.4.

## Acceptance Criteria

- [ ] `PlotKind` is 17 entries; the matching union/discriminant
      types align across core / adapter-kit / runtime.
- [ ] `capabilities.plots(...)` accepts all 17 kinds; `PHASE_5_PLOT_KINDS`
      exported.
- [ ] Runtime emit dispatch + canvas2d render cover each new kind.
- [ ] 8 happy-path + 8 capability-gated conformance scenarios green.
- [ ] Silent no-op semantics preserved (Phase-1 invariant from
      PLAN §7.4) — script doesn't crash when capability is missing.
- [ ] 100% coverage; gates green.
- [ ] Changeset committed.
