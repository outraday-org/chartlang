// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DependencyDeclaration, OutputDeclaration } from "./define/dependency.js";
import type { ScaleAxis, ValueFormat } from "./define/overrides.js";
import type { DrawNamespace } from "./draw/draw.js";
import type { WorldPoint } from "./draw/worldPoint.js";
import type { InputDescriptor } from "./input/inputDescriptor.js";
import type { PlotKind } from "./plot/plot.js";
import type { RequestNamespace } from "./request/index.js";
import type { RuntimeNamespace } from "./runtime/index.js";
import type { StateNamespace } from "./state/state.js";
import type { TaNamespace } from "./ta/ta.js";
import type { BarStateView, SymInfoView, TimeframeView } from "./views/index.js";

/**
 * UTC milliseconds since epoch — the only time representation the runtime
 * speaks. Display-side timezones are the adapter's responsibility.
 *
 * @since 0.1
 * @example
 *     const t: Time = 1_700_000_000_000;
 */
export type Time = number;

/**
 * A price quote in the symbol's quote currency, finite or NaN. NaN marks an
 * unwarmed series slot.
 *
 * @since 0.1
 * @example
 *     const last: Price = 42.31;
 */
export type Price = number;

/**
 * Traded volume for the bar, in the symbol's native unit (shares, contracts,
 * coins, …).
 *
 * @since 0.1
 * @example
 *     const v: Volume = 1_250_000;
 */
export type Volume = number;

/**
 * Visible chart range in UTC milliseconds. Phase 5's OSS runtime
 * supplies a fallback range spanning the latest 100 bars ending at the
 * current head; adapters with a real viewport can replace this view in
 * later phases.
 *
 * @since 0.5
 * @stable
 * @example
 *     const viewport: BarViewport = {
 *         fromTime: 1_700_000_000_000,
 *         toTime: 1_700_006_000_000,
 *     };
 */
export type BarViewport = Readonly<{
    readonly fromTime: Time;
    readonly toTime: Time;
}>;

/**
 * The OHLCV record the runtime hands to `compute` for the current bar. Every
 * field is `readonly`; scripts must not mutate it.
 *
 * Phase 2 surfaces the four pre-computed derived sources (`hl2` / `hlc3` /
 * `ohlc4` / `hlcc4`) the runtime's `BarView`
 * (`packages/runtime/src/streamState.ts`) already populates on every close.
 * Script authors can write `ta.cci(bar.hlc3, 20)` directly — matching Pine's
 * canonical `bar.hlc3` / `bar.ohlc4` access pattern — without re-computing
 * the derived source per lookup.
 *
 * @since 0.1
 * @example
 *     function tick(bar: Bar): void {
 *         console.log(bar.close, bar.symbol, bar.interval);
 *         // Phase 2 — Pine-style derived sources:
 *         console.log(bar.hl2, bar.hlc3, bar.ohlc4, bar.hlcc4);
 *         // Phase 5 — visible-range fallback:
 *         console.log(bar.viewport.fromTime, bar.viewport.toTime);
 *     }
 */
