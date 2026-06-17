# Task 8 — Transform: declarations → `defineIndicator` / `defineDrawing` wrapper

> **Status: TODO**

## Goal

Rewrite the Pine top-level `indicator(...)` declaration into a chartlang
`defineIndicator({...})` (or `defineDrawing({...})`) call-expression
shape in the converter's TS-output IR. Decide between the two
constructors based on whether the script's body emits plots vs only
drawings. Translate the `indicator(...)` named args (`title`,
`shorttitle`, `overlay`, `format`, `precision`, `scale`,
`max_lines_count`, `max_labels_count`, `max_boxes_count`,
`max_polylines_count`) into chartlang's `DefineIndicatorOpts` (`name`,
`shortName`, `overlay`, `format`, `precision`, `scale`, `maxDrawings`).

## Prerequisites

Task 7 (coordinate resolver).

## Current Behavior

The annotated AST has an `IndicatorDeclaration` node with raw arg
expressions. Strategy/library declarations are flagged with diagnostics
but no rewrite into chartlang exists.

## Desired Behavior

A package-internal `transformDeclaration(decl: IndicatorDeclaration,
analysis: SemanticResult, diagnostics: DiagnosticCollector):
ScriptScaffold` API in `src/transform/declaration.ts` returns a
`ScriptScaffold` IR object holding the resolved chartlang script
constructor (`defineIndicator` or `defineDrawing`), the `name` /
`shortName` / `overlay` / `format` / `precision` / `scale` /
`maxDrawings` options, and a placeholder for the `compute` body
populated later by Tasks 9–15.

## Requirements

### 1. `ScriptScaffold` IR shape (`src/transform/ir.ts`)

```ts
export type ScriptScaffold = {
    readonly constructor: "defineIndicator" | "defineDrawing";
    readonly apiVersion: 1;                     // hard-coded; chartlang compiler requires `apiVersion: 1`
    readonly name: string;                      // from indicator(title=…)
    readonly shortName: string | null;
    readonly overlay: boolean | null;           // null = chartlang default (true)
    readonly format: "price" | "percent" | "volume" | null;
    readonly precision: number | null;
    readonly scale: "left" | "right" | null;
    readonly maxDrawings: {
        readonly lines?: number;
        readonly labels?: number;
        readonly boxes?: number;
        readonly polylines?: number;
        readonly other?: number;
    };
    readonly maxBarsBack: number | null;
    readonly inputs: InputDeclarationIR[];      // populated by Task 9
    readonly stateSlots: StateSlotIR[];          // scalar `state.*` slots populated by Tasks 10/15
    readonly handleSlots: HandleSlotIR[];        // module-level drawing-handle slots populated by Task 10
    readonly handleRings: HandleRingIR[];        // module-level drawing-handle rings populated by Task 11
    readonly computeBody: ComputeBodyIR;        // populated by Tasks 10–15
    readonly diagnostics: readonly Diagnostic[];
};
```

`computeBody` is itself an IR — Tasks 10–15 each append statement-IR
nodes to it. The IR is mutable inside the converter's transform
pipeline but the public `ConvertResult` only sees the codegen'd string.

### 2. `indicator()` arg mapping (`src/transform/declarationArgs.ts`)

| Pine arg | chartlang option | Notes |
|---|---|---|
| `title` (positional 1st) | `name` | required; literal string |
| `shorttitle` | `shortName` | optional literal string |
| `overlay` | `overlay` | boolean |
| `format` | `format` | `format.price` → `"price"`, `format.percent` → `"percent"`, `format.volume` → `"volume"`, `format.inherit` → null with warning |
| `precision` | `precision` | int 0..16 |
| `scale` | `scale` | `scale.left` → `"left"`, `scale.right` → `"right"`, `scale.none` → null with warning |
| `max_lines_count` | `maxDrawings.lines` | int |
| `max_labels_count` | `maxDrawings.labels` | int |
| `max_boxes_count` | `maxDrawings.boxes` | int |
| `max_polylines_count` | `maxDrawings.polylines` | int |
| `max_bars_back` | `maxBarsBack` | int |
| `timeframe` / `timeframe_gaps` / `explicit_plot_zorder` / `dynamic_requests` / `linktoseries` / `process_orders_on_close` / `behind_chart` | (none) | warning `indicator-arg-not-mapped` per arg |

Defaults: when `max_*_count` is omitted, Pine's default is ~50 per
bucket; the converter copies that to `maxDrawings.<bucket> = 50` to
preserve the GC behavior. (Pine maxima are 500/500/500/100; if the
script sets a higher value, it carries through to chartlang's manifest
and the adapter is responsible for enforcing.)

### 3. Constructor choice: indicator vs drawing

Walk the script's call-sites once:
- Any `plot*`/`plotshape`/`plotchar`/`plotcandle`/`plotbar`/`plotarrow`/
  `hline`/`fill`/`bgcolor`/`barcolor` call → emit `defineIndicator`.
- No plot calls AND at least one drawing call (`line.new` etc.) →
  emit `defineDrawing`.
- No plot calls AND no drawing calls → emit `defineIndicator` (a
  "compute-only" script; rare but possible).
