# Task 1 — Core Types, Constructors, Primitive Surface

> **Status: DONE**

## Goal

Replace the `PACKAGE_VERSION = "0.0.0"` placeholder in
`packages/core/src/` with the full Phase-1 typed surface that scripts
import: `defineIndicator`, `defineAlert`, the `ta` / `plot` / `alert`
namespaces, every supporting type from §4.3, and the frozen
`STATEFUL_PRIMITIVES` registry the compiler and runtime both
consume. Nothing here executes — `core` ships **types and callable
surfaces** only. Real implementations land in runtime (Tasks 5-7).

## Prerequisites

- Phase 0 complete (`@invinite-org/chartlang-core` scaffolded with
  the §22.4 template).

## Desired Behavior

After this task:

- A script file can `import { defineIndicator, ta, plot, alert }
  from "@invinite-org/chartlang-core"` and type-check end-to-end.
- `defineIndicator({...})` returns a `CompiledScript`-shaped object
  that survives the compiler pipeline (the runtime executes its
  `compute` body in Task 5).
- The `ta` namespace exposes typed signatures for `sma`, `ema`,
  `stdev`, `bb`, `rsi`, `macd`, `atr`, `crossover`, `crossunder`.
  Each signature is a callable hole — the runtime registers real
  implementations against the same name (§4.4).
- `plot`, `hline`, `alert` are callable holes with the same shape.
- `STATEFUL_PRIMITIVES` is a frozen `ReadonlySet<string>` containing
  exactly the 12 fully-qualified call names the compiler injects ids
  into.
- 100% coverage per §16.1. Every export carries JSDoc with
  `@since 0.1` and a runnable `@example` per §17.2.

## Requirements

### 1. `packages/core/src/types.ts` — §4.3 types

Export every type the public surface references. Two-line MIT
header. Types-only file (excluded from coverage per §16.1's
`exclude` list).

```ts
// Time-domain
export type Time = number;
export type Price = number;
export type Volume = number;

// Bar
export type Bar = {
    readonly time: Time;
    readonly open: Price;
    readonly high: Price;
    readonly low: Price;
    readonly close: Price;
    readonly volume: Volume;
    readonly symbol: string;
    readonly interval: string;
};

// Series<T> — runtime owns the implementation; this is the type
// scripts see.
export type Series<T> = {
    readonly current: T;
    readonly [n: number]: T;
    readonly length: number;
};

// Styling
export type Color = string;                  // CSS color
export type LineStyle = "solid" | "dashed" | "dotted";
export type PlotLineStyle =
    | "line" | "step" | "dashed" | "circles" | "cross";
export type AlertSeverity = "info" | "warning" | "critical";

// Intervals (used by Phase 4+; surface lands here for type stability)
export type IntervalDescriptor = {
    readonly value: string;
    readonly label: string;
    readonly group: string;
};

// Inputs schema (Phase 4 fills `input.*` builders; Phase 1 keeps the
// type so ScriptManifest is stable).
export type InputSchema = Readonly<Record<string, unknown>>;

// Capabilities subset that the script-side surface references. The
// full Capabilities type lives in @invinite-org/chartlang-adapter-kit
// (Task 4); we re-export here only the discriminator strings.
export type CapabilityId =
    | "indicators" | "drawings" | "alerts";

// Script manifest emitted by the compiler.
export type ScriptManifest = {
    readonly apiVersion: 1;
    readonly kind: "indicator" | "drawing" | "alert";
    readonly name: string;
    readonly inputs: InputSchema;
    readonly capabilities: ReadonlyArray<CapabilityId>;
    readonly requestedIntervals: ReadonlyArray<string>;
    readonly userPickableInterval: boolean;
    /** Compiler-computed max lookback per series. Empty in Phase 1
     *  for non-OHLCV series; OHLCV defaults to 1 unless any literal
     *  `series.X[N]` read exceeds it. */
    readonly seriesCapacities: Readonly<Record<string, number>>;
    /** Compiler-derived max lookback across all series. */
    readonly maxLookback: number;
};

// CompiledScript shape returned by define* constructors. The runtime
// reads this; the compiler also produces a manifest.json sibling.
export type ComputeContext = {
    readonly bar: Bar;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly ta: TaNamespace;       // see ta/ta.ts
    readonly plot: typeof import("./plot/plot").plot;
    readonly hline: typeof import("./plot/plot").hline;
    readonly alert: typeof import("./alert/alert").alert;
};

export type ComputeFn = (ctx: ComputeContext) => void;

export type CompiledScriptObject = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
};
```