export type Bar = {
    readonly time: Time;
    readonly open: Price;
    readonly high: Price;
    readonly low: Price;
    readonly close: Price;
    readonly volume: Volume;
    readonly symbol: string;
    readonly interval: string;
    /** `(high + low) / 2`. @since 0.2 */
    readonly hl2: Price;
    /** `(high + low + close) / 3`. @since 0.2 */
    readonly hlc3: Price;
    /** `(open + high + low + close) / 4`. @since 0.2 */
    readonly ohlc4: Price;
    /** `(high + low + close + close) / 4` (Pine's `hlcc4`). @since 0.2 */
    readonly hlcc4: Price;
    /** Visible-range fallback used by viewport-aware primitives. @since 0.5 */
    readonly viewport?: BarViewport;
    /**
     * Anchor a {@link WorldPoint} by integer bar `offset` instead of an
     * absolute timestamp. The returned `{ time, price }` is the only frame
     * drawings persist (see {@link WorldPoint}), so it composes directly
     * with every `draw.*` anchor argument — `bar.point` is authoring sugar
     * that resolves the offset to a real / extrapolated time at compute
     * time; it introduces no new anchor shape.
     *
     * Offset semantics (relative to the current bar):
     * - `offset === 0` → the current bar: `{ time: bar.time, price }`.
     * - `offset < 0` → `|offset|` bars back; the time is the real
     *   historical timestamp from the runtime's time ring buffer. When the
     *   offset reaches past retained history the time is `NaN` (graceful
     *   degradation, matching how a `Series` lookback past history reads
     *   `NaN`) — it never throws.
     * - `offset > 0` → a future bar that does not exist yet; the time is
     *   extrapolated as `lastTime + offset * spacing`, where `spacing` is
     *   the median delta of the most recent retained bar times, falling
     *   back to the parsed bar interval when fewer than two bars are
     *   retained.
     *
     * `price` passes through unchanged (it may be `NaN`).
     *
     * @since 0.9
     * @stable
     * @formula  time = offset === 0 ? bar.time
     *           : offset < 0 ? history.time.at(-offset)
     *           : lastTime + offset * spacing
     * @anchors  offset (bar index), price, and the runtime time history
     * @example
     *     function tick(bar: Bar): WorldPoint {
     *         // Tracking line from 10 bars ago to the current close.
     *         const from = bar.point(-10, bar.close);
     *         const to = bar.point(0, bar.close);
     *         void from;
     *         return to;
     *     }
     */
    point(offset: number, price: Price): WorldPoint;
};

/**
 * Read-only view over a ring-buffered history of values. `current` is bar 0,
 * numeric indices look back N bars. The runtime owns the storage; scripts see
 * only this shape.
 *
 * @since 0.1
 * @example
 *     function delta(close: Series<number>): number {
 *         return close.current - close[1];
 *     }
 */
export type Series<T> = {
    readonly current: T;
    readonly [n: number]: T;
    readonly length: number;
};

/**
 * CSS color string — `"#rrggbb"`, `"rgb(...)"`, `"hsl(...)"`, etc. Adapters
 * round-trip the string verbatim.
 *
 * @since 0.1
 * @example
 *     const blue: Color = "#3b82f6";
 */
export type Color = string;

/**
 * Stroke style for `plot` and `hline` lines. Adapters that cannot render a
 * style fall back to `"solid"` and emit `"line-style-unsupported"`.
 *
 * @since 0.1
 * @example
 *     const ls: LineStyle = "dashed";
 */
export type LineStyle = "solid" | "dashed" | "dotted";

/**
 * The rendered shape an adapter requests for a `plot` emission. Maps to
 * `Capabilities.plotKinds`.
 *
 * @since 0.1
 * @example
 *     const k: PlotLineStyle = "step";
 */
export type PlotLineStyle = "line" | "step" | "dashed" | "circles" | "cross";

/**
 * Alert severity used by `alert(...)` and downstream alert channels. Defaults
 * to `"info"` when callers omit `opts.severity`.
 *
 * @since 0.1
 * @example
 *     const sev: AlertSeverity = "warning";
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Adapter-declared timeframe entry surfaced in the script-settings UI. The
 * optional `intervalSeconds` override lets exotic intervals declare their
 * effective duration without extending the standard parser grammar.
 *
 * @since 0.1
 * @example
 *     const d: IntervalDescriptor = {
 *         value: "1D",
 *         label: "1 day",
 *         group: "Days",
 *     };
 */
export type IntervalDescriptor = {
    readonly value: string;
    readonly label: string;
    readonly group: string;
    /**
     * Optional positive finite second-count override used by interval
     * ordering helpers before parsing `value`.
     *
     * @since 0.6
     * @stable
     */
    readonly intervalSeconds?: number;
};

