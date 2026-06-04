# Task 1 — PlotKind expansion + canvas2d renderers + `Bar` extension + `Scenario.inlineSource` extension

> **Status: TODO**

## Goal

Land three foundational widenings every Phase-2 task depends on:

1. **`PlotKind` expansion + canvas2d renderers + `PlotStyle` /
   capability / validation wiring** — the six new kinds Phase-2
   ports need (`histogram`, `bars`, `area`, `filled-band`, `label`,
   `marker`). Every subsequent port plots through these — no
   per-port renderer work.
2. **`Bar` extension with `hl2` / `hlc3` / `ohlc4` / `hlcc4`** —
   the runtime's `BarView` (`packages/runtime/src/streamState.ts`)
   already pre-computes these on every close; Phase 2 surfaces
   them to scripts so authors can write `ta.cci(bar.hlc3, 20)`
   like Pine. Backfilling this in Task 1 unblocks every later
   port whose scenarios reference derived sources.
3. **`Scenario.inlineSource?: string` extension** — Phase-2
   scenarios (~80) carry their `defineIndicator` source inline
   rather than spawning new files in `examples/scripts/`.
   `runConformanceSuite` writes inline source to the existing
   `.cache/` tmp file path and `import()`s it. Keeps the
   curated `examples/scripts/` set at 3 demo scripts.

## Prerequisites

- Phase 1 walking skeleton complete.

## Current Behavior

`packages/core/src/plot/plot.ts` declares
`PlotKind = "line" | "step-line" | "horizontal-line"`. The matching
`PlotStyle` discriminated union in `packages/adapter-kit/src/
types.ts` carries three variants. `validateEmission` recognises
those three. `capabilities.line()` / `stepLine()` /
`horizontalLine()` / `allLines()` builders ship.
`CANVAS2D_CAPABILITIES.plots = capabilities.union(line(),
horizontalLine())`. Renderers live in
`examples/canvas2d-adapter/src/render/line.ts` and
`horizontalLine.ts`.

## Desired Behavior

After this task:

- `PlotKind` extends to nine kinds: `"line" | "step-line" |
  "horizontal-line" | "histogram" | "bars" | "area" |
  "filled-band" | "label" | "marker"`.
- `PlotStyle` discriminated union (in
  `packages/adapter-kit/src/types.ts`) gains the matching six
  variants per PLAN §7.3 exactly (no schema drift).
- `validateEmission` (`packages/adapter-kit/src/validation/
  validateEmission.ts`) recognises every new `style.kind` and
  validates its payload fields.
- `capabilities` builder gains `histogram()`, `bars()`, `area()`,
  `filledBand()`, `label()`, `marker()`, and `allPhase2Plots()`
  (the union of every kind that lands in this task plus the three
  Phase-1 kinds).
- `CANVAS2D_CAPABILITIES.plots` flips to
  `capabilities.allPhase2Plots()`.
- Six new pure renderers under
  `examples/canvas2d-adapter/src/render/` — one per kind — each
  accepting the existing `RenderCtx` test seam.
- `RenderCtx` extends to cover the surfaces the new renderers
  call (`fillRect` for histogram/bars, `fillText` for label, etc.)
  — keep the additions minimal and document in
  `examples/canvas2d-adapter/CLAUDE.md`.

## Requirements

### 1. `packages/core/src/plot/plot.ts`

Extend the `PlotKind` union:

```ts
export type PlotKind =
    | "line"
    | "step-line"
    | "horizontal-line"
    | "histogram"
    | "bars"
    | "area"
    | "filled-band"
    | "label"
    | "marker";
```

JSDoc preserves the existing block; the Phase-1 / Phase-2
boundary note updates to "Phase 2 adds histogram / bars / area /
filled-band / label / marker; Phase 5 adds shape / character /
arrow / candle-override / bar-override / bg-color / bar-color /
vertical-line / horizontal-histogram." Keep `@since 0.2` on the
extended JSDoc for the new kinds list. Bump the
`@formula`-equivalent note to reflect the additive expansion.

### 2. `packages/adapter-kit/src/types.ts`

Extend the `PlotStyle` discriminated union with the six new
variants, mirroring §7.3 exactly:

```ts
| { readonly kind: "histogram" | "bars"; readonly baseline: number }
| { readonly kind: "area";
    readonly lineWidth: number; readonly lineStyle: LineStyle;
    readonly fillAlpha: number }
| { readonly kind: "filled-band";
    readonly upper: number | null; readonly lower: number | null;
    readonly alpha: number }
| { readonly kind: "label"; readonly text: string;
    readonly position: "above" | "below" | "anchor" }
| { readonly kind: "marker";
    readonly shape: "circle" | "triangle-up" | "triangle-down" |
                    "square" | "diamond";
    readonly size: number }
```