Forward-declare `TaNamespace` here; the concrete type lives in
`ta/ta.ts` (next requirement). Use `import type` to keep types-only.

### 2. `packages/core/src/ta/ta.ts` — typed `ta` namespace

Export a `TaNamespace` interface AND a constant `ta: TaNamespace`
runtime hook. The constant is a **callable hole** — the compiler
re-targets it (Task 2 callsite-id transformer) to runtime impls.

```ts
export type EmaOpts = Readonly<{}>;
export type SmaOpts = Readonly<{}>;
export type StdevOpts = Readonly<{ biased?: boolean }>;
export type BbOpts = Readonly<{ multiplier?: number }>;
export type RsiOpts = Readonly<{}>;
export type MacdOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    signalLength?: number;
}>;
export type AtrOpts = Readonly<{}>;

export type BbResult = Readonly<{
    upper: Series<number>;
    middle: Series<number>;
    lower: Series<number>;
}>;
export type MacdResult = Readonly<{
    macd: Series<number>;
    signal: Series<number>;
    hist: Series<number>;
}>;

export type TaNamespace = {
    sma(source: Series<number>, length: number, opts?: SmaOpts): Series<number>;
    ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
    stdev(source: Series<number>, length: number, opts?: StdevOpts): Series<number>;
    bb(source: Series<number>, length: number, opts?: BbOpts): BbResult;
    rsi(source: Series<number>, length: number, opts?: RsiOpts): Series<number>;
    macd(source: Series<number>, opts?: MacdOpts): MacdResult;
    atr(length: number, opts?: AtrOpts): Series<number>;
    crossover(a: Series<number>, b: Series<number> | number): Series<boolean>;
    crossunder(a: Series<number>, b: Series<number> | number): Series<boolean>;
};

export const ta: TaNamespace = /* @__PURE__ */ Object.freeze({
    sma: () => { throw new Error("ta.sma called outside compiled runtime"); },
    ema: () => { throw new Error("ta.ema called outside compiled runtime"); },
    stdev: () => { throw new Error("ta.stdev called outside compiled runtime"); },
    bb: () => { throw new Error("ta.bb called outside compiled runtime"); },
    rsi: () => { throw new Error("ta.rsi called outside compiled runtime"); },
    macd: () => { throw new Error("ta.macd called outside compiled runtime"); },
    atr: () => { throw new Error("ta.atr called outside compiled runtime"); },
    crossover: () => { throw new Error("ta.crossover called outside compiled runtime"); },
    crossunder: () => { throw new Error("ta.crossunder called outside compiled runtime"); },
});
```

Each `throw new Error` is the "outside compiled runtime" sentinel —
covered by a unit test that imports core directly (no compiler) and
asserts the error message. This keeps the hole's branches at 100%.

`ta.atr` takes no `source` argument because ATR derives from bar
OHLC inside the runtime (§9.2). The signature matches Pine.

### 3. `packages/core/src/plot/plot.ts` — `plot` + `hline`

```ts
export type PlotKind =
    | "line" | "step-line" | "horizontal-line";

export type PlotOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    /** "overlay" | "new" | <id>. Phase-1 only renders "overlay". */
    pane?: "overlay" | "new" | string;
}>;

export type HLineOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
}>;

export function plot(value: number | Series<number>, opts?: PlotOpts): void {
    throw new Error("plot called outside compiled runtime");
}

export function hline(price: number, opts?: HLineOpts): void {
    throw new Error("hline called outside compiled runtime");
}
```