/**
 * Script-author-declared input schema attached to `defineIndicator` /
 * `defineAlert` / `defineDrawing`. Each key carries an `InputDescriptor<T>`
 * returned by an `input.*` builder. The compiler serialises this schema into
 * `manifest.inputs`; the runtime resolves user overrides against defaults.
 *
 * @since 0.1 — widened in 0.4 from opaque `Readonly<Record<string, unknown>>`
 *   to the typed `InputDescriptor<unknown>` shape returned by `input.*`
 *   builders. Existing scripts stay source-compatible because the previous
 *   opaque record subsumes the new typed shape.
 * @example
 *     import { input } from "@invinite-org/chartlang-core";
 *     const inputs: InputSchema = { length: input.int(20) };
 *     void inputs;
 */
export type InputSchema = Readonly<Record<string, InputDescriptor<unknown>>>;

/**
 * Discriminator for the Phase-1 adapter capability subset the script-side
 * surface references. The full `Capabilities` type lives in
 * `@invinite-org/chartlang-adapter-kit` (Task 4); only the id strings appear
 * here.
 *
 * @since 0.1
 * @example
 *     const caps: ReadonlyArray<CapabilityId> = ["indicators", "alerts"];
 */
export type CapabilityId = "indicators" | "drawings" | "alerts" | "alertConditions";

/**
 * Per-script drawing-emission budget. Excess `draw.*` calls drop with
 * `drawing-budget-exceeded` once a bucket is full. Mirrors Pine's
 * `max_*_count` family. The runtime enforces
 * `min(scriptManifest.maxDrawings, adapter.capabilities.maxDrawingsPerScript)`
 * per bucket.
 *
 * Canonical declaration lives here in core so both
 * `ScriptManifest.maxDrawings?` and the adapter-kit re-export pin the
 * same shape — preserving the adapter-kit → core dependency direction.
 *
 * @since 0.3
 * @stable
 * @example
 *     const c: DrawingCounts = {
 *         lines: 50, labels: 50, boxes: 50, polylines: 50, other: 50,
 *     };
 *     void c;
 */
export type DrawingCounts = {
    readonly lines: number;
    readonly labels: number;
    readonly boxes: number;
    readonly polylines: number;
    readonly other: number;
};

/**
 * One plotted-slot descriptor in `ScriptManifest.plots`. The compiler
 * emits one entry per `plot()` / `plot.*()` / `hline()` callsite so an
 * embedder can build a style/visibility UI keyed by the stable `slotId`
 * before the first emission. `title` is present only when the call's
 * opts carries a string-literal `title`.
 *
 * @since 0.8
 * @stable
 * @example
 *     const slot: PlotSlotDescriptor = {
 *         slotId: "ema.ts:12:5#0",
 *         kind: "line",
 *         title: "EMA",
 *     };
 *     void slot;
 */
export type PlotSlotDescriptor = {
    readonly slotId: string;
    readonly kind: PlotKind;
    readonly title?: string;
};

/**
 * One higher-timeframe expression unit in `ScriptManifest.securityExpressions`.
 * The compiler emits one entry per `request.security({ interval }, (bar) => …)`
 * callsite so the runtime knows which `slotId` is an HTF expression, on which
 * `interval` to clock it, and the callback's single parameter name. The
 * callback body stays inline in the compiled module — this descriptor is only
 * the registry pointing at it.
 *
 * @since 0.7
 * @stable
 * @example
 *     const unit: SecurityExpressionDescriptor = {
 *         slotId: "trend.ts:8:21#0",
 *         interval: "1W",
 *         paramName: "bar",
 *     };
 *     void unit;
 */
export type SecurityExpressionDescriptor = {
    readonly slotId: string;
    readonly interval: string;
    readonly paramName: string;
};

/**
 * Host-supplied presentation override for a single plot slot, keyed by
 * `PlotEmission.slotId`. Applied by the runtime at emit time; never
 * affects `compute`. `lineWidth` / `lineStyle` apply only to the
 * line-family plot kinds (`line`, `step-line`, `horizontal-line`,
 * `area`); ignored as a silent no-op on other kinds.
 *
 * @since 0.8
 * @stable
 * @example
 *     const override: PlotOverride = {
 *         visible: false,
 *         color: "#ff0000",
 *         lineWidth: 2,
 *         lineStyle: "dashed",
 *     };
 *     void override;
 */