- Both → `defineIndicator` (chartlang indicators can emit drawings;
  drawings cannot emit plots).

Record the decision in `ScriptScaffold.constructor` and emit
`drawing-only-script` info-diagnostic when downgrading to
`defineDrawing` so the user knows the conversion dropped the plot
capability.

### 4. `strategy(...)` and `library(...)` handling

Task 3 already emits hard-reject diagnostics for both. This task
additionally:

- For `strategy()`: synthesize a `defineIndicator` shell with the
  `title` arg as `name`, drop all strategy-specific args
  (`initial_capital`, `pyramiding`, `default_qty_type`, etc.),
  preserve `max_lines_count`/etc. as `maxDrawings.*`, and continue
  with a follow-on `strategy-as-indicator` info-diagnostic. The
  `strategy.entry`/`strategy.exit`/`strategy.close*`/`strategy.order`
  call-sites are surfaced as `alert(...)` emissions in Task 15.
- For `library()`: hard-reject (no fallback). `ConvertResult.output`
  is `null`.

### 5. `name` validation

Pine permits any string title; chartlang's `defineIndicator.name` must
be a string literal at the call-site (compiler enforces). The
converter emits the string as-is; if Pine's title is computed (e.g.
`indicator(syminfo.ticker + " stats")`), emit error
`computed-indicator-title` and use a fallback name (`"<unknown>"`).

### 6. Output integration

`transformDeclaration` returns the populated `ScriptScaffold`. The
codegen (Task 16) consumes this and emits the `import` line, the
`defineIndicator({...})` call, and the `compute({...}) { … }` body.
The `inputs`/`stateSlots`/`computeBody` arrays start empty here and
fill in as Tasks 9–15 each call `appendInput`/`appendStateSlot`/
`appendComputeStatement` mutators on the scaffold (exposed via
`src/transform/scaffoldMutators.ts`).

### 7. Diagnostic codes (added this task)

- `indicator-arg-not-mapped` (warning) — per unmapped Pine arg.
- `drawing-only-script` (info) — downgrade to `defineDrawing`.
- `strategy-as-indicator` (info) — strategy stripped to indicator.
- `computed-indicator-title` (error) — non-literal title.
- `max-count-out-of-range` (warning) — Pine cap exceeds chartlang
  bucket cap; clamped to chartlang's max.

### 8. Tests (§16.3)

| File | Purpose |
|------|---------|
| `declaration.test.ts` | Per-arg fixtures: `title`, `overlay`, `max_*_count`, `format`, `precision`, `scale`. Each asserts the produced ScriptScaffold field. |
| `declaration.property.test.ts` | Property: every recognized indicator arg yields exactly one mapped field; every unrecognized arg yields exactly one warning diagnostic. |
| `constructor-choice.test.ts` | Three fixtures — plot-only, draw-only, mixed — assert `constructor` decision. |
| `strategy-downgrade.test.ts` | `strategy("x", initial_capital=10000)` → scaffold with constructor `defineIndicator`, `name === "x"`, plus `strategy-as-indicator` diagnostic. |

Coverage 100% on `src/transform/declaration*` and
`src/transform/ir.ts` and `src/transform/scaffoldMutators.ts`.

### 9. JSDoc

Every exported function/type carries `@since 0.1`, `@experimental`,
and an `@example` block.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/pine-converter/src/transform/ir.ts` | Create | `ScriptScaffold`, `ComputeBodyIR`, `StateSlotIR`, `HandleSlotIR`, `HandleRingIR`, `InputDeclarationIR`. |
| `packages/pine-converter/src/transform/declaration.ts` | Create | Top-level transform. |
| `packages/pine-converter/src/transform/declarationArgs.ts` | Create | Pine arg → option map. |
| `packages/pine-converter/src/transform/scaffoldMutators.ts` | Create | Append helpers used by Tasks 9–15. |
| `packages/pine-converter/src/transform/index.ts` | Modify | Re-export. |
| `packages/pine-converter/src/diagnostics/codes.ts` | Modify | Add Task-8 codes. |
| `packages/pine-converter/src/transform/declaration.test.ts` | Create | Per-arg unit tests. |
| `packages/pine-converter/src/transform/declaration.property.test.ts` | Create | Property tests. |
| `packages/pine-converter/src/transform/constructor-choice.test.ts` | Create | Constructor-choice fixtures. |
| `packages/pine-converter/src/transform/strategy-downgrade.test.ts` | Create | Strategy downgrade test. |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (100% coverage)
- `pnpm docs:check`

## Changeset

`.changeset/pine-converter-transform-declaration.md` — patch bump.

## Acceptance Criteria

- `indicator("Hello", overlay=true, max_lines_count=20)` produces a
  scaffold with `name="Hello"`, `overlay=true`, `maxDrawings.lines=20`.
- A script with only `line.new` calls (no plots) produces scaffold
  `constructor === "defineDrawing"` and a `drawing-only-script`
  diagnostic.
- `strategy("S")` produces scaffold `constructor === "defineIndicator"`,
  `name === "S"`, plus `strategy-as-indicator` info.
- A computed title emits `computed-indicator-title` error.
- 100% coverage on the listed files.
- JSDoc + lint + typecheck gates green.
- Changeset committed.