Phase-1 invariants stay — every variant is `readonly`-only, no
class types, no `Date` / `Map`.

### 3. `packages/adapter-kit/src/capabilities/capabilities.ts`

Extend the `capabilities` const with the six new builders:

```ts
histogram(): ReadonlySet<PlotKind> { return new Set(["histogram"]); },
bars(): ReadonlySet<PlotKind>      { return new Set(["bars"]); },
area(): ReadonlySet<PlotKind>      { return new Set(["area"]); },
filledBand(): ReadonlySet<PlotKind> { return new Set(["filled-band"]); },
label(): ReadonlySet<PlotKind>     { return new Set(["label"]); },
marker(): ReadonlySet<PlotKind>    { return new Set(["marker"]); },
allPhase2Plots(): ReadonlySet<PlotKind> {
    return new Set([
        "line", "step-line", "horizontal-line",
        "histogram", "bars", "area", "filled-band", "label", "marker",
    ]);
},
```

`@since 0.2` on each new method; `@experimental` until §22.10
freezes the surface.

### 4. `packages/adapter-kit/src/validation/validateEmission.ts`

Add a `style.kind`-switch arm for each new variant. Validation
rules:

- `histogram` / `bars`: `baseline` is a finite number.
- `area`: `lineWidth ≥ 0`, `lineStyle` is in the LineStyle set,
  `0 ≤ fillAlpha ≤ 1`.
- `filled-band`: `upper` / `lower` each `null` or finite, and not
  both `null`; `0 ≤ alpha ≤ 1`.
- `label`: `text` is a non-empty string ≤ 128 chars; `position`
  in the literal set.
- `marker`: `shape` in the literal set; `size > 0` and finite.

Any rejection emits a `malformed-emission` diagnostic per Phase 1
convention; the offending emission is dropped.

### 5. `examples/canvas2d-adapter/src/render/`

Add six pure renderers, each taking `RenderCtx` + the world-space
payload. Each renderer mirrors the Phase-1 helper shape — no DOM,
no state, no async.

| File | Contract |
|---|---|
| `histogram.ts` | `drawHistogram(ctx, { x, y, baseline, color, width })`. Fills a rectangle from `baseline` to `y` at `x`. |
| `bars.ts` | Same shape as histogram; thin vertical bar at integer `x` (1 px wide regardless of zoom). |
| `area.ts` | `drawArea(ctx, { points, lineWidth, lineStyle, color, fillAlpha })`. Filled polygon under a line. |
| `filledBand.ts` | `drawFilledBand(ctx, { upper, lower, color, alpha })`. Fills the region between two polyline series. |
| `label.ts` | `drawLabel(ctx, { x, y, text, position, color })`. Renders text at the given position. |
| `marker.ts` | `drawMarker(ctx, { x, y, shape, size, color })`. Switches on `shape` and renders the matching glyph. |

Each renderer file is paired with a `<name>.test.ts` against
`MockCanvas2DContext` asserting the right primitive operations
(beginPath / lineTo / fillRect / fillText / closePath) fire in the
right order, with the right parameters. 100% coverage per §16.1.

`src/render/` `index.ts` re-exports — pure barrel, excluded from
coverage per the Phase-0 template.

### 6. `RenderCtx` expansion

`examples/canvas2d-adapter/src/render/clear.ts` declares the
structural `RenderCtx` type (re-exported through the `render/`
barrel). Extend it in place with the surfaces the new renderers
need:

```ts
type RenderCtx = {
    // Phase-1 surface — unchanged
    fillStyle: string;
    strokeStyle: string;
    lineWidth: number;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    stroke(): void;
    setLineDash(segments: ReadonlyArray<number>): void;
    fillText(text: string, x: number, y: number): void;

    // Phase-2 additions
    fillRect(x: number, y: number, w: number, h: number): void;
    closePath(): void;
    fill(): void;
    globalAlpha: number;
    font: string;
    textAlign: "start" | "center" | "end" | "left" | "right";
    textBaseline: "top" | "middle" | "bottom" | "alphabetic" | "hanging";
};
```

`MockCanvas2DContext` (`examples/canvas2d-adapter/src/testing.ts`)
adds setters/methods for every new field/call, each appending to
the `callLog`. Coverage matrix in `testing.test.ts` extends.

### 7. `examples/canvas2d-adapter/src/capabilities.ts`

Flip the `plots` field:

```ts
plots: capabilities.allPhase2Plots(),
```

Update the JSDoc `@example` block to reflect the wider set.
Update `capabilities.test.ts` cardinality assertion to 9.