export type PlotOverride = {
    readonly visible?: boolean;
    readonly color?: string;
    readonly lineWidth?: number;
    readonly lineStyle?: LineStyle;
};

/**
 * The metadata sidecar the compiler emits next to a compiled script. The
 * runtime reads this to size ring buffers, gate against adapter capabilities,
 * and pick secondary candle streams.
 *
 * @since 0.1
 * @example
 *     const m: ScriptManifest = {
 *         apiVersion: 1,
 *         kind: "indicator",
 *         name: "demo",
 *         inputs: {},
 *         capabilities: ["indicators"],
 *         requestedIntervals: [],
 *         userPickableInterval: false,
 *         seriesCapacities: {},
 *         maxLookback: 0,
 *         shortName: "demo",
 *         format: "compact",
 *     };
 */
export type ScriptManifest = {
    readonly apiVersion: 1;
    readonly kind: "indicator" | "drawing" | "alert" | "alertCondition";
    readonly name: string;
    readonly inputs: InputSchema;
    readonly capabilities: ReadonlyArray<CapabilityId>;
    readonly requestedIntervals: ReadonlyArray<string>;
    readonly userPickableInterval: boolean;
    readonly seriesCapacities: Readonly<Record<string, number>>;
    readonly maxLookback: number;
    /**
     * `overlay: false` on `defineIndicator(...)` is persisted here as the
     * script-level default pane signal. Absent / `true` means the script
     * defaults to the price overlay pane; `false` means the runtime
     * routes every `plot()` / `hline()` call without an explicit `pane`
     * opt into a per-script subpane key.
     *
     * @since 0.2
     * @stable
     * @example
     *     const m: Pick<ScriptManifest, "overlay"> = { overlay: false };
     *     void m;
     */
    readonly overlay?: boolean;
    /**
     * Per-bucket cap on `draw.*` emissions the script intends to
     * produce per bar. The runtime enforces
     * `min(this, adapter.capabilities.maxDrawingsPerScript)` per
     * bucket. Omit to default to the adapter's cap.
     *
     * @since 0.3
     */
    readonly maxDrawings?: DrawingCounts;
    /**
     * Max bars of historical lookback the script declares it needs.
     *
     * @since 0.4
     * @example
     *     const v: ScriptManifest["maxBarsBack"] = 100;
     *     void v;
     */
    readonly maxBarsBack?: number;
    /**
     * Value-formatting hint for axis labels + cursor read-out.
     *
     * @since 0.4
     * @example
     *     const v: ScriptManifest["format"] = "price";
     *     void v;
     */
    readonly format?: ValueFormat;
    /**
     * Decimal precision the adapter renders the script at.
     *
     * @since 0.4
     * @example
     *     const v: ScriptManifest["precision"] = 2;
     *     void v;
     */
    readonly precision?: number;
    /**
     * Scale-axis binding requested by the script.
     *
     * @since 0.4
     * @example
     *     const v: ScriptManifest["scale"] = "right";
     *     void v;
     */
    readonly scale?: ScaleAxis;
    /**
     * Compact display label for legend chips.
     *
     * @since 0.4
     * @example
     *     const v: ScriptManifest["shortName"] = "EMA";
     *     void v;
     */
    readonly shortName?: string;
    /**
     * Static set of intervals the script requires the target adapter to ship
     * in `Capabilities.intervals`. The compiler unions this with the static
     * set extracted from `request.security` calls in Task 8. `input.interval`
     * is user-pickable and does not contribute to this author-declared hard
     * requirement set.
     *
     * @since 0.4
     * @example
     *     const v: ScriptManifest["requiresIntervals"] = ["1D"];
     *     void v;
     */
    readonly requiresIntervals?: ReadonlyArray<string>;
    /**
     * Static list of user-wireable alert conditions declared by
     * `defineAlertCondition({ conditions })`.
     *
     * @since 0.5
     * @stable
     * @example
     *     const defs: ScriptManifest["alertConditions"] = [
     *         { id: "up", title: "Up", description: "Close > EMA", defaultMessage: "{{ticker}} up" },
     *     ];
     *     void defs;
     */
    readonly alertConditions?: ReadonlyArray<AlertConditionDefinition>;
    /**
     * Statically-resolved dependency graph nodes consumed by this
     * script. Empty / omitted for scripts with no
     * `<binding>.output(...)` calls. Each entry is one consumer-side
     * `const` binding pointing at another `defineIndicator(...)`
     * result.
     *
     * @since 0.7
     * @stable
     * @example
     *     const v: ScriptManifest["dependencies"] = [];
     *     void v;
     */
    readonly dependencies?: ReadonlyArray<DependencyDeclaration>;
    /**
     * Titled outputs this script exposes for consumption by other
     * indicators. Derived from `plot(value, { title })` calls in
     * this script's compute body. Empty / omitted when the script
     * has no titled plots.
     *
     * @since 0.7
     * @stable
     * @example
     *     const v: ScriptManifest["outputs"] = [
     *         { title: "line", kind: "series-number" },
     *     ];
     *     void v;
     */
    readonly outputs?: ReadonlyArray<OutputDeclaration>;
    /**
     * Static plot-slot descriptors — one per `plot()` / `hline()` callsite,
     * in callsite order. Lets an embedder enumerate plottable slots (and
     * key per-slot style/visibility overrides) without waiting for the
     * first emission. Absent on scripts that issue no plot/hline calls.
     *
     * @since 0.8
     * @stable
     * @example
     *     const v: ScriptManifest["plots"] = [
     *         { slotId: "ema.ts:12:5#0", kind: "line", title: "EMA" },
     *     ];
     *     void v;
     */
    readonly plots?: ReadonlyArray<PlotSlotDescriptor>;
    /**
     * Higher-timeframe expression units — one per
     * `request.security({ interval }, (bar) => …)` callsite, sorted by
     * `slotId`. Tells the runtime which slot ids run on an HTF clock and on
     * which interval. Absent on scripts that use only the data form (or no
     * `request.security` at all) so existing manifest snapshots stay
     * byte-identical.
     *
     * @since 0.7
     * @stable
     * @example
     *     const v: ScriptManifest["securityExpressions"] = [
     *         { slotId: "trend.ts:8:21#0", interval: "1W", paramName: "bar" },
     *     ];
     *     void v;
     */
    readonly securityExpressions?: ReadonlyArray<SecurityExpressionDescriptor>;
    /**
     * The ES-module binding name this manifest was reached through.
     * `"default"` for `export default defineIndicator(...)`; the
     * named-binding identifier otherwise. Always present when the
     * source file has more than one drawn indicator; omitted on
     * single-script files for back-compat.
     *
     * @since 0.7
     * @stable
     * @example
     *     const v: ScriptManifest["exportName"] = "default";
     *     void v;
     */
    readonly exportName?: string;
    /**
     * Other drawn manifests in the same compiled file. Present
     * only when this manifest is the file's default export and the
     * file has additional named-exported drawn indicators. Omitted
     * for single-script files and for non-default-export entries
     * in the array-form manifest sidecar.
     *
     * @since 0.7
     * @stable
     * @example
     *     const v: ScriptManifest["siblings"] = [];
     *     void v;
     */
    readonly siblings?: ReadonlyArray<ScriptManifest>;
    /**
     * `true` when this manifest belongs to a drawn (exported)
     * indicator — the host should mount it. `false` when this
     * manifest belongs to a private dep — emissions are dropped.
     * Defaults to `true` for back-compat.
     *
     * @since 0.7
     * @stable
     * @example
     *     const v: ScriptManifest["isDrawn"] = true;
     *     void v;
     */
    readonly isDrawn?: boolean;
};