`plot` accepts `number | Series<number>` — when called with a scalar
the runtime emits a single-bar value; with a series it pulls
`series.current`. The compiler's callsite-id transformer (Task 2)
wraps every call so the runtime can identify the emission.

### 4. `packages/core/src/alert/alert.ts` — `alert`

```ts
export type AlertOpts = Readonly<{
    severity?: AlertSeverity;             // default "info"
    meta?: Readonly<Record<string, JsonValue>>;
}>;

export type JsonValue =
    | null | boolean | number | string
    | ReadonlyArray<JsonValue>
    | { readonly [k: string]: JsonValue };

export function alert(message: string, opts?: AlertOpts): void {
    throw new Error("alert called outside compiled runtime");
}
```

`JsonValue` is re-exported from `types.ts` if convenient — keep one
authoritative declaration.

### 5. `packages/core/src/define/defineIndicator.ts`

```ts
export type DefineIndicatorOpts = Readonly<{
    name: string;
    apiVersion: 1;
    overlay?: boolean;
    inputs?: InputSchema;
    compute: ComputeFn;
}>;

export function defineIndicator(opts: DefineIndicatorOpts): CompiledScriptObject {
    return Object.freeze({
        manifest: Object.freeze({
            apiVersion: 1 as const,
            kind: "indicator" as const,
            name: opts.name,
            inputs: opts.inputs ?? {},
            capabilities: Object.freeze(["indicators"] as const),
            requestedIntervals: Object.freeze([] as string[]),
            userPickableInterval: false,
            seriesCapacities: Object.freeze({}),
            maxLookback: 0,
        }),
        compute: opts.compute,
    });
}
```

The compiler **overrides** the manifest fields at build time
(Task 2 extracts `capabilities` from primitive usage and
`maxLookback` from `series[N]` reads). At runtime the override is
already baked into the emitted module — `defineIndicator`'s
returned object is the source the compiler reads, then replaces
piecewise via TS transform. The defaults above let the constructor
work in unit tests without the compiler.

`defineAlert` is a thin variant with `kind: "alert"` and no
`overlay`. Same shape, separate file.

### 6. `packages/core/src/statefulPrimitives.ts`

```ts
/**
 * Frozen set of fully-qualified call names the compiler injects
 * callsite ids into (§5.5). Phase 1 ships exactly these 12.
 * Phase 2+ extends via Object.freeze(new Set([...PHASE_1, ...]))
 * in this file — the registry stays the single source of truth.
 *
 * @since 0.1
 * @example
 *     import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
 *     if (STATEFUL_PRIMITIVES.has("ta.ema")) {
 *         // compiler injects an id here
 *     }
 */
export const STATEFUL_PRIMITIVES: ReadonlySet<string> = Object.freeze(
    new Set<string>([
        "ta.sma", "ta.ema", "ta.stdev", "ta.bb", "ta.rsi", "ta.macd", "ta.atr",
        "ta.crossover", "ta.crossunder",
        "plot", "hline", "alert",
    ]),
);
```

Cardinality test: `expect(STATEFUL_PRIMITIVES.size).toBe(12)`.

### 7. Barrel `packages/core/src/index.ts`

```ts
export type {
    Bar, Time, Price, Volume, Series, Color, LineStyle,
    PlotLineStyle, AlertSeverity, IntervalDescriptor, InputSchema,
    CapabilityId, ScriptManifest, ComputeContext, ComputeFn,
    CompiledScriptObject, JsonValue,
} from "./types";
export { defineIndicator, defineAlert } from "./define";
export { ta } from "./ta";
export type {
    TaNamespace, SmaOpts, EmaOpts, StdevOpts, BbOpts, RsiOpts,
    MacdOpts, AtrOpts, BbResult, MacdResult,
} from "./ta/ta";
export { plot, hline } from "./plot";
export type { PlotOpts, HLineOpts, PlotKind } from "./plot/plot";
export { alert } from "./alert";
export type { AlertOpts } from "./alert/alert";
export { STATEFUL_PRIMITIVES } from "./statefulPrimitives";
```