### 8. Conformance scenario

Add `packages/conformance/src/scenarios/plotKindCoverage.scenario.ts`
— a thin script using all six new kinds against the goldenBars
fixture. Asserts each kind appears at least once in the drained
emissions. Scenario registers in `scenarios/index.ts`.

The scenario does NOT exercise real indicator math (the per-port
tasks cover those). Its job is: prove every new kind flows through
the runtime → host-worker → adapter → renderer pipeline.

### 9. JSDoc

Every new export carries `@since 0.2`, `@experimental`, one
`@example` block. New `PlotKind` value's JSDoc note documents
which Phase-2 indicators plot through it (`histogram` → vol/macd
hist; `filled-band` → BB / Keltner / Donchian / Ichimoku;
`marker` → fractals / divergence; etc.).

### 10. Coverage

- `packages/core` — `plot/plot.ts` types-only file; covered by
  `types.types.test.ts`-equivalent. `types.ts` gains the four new
  `Bar` fields — types-only, covered by the matching
  `types.types.test.ts` check.
- `packages/adapter-kit` — `types.ts` types-only;
  `capabilities.ts` 100% (every new builder under test);
  `validateEmission.ts` 100% (every new `kind` arm + rejection
  branch tested).
- `examples/canvas2d-adapter` — `render/*.ts` each 100%;
  `testing.ts` 100% (every new mock surface exercised).
- `packages/conformance` — `runConformanceSuite.ts` 100% on the
  new `inlineSource` branch (both paths: inline + scriptPath).

### 11. `Bar` extension — `packages/core/src/types.ts`

Extend the script-facing `Bar` type with the four pre-computed
derived sources the runtime's `BarView` already populates:

```ts
export type Bar = {
    readonly time: Time;
    readonly open: Price;
    readonly high: Price;
    readonly low: Price;
    readonly close: Price;
    readonly volume: Volume;
    readonly symbol: string;
    readonly interval: string;
    // Phase-2 additions — runtime pre-computes these on BarView
    // per close. Match Pine's bar.hlc3 / bar.ohlc4 conventions.
    readonly hl2: Price;
    readonly hlc3: Price;
    readonly ohlc4: Price;
    readonly hlcc4: Price;
};
```

JSDoc note: "Phase 2 — runtime pre-computes hl2/hlc3/ohlc4/hlcc4
on `BarView` per close; see `packages/runtime/src/streamState.ts`.
`@since 0.2` on the four new fields."

`BarView` (`packages/runtime/src/streamState.ts`) already carries
the four fields with matching shape — no runtime change required.
The existing `pickCandleSource` helper continues to operate
correctly because every code path that produced `bar.hl2` already
exists at runtime.

Verify the existing Phase-1 example scripts still typecheck (they
only read `bar.close` / `bar.high` etc., so the extension is
purely additive).

### 12. `Scenario.inlineSource` extension — `packages/conformance/src/runConformanceSuite.ts`

Extend the `Scenario` type with an optional `inlineSource`
field that overrides `scriptPath` when present. `scriptPath`
remains supported for the Phase-1 scenarios that already point at
`examples/scripts/*.chart.ts`.

```ts
export type Scenario = {
    readonly id: string;
    readonly title: string;
    /** Repo-root-relative path to a `.chart.ts` file. Mutually
     *  exclusive with `inlineSource`. */
    readonly scriptPath?: string;
    /** Inline TypeScript source — `runConformanceSuite` writes it
     *  to the existing `.cache/` tmp file and compiles + imports
     *  exactly like the `scriptPath` branch. Mutually exclusive
     *  with `scriptPath`. */
    readonly inlineSource?: string;
    readonly intervalCount: number;
    readonly assertions: ReadonlyArray<ScenarioAssertion>;
};
```

Runner change in `runOne(...)`:

```ts
const source =
    scenario.inlineSource ??
    (scenario.scriptPath !== undefined
        ? await readFile(resolveScriptPath(scenario.scriptPath), "utf8")
        : (() => {
            throw new Error(
                `Scenario "${scenario.id}" must define either scriptPath or inlineSource`,
            );
          })());
const compiled = await compileFn(source, {
    apiVersion: 1,
    sourcePath: scenario.scriptPath ?? `<inline:${scenario.id}>.chart.ts`,
});
```

`sourcePath` falls back to a virtual path of the form
`<inline:${id}>.chart.ts` so callsite-id injection (PLAN.md §5.5)
emits a stable id string. Phase-2 scenario assertions pin
`slotId: "<inline:ta-wma>.chart.ts:7:13#0"` — the pinned slotIds
are captured at task-execution time and committed.