/**
 * Per-condition descriptor authored under
 * `DefineAlertConditionOpts.conditions`.
 *
 * @since 0.5
 * @stable
 * @example
 *     const d: AlertConditionDescriptor = {
 *         title: "Up",
 *         description: "Close crossed up",
 *         defaultMessage: "{{ticker}} crossed up",
 *     };
 *     void d;
 */
export type AlertConditionDescriptor = Readonly<{
    title: string;
    description: string;
    defaultMessage: string;
}>;

/**
 * Manifest-ready alert-condition descriptor with the author map key
 * normalised into `id`.
 *
 * @since 0.5
 * @stable
 * @example
 *     const d: AlertConditionDefinition = {
 *         id: "up",
 *         title: "Up",
 *         description: "Close crossed up",
 *         defaultMessage: "{{ticker}} crossed up",
 *     };
 *     void d;
 */
export type AlertConditionDefinition = AlertConditionDescriptor &
    Readonly<{
        id: string;
    }>;

/**
 * The argument the runtime hands a script's `compute` function each bar. The
 * `ta` / `plot` / `hline` / `alert` slots are the runtime's implementations,
 * not the compile-time callable holes from `@invinite-org/chartlang-core`.
 *
 * @since 0.1
 * @example
 *     const fn: ComputeFn = ({ bar, plot }) => { plot(bar.close); };
 */
