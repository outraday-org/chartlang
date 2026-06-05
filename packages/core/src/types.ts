// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { TaNamespace } from "./ta/ta";

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
 * Adapter-declared timeframe entry — the `{ value, label, group }` triple
 * surfaced in the script-settings UI. Used by `input.interval(...)` in
 * Phase 4+; the surface lands here in Phase 1 so consumers can pin against a
 * stable type.
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
};

/**
 * Script-author-declared input schema attached to `defineIndicator` /
 * `defineAlert`. Phase 4 fills `input.*` builders; Phase 1 keeps the type as
 * an opaque readonly record so `ScriptManifest` stays stable.
 *
 * @since 0.1
 * @example
 *     const inputs: InputSchema = { length: 14 };
 */
export type InputSchema = Readonly<Record<string, unknown>>;

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
export type CapabilityId = "indicators" | "drawings" | "alerts";

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
 *     };
 */
export type ScriptManifest = {
    readonly apiVersion: 1;
    readonly kind: "indicator" | "drawing" | "alert";
    readonly name: string;
    readonly inputs: InputSchema;
    readonly capabilities: ReadonlyArray<CapabilityId>;
    readonly requestedIntervals: ReadonlyArray<string>;
    readonly userPickableInterval: boolean;
    readonly seriesCapacities: Readonly<Record<string, number>>;
    readonly maxLookback: number;
};

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
    readonly plot: typeof import("./plot/plot").plot;
    readonly hline: typeof import("./plot/plot").hline;
    readonly alert: typeof import("./alert/alert").alert;
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
};

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