The barrel is excluded from coverage per §16.1 `exclude:
src/**/index.ts`.

### 8. Tests

Per §16.2 / §16.3, `@invinite-org/chartlang-core` ships **unit +
type** layers. Per file:

- `defineIndicator.test.ts` — asserts the returned object's shape,
  manifest defaults, frozenness, that `compute` is preserved
  identity.
- `defineAlert.test.ts` — same shape, `kind: "alert"`.
- `statefulPrimitives.test.ts` — size === 12, contains exactly the
  12 names, is frozen.
- `ta.test.ts` — every `ta.*` callable throws the sentinel error
  with the exact `"ta.<name> called outside compiled runtime"`
  message. One test per primitive (9 tests).
- `plot.test.ts` — `plot` and `hline` throw their sentinel errors.
- `alert.test.ts` — `alert` throws its sentinel error.
- `types.types.test.ts` — `expect-type` (already a root devDep)
  assertions: `Series<number>[0]` resolves to `number`,
  `Bar["time"]` resolves to `Time` etc. (Type-only — no runtime
  expectations.)

The existing `packages/core/src/index.test.ts` placeholder is
deleted in this task (its assertion against `PACKAGE_VERSION`
becomes irrelevant once the constant is removed).

### 9. Remove `PACKAGE_VERSION`

The placeholder export from Phase 0 is deleted in `core` only.
Other packages keep theirs until their respective Phase-1 task
lands. Removing `PACKAGE_VERSION` from `core` means
`scripts/docs-check.ts`'s `EXEMPT_EXPORTS` no longer matches
anything in this package — that's fine, the exemption only fires
when a matching export exists. The exemption itself is removed
globally in Task 3 once every Phase-1 package ships real exports.

### 10. JSDoc per §17.2

Every exported symbol carries:

- One-line description.
- `@since 0.1`.
- `@example` block with a runnable snippet. The example must
  type-check; in Phase 1 docs-check verifies presence + JSDoc tag
  set; Task 3 upgrades it to execute the block via the compiler.

For `ta.*` primitives, also include:

- `@formula` — math in plain notation
  (e.g. `EMA[t] = α·x[t] + (1−α)·EMA[t−1], α = 2/(N+1)`).
- `@warmup` — number of bars until first finite output
  (e.g. `@warmup length-1`).
- `@experimental` (until §17.2's stable/experimental policy
  promotes it).

`docs-check.ts` already enforces the `ta` / `draw` namespace tag
set (`@formula`, `@anchors`, `@stable | @experimental`). The
`@anchors` requirement applies to `draw.*` only — `docs-check.ts`
gates on `/src/ta/` OR `/src/draw/` directories. Since `ta` source
in `core` is `src/ta/ta.ts`, it gets the `@formula` requirement.
**Update `docs-check.ts`** in this task to skip the `@anchors`
check for `src/ta/` (anchors are drawing-specific). The current
`requireTaDraw` branch (around the `if (!hasAnchors)` line — grep
for it; the script is ~200 lines, not 220) emits an `@anchors`
violation for every `src/ta/` export today. Replace the existing
combined requirement with:

```ts
if (requireTaDraw) {
    if (relPath.includes("/src/ta/")) {
        if (!hasFormula) record(filePath, line, name, "missing @formula (ta namespace)");
        if (!hasStability) record(filePath, line, name, "missing @stable or @experimental (ta namespace)");
    } else {
        // draw namespace
        if (!hasFormula) record(filePath, line, name, "missing @formula (draw namespace)");
        if (!hasAnchors) record(filePath, line, name, "missing @anchors (draw namespace)");
        if (!hasStability) record(filePath, line, name, "missing @stable or @experimental (draw namespace)");
    }
}
```

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/types.ts` | Create | §4.3 types — single source of truth. |
| `packages/core/src/ta/ta.ts` | Create | `TaNamespace` + callable `ta` constant. |
| `packages/core/src/ta/index.ts` | Create | Barrel re-export. |
| `packages/core/src/plot/plot.ts` | Create | `plot` + `hline` callable holes. |
| `packages/core/src/plot/index.ts` | Create | Barrel re-export. |
| `packages/core/src/alert/alert.ts` | Create | `alert` callable hole. |
| `packages/core/src/alert/index.ts` | Create | Barrel re-export. |
| `packages/core/src/define/defineIndicator.ts` | Create | Constructor. |
| `packages/core/src/define/defineAlert.ts` | Create | Constructor. |
| `packages/core/src/define/index.ts` | Create | Barrel re-export. |
| `packages/core/src/statefulPrimitives.ts` | Create | Frozen 12-entry Set. |
| `packages/core/src/index.ts` | Modify | Replace `PACKAGE_VERSION` with the §4.4 surface barrel. |
| `packages/core/src/index.test.ts` | Delete | Replaced by per-module unit tests. |
| `packages/core/src/define/defineIndicator.test.ts` | Create | Constructor shape + defaults. |
| `packages/core/src/define/defineAlert.test.ts` | Create | Constructor shape. |
| `packages/core/src/ta/ta.test.ts` | Create | Sentinel-error coverage for all 9 ta.* holes. |
| `packages/core/src/plot/plot.test.ts` | Create | Sentinel-error coverage for plot + hline. |
| `packages/core/src/alert/alert.test.ts` | Create | Sentinel-error coverage for alert. |
| `packages/core/src/statefulPrimitives.test.ts` | Create | Size, contents, frozenness. |
| `packages/core/src/types.types.test.ts` | Create | `expect-type` assertions on every exported type. |
| `packages/core/README.md` | Modify | Replace "Planned (Phase 1+)" surface text with the actual exports. Keep ≤100 lines. |
| `scripts/docs-check.ts` | Modify | Split the ta vs draw branch as shown in Requirement 10. Leave `PACKAGE_VERSION` in `EXEMPT_EXPORTS` — Task 3 empties the set after adding a JSDoc shim to every still-placeholder package. |

## Acceptance Criteria

- `pnpm -F @invinite-org/chartlang-core typecheck && pnpm -F
  @invinite-org/chartlang-core test` pass with 100% coverage on
  every metric (lines, statements, branches, functions).
- `pnpm docs:check` passes for the `core` package — every export
  has JSDoc with `@since 0.1` and a runnable `@example`; every
  `src/ta/` export additionally has `@formula` and one of `@stable`
  / `@experimental` (Phase 1 uses `@experimental`). The
  `STATEFUL_PRIMITIVES` `@example` deliberately demonstrates a
  membership check — Task 3's executor recognises this as a
  non-script example (no `defineIndicator(` call) and skips
  compilation. Keep that shape.
- `pnpm readme:check` passes — `packages/core/README.md` ≤ 100
  lines and matches the §17.1 structure.
- `pnpm lint` / `pnpm format:check` pass.
- `pnpm -r build` succeeds for the workspace (other packages still
  build off their `PACKAGE_VERSION` placeholder).
- `STATEFUL_PRIMITIVES.size === 12` asserted in test.
- All 12 stateful primitive callable holes throw the
  `"<name> called outside compiled runtime"` sentinel — proven by
  unit tests, each covered.
- `expect-type` type tests pin `ta.bb` returns `BbResult`, `ta.macd`
  returns `MacdResult`, `Series<number>[0]` is `number`, and
  `defineIndicator({...})` returns `CompiledScriptObject`.
- Phase 0 gate scripts (`docs:check`, `readme:check`,
  `coverage:report`, `conformance`) continue to pass on the whole
  workspace.