export type ComputeContext = {
    readonly bar: Bar;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly ta: TaNamespace;
    readonly plot: typeof import("./plot/plot.js").plot;
    readonly hline: typeof import("./plot/plot.js").hline;
    readonly alert: typeof import("./alert/alert.js").alert;
    /** Pine `var` / `varip` state slots. @since 0.4 */
    readonly state: StateNamespace;
    /** Bar-state view derived for the active step. @since 0.4 */
    readonly barstate: BarStateView;
    /** Symbol metadata view for the active script mount. @since 0.4 */
    readonly syminfo: SymInfoView;
    /** Timeframe helper view derived for the active step. @since 0.4 */
    readonly timeframe: TimeframeView;
    /** Secondary timeframe request namespace. @since 0.4 */
    readonly request: RequestNamespace;
    /** Runtime logging and fatal halt namespace. @since 0.5 */
    readonly runtime: RuntimeNamespace;
    /**
     * Signal a named condition declared by `defineAlertCondition`. Present
     * only for scripts whose manifest kind is `"alertCondition"`.
     *
     * @since 0.5
     * @stable
     * @example
     *     const fn: NonNullable<ComputeContext["signal"]> = (id, fired) => {
     *         void id;
     *         void fired;
     *     };
     *     void fn;
     */
    readonly signal?: (conditionId: string, fired: boolean) => void;
    /**
     * Imperative drawing namespace. Each method returns a
     * {@link DrawingHandle} the script can `update(...)` or
     * `remove()` within the same `compute` run, and across bars.
     * The Phase-3 runtime impl lives in
     * `@invinite-org/chartlang-runtime/emit/draw`. @since 0.3
     */
    readonly draw: DrawNamespace;
};

/**
 * The per-bar compute function a script exports via `defineIndicator` /
 * `defineAlert`. Pure with respect to its arguments — no `this`, no closures
 * over host state.
 *
 * @since 0.1
 * @example
 *     const fn: ComputeFn = (ctx) => { ctx.plot(ctx.bar.close); };
 */
export type ComputeFn = (ctx: ComputeContext) => void;

/**
 * The frozen object the `defineIndicator` / `defineAlert` constructors return.
 * The compiler rewrites `manifest` fields at build time; the runtime invokes
 * `compute` per bar.
 *
 * The `output` / `withInputs` accessors (Phase 7) are compiler-rewritten
 * sentinels — the indicator-composition compiler pass statically replaces
 * every consumer-side call site before bundling, so the runtime never
 * executes the throwing bodies. Direct invocation from an un-compiled
 * script (e.g. a unit test that imports the module directly) hits the
 * sentinel and throws, which is the desired failure.
 *
 * @since 0.1
 * @example
 *     const cs: CompiledScriptObject = defineIndicator({
 *         name: "demo",
 *         apiVersion: 1,
 *         compute: () => {},
 *     });
 */