Runner tests (`runConformanceSuite.test.ts`) extend to cover:
- inline-source happy path,
- inline-source compile error (typed wrong),
- mutual-exclusion error (both present),
- missing-both error.

100% coverage on the new branches.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | Extend `PlotKind` union. |
| `packages/adapter-kit/src/types.ts` | Modify | Extend `PlotStyle` union. |
| `packages/adapter-kit/src/capabilities/capabilities.ts` | Modify | Add six builders + `allPhase2Plots()`. |
| `packages/adapter-kit/src/capabilities/capabilities.test.ts` | Modify | Cover every new builder. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | Add per-kind validation arms. |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | Cover positive + rejection paths for each new kind. |
| `examples/canvas2d-adapter/src/render/histogram.ts` | Create | Renderer. |
| `examples/canvas2d-adapter/src/render/bars.ts` | Create | Renderer. |
| `examples/canvas2d-adapter/src/render/area.ts` | Create | Renderer. |
| `examples/canvas2d-adapter/src/render/filledBand.ts` | Create | Renderer. |
| `examples/canvas2d-adapter/src/render/label.ts` | Create | Renderer. |
| `examples/canvas2d-adapter/src/render/marker.ts` | Create | Renderer. |
| `examples/canvas2d-adapter/src/render/<name>.test.ts` | Create (×6) | Renderer unit tests. |
| `examples/canvas2d-adapter/src/render/index.ts` | Modify | Barrel re-export. |
| `examples/canvas2d-adapter/src/createCanvas2dAdapter.ts` | Modify | Wire new renderers in the dispatch switch; extend `RenderCtx` structural type. |
| `examples/canvas2d-adapter/src/testing.ts` | Modify | Extend `MockCanvas2DContext` with new fields/methods. |
| `examples/canvas2d-adapter/src/testing.test.ts` | Modify | Cover new mock surfaces. |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | Flip `plots` to `allPhase2Plots()`. |
| `examples/canvas2d-adapter/src/capabilities.test.ts` | Modify | Assert cardinality = 9. |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify | Document the `RenderCtx` extension surface. |
| `packages/conformance/src/scenarios/plotKindCoverage.scenario.ts` | Create | Coverage-prover scenario (uses new `inlineSource`). |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export new scenario. |
| `packages/conformance/src/scenarios/scenarios.test.ts` | Modify | Add scenario to the runner test. |
| `packages/core/src/types.ts` | Modify | Extend `Bar` with `hl2` / `hlc3` / `ohlc4` / `hlcc4` fields (§11). |
| `packages/core/src/types.types.test.ts` | Modify | Cover the four new `Bar` fields' types. |
| `packages/conformance/src/runConformanceSuite.ts` | Modify | Extend `Scenario` with `inlineSource?: string`; runner branches on it (§12). |
| `packages/conformance/src/runConformanceSuite.test.ts` | Modify | Cover the new `inlineSource` branches (happy path, compile error, mutual-exclusion error, missing-both error). |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage on all touched packages)
- `pnpm docs:check`
- `pnpm readme:check`
- `pnpm conformance`

## Changeset

`.changeset/phase-2-plotkind-expansion.md` — `minor` bump for
`@invinite-org/chartlang-core` (new `PlotKind` values + `Bar`
fields), `@invinite-org/chartlang-adapter-kit` (new `PlotStyle`
variants + capability builders), `@invinite-org/chartlang-conformance`
(new `Scenario.inlineSource` field on `runConformanceSuite`'s type
surface), and the (private) canvas2d adapter. No runtime /
host-worker source-level changes in this task — `BarView` already
carries the four derived fields.

## Acceptance Criteria

- `PlotKind` exports all nine values.
- `PlotStyle` discriminated union has nine variants matching §7.3.
- `validateEmission` rejects every malformed payload for each new
  kind with `malformed-emission`.
- `capabilities.allPhase2Plots()` returns a set of cardinality 9.
- `CANVAS2D_CAPABILITIES.plots.size === 9`.
- Six renderer files exist + their unit tests pin every relevant
  `MockCanvas2DContext` call.
- New `plotKindCoverage` conformance scenario passes against the
  canvas2d adapter, using `inlineSource`.
- **`Bar` exports `hl2` / `hlc3` / `ohlc4` / `hlcc4` as readonly
  `Price` fields; existing Phase-1 example scripts still
  typecheck.**
- **`Scenario` type carries an optional `inlineSource: string`;
  `runConformanceSuite` covers all four new branches (inline OK,
  inline compile-error, both-set error, neither-set error) at 100%.**
- All gates green; 100% coverage maintained.
- Changeset committed.