export type CompiledScriptObject = {
    readonly manifest: ScriptManifest;
    readonly compute: ComputeFn;
    /**
     * Read the named output of this indicator inside another
     * indicator's compute body. Output names come from the
     * producer's `plot(value, { title })` calls. The compiler
     * rewrites every consumer-side call site before bundling;
     * direct invocation throws the dep-accessor sentinel.
     *
     * @since 0.7
     * @stable
     * @example
     *     declare const baseTrend: CompiledScriptObject;
     *     const line: Series<number> = baseTrend.output("line");
     *     void line;
     */
    readonly output: (name: string) => Series<number>;
    /**
     * Return a new `CompiledScriptObject` whose dependency-binding
     * effective inputs are the merge of the producer's defaults with
     * the supplied overrides. Static — the compiler folds the
     * override into the inlined dep manifest at bundle time.
     *
     * @since 0.7
     * @stable
     * @example
     *     declare const baseTrend: CompiledScriptObject;
     *     const trend = baseTrend.withInputs({ length: 50 });
     *     void trend;
     */
    readonly withInputs: (overrides: Readonly<Record<string, unknown>>) => CompiledScriptObject;
};

/**
 * The compiled artefact for a `.chart.ts` file when it contains
 * multiple drawn indicators or any dependency graph. The Phase-7
 * runtime accepts either this shape or the legacy
 * `CompiledScriptObject` (single-script files).
 *
 * `primary` is the default-exported drawn script. `siblings` are
 * every other drawn export (named consts). `dependencies` is every
 * private-dep compiled object — keyed by `localId` so the runtime
 * can look them up by the `DependencyDeclaration.localId` it sees
 * on each consumer's manifest.
 *
 * @since 0.7
 * @stable
 * @example
 *     declare const primary: CompiledScriptObject;
 *     const bundle: CompiledScriptBundle = {
 *         primary,
 *         siblings: [],
 *         dependencies: [],
 *     };
 *     void bundle;
 */
export type CompiledScriptBundle = Readonly<{
    readonly primary: CompiledScriptObject;
    readonly siblings: ReadonlyArray<{
        readonly exportName: string;
        readonly compiled: CompiledScriptObject;
    }>;
    readonly dependencies: ReadonlyArray<{
        readonly localId: string;
        readonly compiled: CompiledScriptObject;
        /**
         * Merged `.withInputs({...})` overrides the consumer applied
         * to its alias binding. Forwarded into the `DepRunner` as the
         * dep's input overrides so the producer's `compute` reads the
         * consumer-supplied values instead of the producer's manifest
         * defaults. Omitted for direct private deps that don't apply
         * overrides.
         *
         * @since 0.7
         */
        readonly inputOverrides?: Readonly<Record<string, unknown>>;
    }>;
}>;

/**
 * Narrowing helper that distinguishes the new
 * {@link CompiledScriptBundle} envelope from the legacy single-script
 * {@link CompiledScriptObject}. The runner uses it to pick the
 * multi-script execution path without re-parsing manifests.
 *
 * @since 0.7
 * @stable
 * @example
 *     declare const v: CompiledScriptObject | CompiledScriptBundle;
 *     if (isCompiledScriptBundle(v)) {
 *         void v.primary;
 *     } else {
 *         void v.manifest;
 *     }
 */
export const isCompiledScriptBundle = (
    v: CompiledScriptObject | CompiledScriptBundle,
): v is CompiledScriptBundle => Object.prototype.hasOwnProperty.call(v, "primary");

/**
 * JSON-compatible payload type for `alert(...).meta` and other places the
 * runtime serialises script-supplied data across worker / host boundaries.
 *
 * @since 0.1
 * @example
 *     const meta: JsonValue = { reason: "crossover", strength: 0.42 };
 */
export type JsonValue =
    | null
    | boolean
    | number
    | string
    | ReadonlyArray<JsonValue>
    | { readonly [k: string]: JsonValue };
