// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertSeverity,
    Bar,
    Color,
    DrawingCounts as CoreDrawingCounts,
    DrawingKind as CoreDrawingKind,
    InputKind as CoreInputKind,
    ExternalSeriesFeedMap,
    PlotKind as CorePlotKind,
    PlotOverride as CorePlotOverride,
    PlotSlotDescriptor as CorePlotSlotDescriptor,
    DrawingState,
    IntervalDescriptor,
    JsonValue,
    LineStyle,
    LogLevel,
    SymbolType,
} from "@invinite-org/chartlang-core";

export type { ExternalSeriesFeed, ExternalSeriesFeedMap } from "@invinite-org/chartlang-core";

/**
 * Adapter-supplied candle event the runtime consumes through
 * `Adapter.candles(...)`. `history` is a batched warm-up payload; `close`
 * carries a finalised bar; `tick` carries an intra-bar update that the
 * runtime applies to the current bar's head slot.
 *
 * @since 0.1
 * @stable
 * @example
 *     const evt: CandleEvent = { kind: "history", bars: [] };
 */
export type CandleEvent =
    | {
          readonly kind: "history";
          readonly bars: ReadonlyArray<Bar>;
          /**
           * Secondary-stream feed key. Omit for the main stream; otherwise set
           * to the composite key built by core's `feedKey(symbol, interval)` —
           * the bare interval (`"1D"`) for a higher-timeframe stream of the
           * chart's own symbol, or `"<symbol>@<interval>"` (`"AMEX:SPY@1D"`)
           * for a different-symbol stream. Must match the runtime's
           * secondary-stream key byte-for-byte.
           *
           * @since 0.5
           */
          readonly streamKey?: string;
      }
    | {
          readonly kind: "close";
          readonly bar: Bar;
          /**
           * Secondary-stream feed key. Omit for the main stream; otherwise set
           * to the composite key built by core's `feedKey(symbol, interval)` —
           * the bare interval (`"1D"`) for a higher-timeframe stream of the
           * chart's own symbol, or `"<symbol>@<interval>"` (`"AMEX:SPY@1D"`)
           * for a different-symbol stream. Must match the runtime's
           * secondary-stream key byte-for-byte.
           *
           * @since 0.5
           */
          readonly streamKey?: string;
      }
    | {
          readonly kind: "tick";
          readonly bar: Bar;
          /**
           * Secondary-stream feed key. Omit for the main stream; otherwise set
           * to the composite key built by core's `feedKey(symbol, interval)` —
           * the bare interval (`"1D"`) for a higher-timeframe stream of the
           * chart's own symbol, or `"<symbol>@<interval>"` (`"AMEX:SPY@1D"`)
           * for a different-symbol stream. Must match the runtime's
           * secondary-stream key byte-for-byte.
           *
           * @since 0.5
           */
          readonly streamKey?: string;
      };

/**
 * Indicator plot styles Phase 1 ships. Re-exported from
 * `@invinite-org/chartlang-core` so the script-facing and adapter-facing
 * surfaces stay in lock-step — the full PLAN §7.2 set lands in Phase 2+,
 * additively, in the core declaration. Pinned set — additive only across
 * `apiVersion: 1.x`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const k: PlotKind = "line";
 */
export type PlotKind = CorePlotKind;

/**
 * One plotted-slot descriptor in `ScriptManifest.plots`. Re-exported
 * from `@invinite-org/chartlang-core` so the script-facing and
 * adapter-facing surfaces stay in lockstep — adapter authors key
 * style/visibility UI rows by the stable `slotId`.
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
export type PlotSlotDescriptor = CorePlotSlotDescriptor;

/**
 * Host-supplied presentation override for a single plot slot, keyed by
 * `PlotEmission.slotId`. Re-exported from `@invinite-org/chartlang-core`
 * so adapter authors and hosts share the same shape. Applied by the
 * runtime at emit time; never affects `compute`.
 *
 * @since 0.8
 * @stable
 * @example
 *     const override: PlotOverride = { visible: false, color: "#ff0000" };
 *     void override;
 */
export type PlotOverride = CorePlotOverride;

/**
 * Drawing kind discriminator. Phase 3 widens the Phase-1 `"line"`
 * placeholder to the full 61-entry kebab-case union — re-exported from
 * `@invinite-org/chartlang-core`. The wire format is kebab-case; the
 * camelCase TypeScript surface (`draw.horizontalLine`,
 * `draw.fibRetracement`, …) is pinned via core's
 * `KIND_CAMELCASE` / `KIND_KEBABCASE` bijection. Phase-1 / Phase-2
 * adapter code that wrote `drawingKind: "line"` keeps compiling — the
 * widening is purely additive. Pinned set — additive only across
 * `apiVersion: 1.x`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const k: DrawingKind = "fib-retracement";
 *     void k;
 */
export type DrawingKind = CoreDrawingKind;

/**
 * Channels an alert emission can be dispatched on. Adapters declare the
 * subset they support via `Capabilities.alerts`; emissions to unsupported
 * channels drop with `unsupported-alert-channel`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const c: AlertChannel = "toast";
 */
export type AlertChannel = "log" | "toast" | "webhook" | "email" | "sms" | "push";

/**
 * Input families an adapter is willing to surface in the script-settings
 * UI. Phase-1 example scripts use defaults only; `input.*` runtime
 * resolution lands in Phase 4.
 *
 * @since 0.1
 * @stable
 * @example
 *     const k: InputKind = "int";
 */
export type InputKind = CoreInputKind;

/**
 * `syminfo.*` fields the adapter populates. Phase-1 scripts don't read
 * symbol metadata; the type is here so consumer-repo adapters can pin
 * against a stable shape now.
 *
 * @since 0.1
 * @stable
 * @example
 *     const f: SymInfoField = "ticker";
 */
export type SymInfoField =
    | "ticker"
    | "type"
    | "mintick"
    | "currency"
    | "basecurrency"
    | "exchange"
    | "timezone"
    | "session"
    | "meta";

/**
 * Adapter-supplied per-mount symbol metadata payload consumed by the
 * runtime's `syminfo.*` view builder.
 *
 * @since 0.4
 * @stable
 * @example
 *     const info: AdapterSymInfo = {
 *         ticker: "DEMO",
 *         type: "equity",
 *         mintick: 0.01,
 *     };
 *     void info;
 */
export type AdapterSymInfo = Readonly<{
    ticker?: string;
    type?: SymbolType;
    mintick?: number;
    currency?: string;
    basecurrency?: string;
    exchange?: string;
    timezone?: string;
    session?: string;
    meta?: Readonly<Record<string, JsonValue>>;
}>;

/**
 * Per-script drawing-emission budget. Excess `draw.*` calls fall back to
 * no-op + `drawing-budget-exceeded`. Mirrors Pine's `max_*_count` family.
 *
 * Canonical declaration lives in `@invinite-org/chartlang-core/types`
 * (Phase 3) so `ScriptManifest.maxDrawings?` and
 * `Capabilities.maxDrawingsPerScript` pin the same shape — the public
 * surface here is preserved via a type re-export. The re-export
 * preserves the `adapter-kit → core` dependency direction.
 *
 * @since 0.1
 * @stable
 * @example
 *     const c: DrawingCounts = {
 *         lines: 50, labels: 50, boxes: 50, polylines: 50, other: 50,
 *     };
 *     void c;
 */
export type DrawingCounts = CoreDrawingCounts;

/**
 * Capability bag an adapter declares. The runtime, host-worker, and
 * editor all gate emissions through this shape. Primitives outside the
 * declared set become silent no-ops + diagnostic (PLAN §7.4).
 * Capability keys are pinned — additive only across `apiVersion: 1.x`.
 *
 * `input.externalSeries(...)` feed support is host-supplied through the
 * adapter callback, not through this capability subset.
 *
 * @since 0.1
 * @stable
 * @example
 *     const c: Capabilities = {
 *         plots: new Set(["line"]),
 *         drawings: new Set(),
 *         alerts: new Set(["toast"]),
 *         alertConditions: false,
 *         logs: false,
 *         inputs: new Set(),
 *         intervals: [],
 *         multiTimeframe: false,
 *         multiSymbol: false,
 *         subPanes: 0,
 *         symInfoFields: new Set(),
 *         maxDrawingsPerScript: {
 *             lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0,
 *         },
 *         maxLookback: 5000,
 *         maxTickHz: 10,
 *     };
 */
export type Capabilities = {
    readonly plots: ReadonlySet<PlotKind>;
    readonly drawings: ReadonlySet<DrawingKind>;
    readonly alerts: ReadonlySet<AlertChannel>;
    /**
     * Whether the adapter can route `defineAlertCondition` user-wired
     * alerts per PLAN §11.2.
     *
     * @since 0.4
     * @stable
     * @example
     *     const enabled: Capabilities["alertConditions"] = false;
     *     void enabled;
     */
    readonly alertConditions: boolean;
    /**
     * Whether the adapter renders `runtime.log.*` messages per PLAN §11.3.
     *
     * @since 0.4
     * @stable
     * @example
     *     const enabled: Capabilities["logs"] = false;
     *     void enabled;
     */
    readonly logs: boolean;
    readonly inputs: ReadonlySet<InputKind>;
    /**
     * Timeframes this adapter can deliver candles for. Order is meaningful
     * for editor pickers and `request.security` validation (PLAN §4.5).
     *
     * @since 0.4
     * @stable
     * @example
     *     const intervals: Capabilities["intervals"] = [
     *         { value: "1D", label: "1 day", group: "daily" },
     *     ];
     *     void intervals;
     */
    readonly intervals: ReadonlyArray<IntervalDescriptor>;
    /**
     * Whether the adapter can deliver more than one candle stream per script
     * load. `false` triggers the Phase 4 all-NaN fallback for
     * `request.security` (PLAN §4.5).
     *
     * @since 0.4
     * @stable
     * @example
     *     const enabled: Capabilities["multiTimeframe"] = false;
     *     void enabled;
     */
    readonly multiTimeframe: boolean;
    /**
     * Whether the adapter can deliver candle streams for a **different symbol**
     * than the chart's own (e.g. a cross-instrument ratio). A strictly larger
     * capability than {@link Capabilities.multiTimeframe} — an adapter can
     * resample its own symbol to a higher timeframe without being able to fetch
     * another instrument. `false` triggers the all-NaN fallback for any
     * `request.security({ symbol })` whose symbol differs from the chart symbol
     * (a chart-symbol / interval-only request stays gated only by
     * `multiTimeframe`). Independent of `multiTimeframe` — the runtime gates
     * per request (symbol differs ⇒ `multiSymbol`; interval differs ⇒
     * `multiTimeframe`).
     *
     * @since 1.6
     * @stable
     * @example
     *     const enabled: Capabilities["multiSymbol"] = false;
     *     void enabled;
     */
    readonly multiSymbol: boolean;
    /**
     * Max number of sub-panes the adapter can render for one script. Use
     * `Number.MAX_SAFE_INTEGER` as the unlimited sentinel per PLAN §7.2.
     *
     * @since 0.4
     * @stable
     * @example
     *     const max: Capabilities["subPanes"] = Number.MAX_SAFE_INTEGER;
     *     void max;
     */
    readonly subPanes: number;
    /**
     * `syminfo.*` fields this adapter populates. Missing fields evaluate to
     * empty sentinels per PLAN §4.8.
     *
     * @since 0.4
     * @stable
     * @example
     *     const fields: Capabilities["symInfoFields"] = new Set(["ticker"]);
     *     void fields;
     */
    readonly symInfoFields: ReadonlySet<SymInfoField>;
    /**
     * Per-script drawing-emission budget consumed by runtime drawing gates
     * and bucketed by PLAN §10 drawing categories.
     *
     * @since 0.4
     * @stable
     * @example
     *     const counts: Capabilities["maxDrawingsPerScript"] = {
     *         lines: 50, labels: 50, boxes: 50, polylines: 50, other: 50,
     *     };
     *     void counts;
     */
    readonly maxDrawingsPerScript: DrawingCounts;
    readonly maxLookback: number;
    readonly maxTickHz: number;
};

/**
 * Plot style discriminated union. Phase 1 shipped `line` / `step-line` /
 * `horizontal-line`; Phase 2 adds `histogram` / `area` /
 * `filled-band` / `label` / `marker` per PLAN §7.3. Phase 5 will extend
 * further (`shape`, `character`, `arrow`, `vertical-line`,
 * `bar-override`, …). Every expansion is additive — `apiVersion: 1`
 * scripts stay valid.
 *
 * @since 0.1
 * @stable
 * @example
 *     const line: PlotStyle = { kind: "line", lineWidth: 1, lineStyle: "solid" };
 *     const hist: PlotStyle = { kind: "histogram", baseline: 0 };
 *     const band: PlotStyle = { kind: "filled-band", upper: 1, lower: -1, alpha: 0.2 };
 *     void line; void hist; void band;
 */
export type PlotStyle =
    | {
          readonly kind: "line";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
      }
    | {
          readonly kind: "step-line";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
      }
    | {
          readonly kind: "horizontal-line";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
      }
    /** Phase 2 — column rising from `baseline` to `value`. @since 0.2 */
    | {
          readonly kind: "histogram";
          readonly baseline: number;
      }
    /** Phase 2 — filled polygon under a polyline. @since 0.2 */
    | {
          readonly kind: "area";
          readonly lineWidth: number;
          readonly lineStyle: LineStyle;
          readonly fillAlpha: number;
      }
    /** Phase 2 — region between two polylines. `upper` / `lower` may be
     *  `null` to mark a per-bar gap; both `null` is rejected by
     *  {@link validateEmission}. @since 0.2 */
    | {
          readonly kind: "filled-band";
          readonly upper: number | null;
          readonly lower: number | null;
          readonly alpha: number;
      }
    /** Phase 2 — text annotation anchored above / below / at the value.
     *  @since 0.2 */
    | {
          readonly kind: "label";
          readonly text: string;
          readonly position: "above" | "below" | "anchor";
      }
    /** Phase 2 — discrete glyph at the value. @since 0.2 */
    | {
          readonly kind: "marker";
          readonly shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
          readonly size: number;
      }
    /** Phase 5 — Pine `plotshape` glyph at the plot anchor. @since 0.5 */
    | {
          readonly kind: "shape";
          readonly shape:
              | "circle"
              | "triangle-up"
              | "triangle-down"
              | "square"
              | "diamond"
              | "cross"
              | "xcross"
              | "flag";
          readonly size: number;
          readonly location?: "above" | "below" | "absolute";
      }
    /** Phase 5 — Pine `plotchar` text glyph at the plot anchor. @since 0.5 */
    | {
          readonly kind: "character";
          readonly char: string;
          readonly size: number;
          readonly location?: "above" | "below" | "absolute";
      }
    /** Phase 5 — Pine `plotarrow` directional marker. @since 0.5 */
    | {
          readonly kind: "arrow";
          readonly direction: "up" | "down";
          readonly size: number;
      }
    /** Phase 5 — Pine `plotcandle` body-color override. @since 0.5 */
    | {
          readonly kind: "candle-override";
          readonly bull: Color;
          readonly bear: Color;
          readonly doji?: Color;
      }
    /** Phase 5 — Pine `plotbar` outline-color override. @since 0.5 */
    | {
          readonly kind: "bar-override";
          readonly color: Color;
      }
    /** Phase 5 — Pine `bgcolor` background band. @since 0.5 */
    | {
          readonly kind: "bg-color";
          readonly color: Color;
          readonly transp?: number;
      }
    /** Phase 5 — Pine `barcolor` candle/bar tint. @since 0.5 */
    | {
          readonly kind: "bar-color";
          readonly color: Color;
      }
    /** Phase 5 — volume-profile horizontal histogram buckets. @since 0.5 */
    | {
          readonly kind: "horizontal-histogram";
          readonly buckets: ReadonlyArray<
              Readonly<{ readonly price: number; readonly volume: number; readonly color?: Color }>
          >;
      };

/**
 * A `plot()` / `hline()` emission the runtime sends to the adapter.
 * Numeric `value: null` is the wire-level "skip this bar" — NaN/Infinity
 * are forbidden in `value` and anywhere in `meta` (PLAN §7.3 universal
 * payload rules). The optional {@link PlotEmission.colorValue} carries a
 * per-bar dynamic color that overrides the static `color` / `style.color`
 * when present; omit it for the static-color baseline.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: PlotEmission = {
 *         kind: "plot",
 *         slotId: "ema-cross.ts:12:5#0",
 *         title: "EMA",
 *         style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
 *         bar: 100,
 *         time: 1_700_000_000_000,
 *         value: 42.31,
 *         color: "#3b82f6",
 *         meta: {},
 *         pane: "overlay",
 *     };
 */
export type PlotEmission = {
    readonly kind: "plot";
    readonly slotId: string;
    readonly title: string;
    readonly style: PlotStyle;
    readonly bar: number;
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly meta: Readonly<Record<string, JsonValue>>;
    readonly pane: "overlay" | "new" | string;
    /**
     * Per-plot visibility. **Omitted (or `true`) ⇒ visible** — the emission
     * renders exactly as it would without the field, so a no-`visible`
     * emission is byte-identical to the pre-feature wire. The runtime only
     * ever writes `visible: false`, set either by an authoring-driven
     * `plot(value, { visible })` opt (the script hid the slot) or by a host
     * `PlotOverride` (the host hid the slot) — the SAME field carries both.
     *
     * **`visible === false` is the normative adapter contract:** an adapter
     * MUST skip rendering this emission's mark AND MUST exclude it from the
     * y-scale / autoscale computation. It MUST NOT be drawn as a per-bar gap /
     * break — that is {@link PlotEmission.value}` === null`'s job (a hole that
     * interrupts line continuity); `visible: false` suppresses the whole mark
     * instead, and MUST NOT be substituted with a `NaN` value. The two are
     * ORTHOGONAL and may co-occur (a hidden plot still carries its real numeric
     * `value` on the wire). Visibility is never capability-gated — every
     * adapter that can draw a plot can also skip it.
     *
     * An adapter that owns a persistent series / legend (lightweight-charts,
     * uPlot, ECharts) SHOULD keep the hidden slot LISTED (hidden, not removed)
     * so re-enabling restores it without re-creating state; a self-scaled
     * adapter that re-derives the whole scene each frame (canvas2d, konva,
     * webgl) has no legend to ghost and observationally satisfies this by
     * simply omitting the hidden mark.
     *
     * @since 0.8
     * @stable
     * @example
     *     const hidden: PlotEmission["visible"] = false;
     *     void hidden;
     */
    readonly visible?: boolean;
    /**
     * Presentation-only horizontal display shift in **bars**. Omitted (or
     * `0`) ⇒ no shift, so a no-shift emission is byte-identical to a plot
     * that never carried the field. `+n` shifts the plotted series `n`
     * bars **right** (into the future); `−n` shifts it `n` bars **left**
     * (into the past). It moves only where the series renders — `value`
     * is the unshifted number and alert bars are unaffected. Must be a
     * signed integer; `validateEmission` rejects a non-integer.
     *
     * @since 1.3
     * @stable
     * @example
     *     const shifted: PlotEmission["xShift"] = -5;
     *     void shifted;
     */
    readonly xShift?: number;
    /**
     * Presentation-only render-order key (z-index). Omitted (or `0`) ⇒ no
     * explicit order, so the emission is byte-identical to a plot that
     * never carried the field. Higher `z` renders on top; lower (incl.
     * negative) renders behind. Adapters MUST compute a stable global
     * order keyed on `(z ?? 0, groupBand, declarationSeq)` — a plot with
     * `z` below a drawing's `z` renders beneath that drawing, crossing the
     * default plots-under-drawings band. Any finite number (fractional
     * allowed); `validateEmission` rejects NaN / ±Infinity. Affects only
     * stacking — `value`, `xShift`, alerts, and `state.*` are unaffected.
     *
     * @since 1.4
     * @stable
     * @example
     *     const behind: PlotEmission["z"] = -1;
     *     void behind;
     */
    readonly z?: number;
    /**
     * Per-bar dynamic color for this emission. **Omitted ⇒** the adapter uses
     * the static color (the style's `color` for `bg-color`/`bar-color`, or the
     * top-level {@link PlotEmission.color} for line-family plots), so a
     * no-dynamic-color emission is byte-identical to the pre-feature wire and
     * every pinned `plot-hash` (which hashes only `{ bar, value }`) is
     * untouched. **Present ⇒** it OVERRIDES the static color for this
     * `(slotId, bar)` at render time. Adapters MUST prefer `colorValue` over
     * the static color when present (`colorValue` wins over `style.color` for
     * `bg-color`/`bar-color`, and over the top-level `color` for line-family
     * plots) — this is the normative precedence contract binding every
     * conformant adapter. **`null` ⇒** an explicit "no color this bar" gap,
     * which is DISTINCT from omitted (omitted falls back to the static color;
     * `null` paints nothing). This
     * channel is orthogonal to the numeric {@link PlotEmission.value}: a
     * `bg-color` emission still carries `value: null` and rides its per-bar
     * color here. Like {@link PlotEmission.xShift} / {@link PlotEmission.z} it
     * is appended and omitted-when-absent, so the wire order stays additive.
     *
     * Rejected alternatives (recorded for future maintainers): (1) overloading
     * `value` to `number | string | null` — `value` is load-bearing for alerts,
     * y-scale inclusion, the NaN-forbidden rule, and the `plot-hash` tuple, so
     * widening it poisons every numeric consumer and rebreaks every hash;
     * (2) a new per-bar-color `PlotStyle` arm — color-per-bar is orthogonal to
     * *style*, so encoding it as a style splits one concept across N arms and
     * still cannot recolor a `line` plot per bar. The parallel optional channel
     * avoids both.
     *
     * @since 1.5
     * @stable
     * @example
     *     const dyn: PlotEmission["colorValue"] = "#16a34a";
     *     const gap: PlotEmission["colorValue"] = null;
     *     void dyn;
     *     void gap;
     */
    readonly colorValue?: Color | null;
};

/**
 * An `alert()` emission. `dedupeKey` is computed by the runtime
 * (`slotId + bar + hash(message + meta)`) and adapters that dispatch
 * via async channels MUST use it for idempotency.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: AlertEmission = {
 *         kind: "alert",
 *         slotId: "rsi.ts:42:1#0",
 *         severity: "warning",
 *         message: "RSI divergence",
 *         bar: 200,
 *         time: 1_700_000_000_000,
 *         meta: {},
 *         channels: ["toast"],
 *         dedupeKey: "rsi.ts:42:1#0|200|deadbeef",
 *     };
 */
export type AlertEmission = {
    readonly kind: "alert";
    readonly slotId: string;
    readonly severity: AlertSeverity;
    readonly message: string;
    readonly bar: number;
    readonly time: number;
    readonly meta: Readonly<Record<string, JsonValue>>;
    readonly channels: ReadonlyArray<AlertChannel>;
    readonly dedupeKey: string;
};

/**
 * Per-bar emission produced by `ComputeContext.signal(conditionId, fired)`.
 * Adapters route these named, user-wired conditions to delivery channels
 * configured in their own UI.
 *
 * @since 0.5
 * @stable
 * @example
 *     const e: AlertConditionEmission = {
 *         kind: "alert-condition",
 *         conditionId: "bullishCross",
 *         title: "Bullish cross",
 *         description: "Fast EMA crossed above slow EMA",
 *         defaultMessage: "{{ticker}} crossed up",
 *         fired: true,
 *         bar: 42,
 *         time: 1_700_000_000_000,
 *     };
 *     void e;
 */
export type AlertConditionEmission = {
    readonly kind: "alert-condition";
    readonly conditionId: string;
    readonly title: string;
    readonly description: string;
    readonly defaultMessage: string;
    readonly fired: boolean;
    readonly bar: number;
    readonly time: number;
};

/**
 * Per-bar debug log produced by `runtime.log.info/warn/error(...)`.
 * Logs are capability-gated by `Capabilities.logs`; disabled logs are
 * silent no-ops because they are debugging output rather than signal.
 *
 * @since 0.5
 * @stable
 * @example
 *     const e: LogEmission = {
 *         kind: "log",
 *         level: "info",
 *         message: "ema warmed",
 *         meta: { ema: 42 },
 *         bar: 10,
 *         time: 1_700_000_000_000,
 *     };
 *     void e;
 */
export type LogEmission = {
    readonly kind: "log";
    readonly level: LogLevel;
    readonly message: string;
    readonly meta?: Readonly<Record<string, JsonValue>>;
    readonly bar: number;
    readonly time: number;
};

/**
 * A `draw.*` emission. Phase 3 narrows `state` from `unknown` to the
 * typed {@link DrawingState} discriminated union. `op: "create"`
 * carries the initial state; `op: "update"` carries the FULL merged
 * state per the §10.3 full-state semantic (not a patch); `op:
 * "remove"` carries the last-known state.
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: DrawingEmission = {
 *         kind: "drawing",
 *         handleId: "ph3.ts:1:1#0",
 *         drawingKind: "line",
 *         op: "create",
 *         state: {
 *             kind: "line",
 *             anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *             style: {},
 *         },
 *         bar: 0,
 *         time: 0,
 *     };
 *     void e;
 */
export type DrawingEmission = {
    readonly kind: "drawing";
    readonly handleId: string;
    readonly drawingKind: DrawingKind;
    readonly op: "create" | "update" | "remove";
    readonly state: DrawingState;
    readonly bar: number;
    readonly time: number;
    /**
     * Presentation-only render-order key (z-index). Omitted (or `0`) ⇒ no
     * explicit order, so the emission is byte-identical to a drawing that
     * never carried the field. Higher `z` renders on top; a **negative**
     * `z` lets a drawing render **below** `z=0` plots, crossing the
     * default plots-under-drawings band. Adapters MUST compute a stable
     * global order keyed on `(z ?? 0, groupBand, declarationSeq)`. Any
     * finite number (fractional allowed); `validateEmission` rejects
     * NaN / ±Infinity. Affects only stacking — `state.*` geometry is
     * unaffected. `z` is part of the latest state under the per-`(handleId,
     * bar)` last-write-wins dedup: a `create` then `update` that changes
     * `z` takes the updated value.
     *
     * @since 1.4
     * @stable
     * @example
     *     const beneathPlots: DrawingEmission["z"] = -1;
     *     void beneathPlots;
     */
    readonly z?: number;
};

/**
 * Stable machine-readable diagnostic code emitted by the runtime / host
 * when an emission is dropped, an input fails coercion, or a budget is
 * exceeded. Pinned set — additive only across `apiVersion: 1.x`.
 *
 * Phase 7 adds the `dep-*` family covering compile-time and runtime
 * failures of the indicator-composition surface introduced by
 * `CompiledScriptObject.output` / `.withInputs`:
 *
 * - `dep-error` — dependency `compute` threw; parent's bar dropped.
 * - `dep-cycle` — compile-time dependency cycle detected.
 * - `dep-unknown-output` — `<binding>.output("x")` references a title
 *   the producer doesn't emit via `plot(value, { title })`.
 * - `dep-invalid-input-override` — `.withInputs({...})` carries a key
 *   not in the producer's `inputs` schema, or fails coercion.
 * - `dep-dynamic` — dep binding cannot be statically resolved
 *   (non-`const`, conditional initialiser, computed access).
 * - `dep-output-not-titled` — producer's `plot(...)` has no `title`,
 *   so consumers cannot reference it by name.
 *
 * `multi-symbol-not-supported` — a `request.security` for a DIFFERENT symbol
 * than the chart's against an adapter declaring `multiSymbol: false` degrades
 * to all-NaN, mirroring `multi-timeframe-not-supported`. The runtime gates per
 * request (symbol differs ⇒ this code; interval differs ⇒
 * `multi-timeframe-not-supported`), and the symbol gate precedes the timeframe
 * gate so a both-different request emits only this code.
 *
 * `tz-dst-unsupported` — a `time.*` / `session.*` accessor was passed a
 * DST-bearing IANA timezone (e.g. `"America/New_York"`). The v1 calendar
 * runtime resolves UTC + fixed offsets only (byte-reproducible, no `Intl`), so
 * a DST zone falls back to UTC and warns once per distinct tz per mount.
 *
 * @since 0.1
 * @stable
 * @example
 *     const code: DiagnosticCode = "unsupported-plot-kind";
 *     const dep: DiagnosticCode = "dep-cycle";
 *     void code;
 *     void dep;
 */
export type DiagnosticCode =
    | "unsupported-plot-kind"
    | "unsupported-drawing-kind"
    | "unsupported-alert-channel"
    | "unsupported-pane"
    | "unsupported-interval"
    | "multi-timeframe-not-supported"
    | "multi-symbol-not-supported"
    | "unknown-secondary-stream"
    | "lookback-exceeded"
    | "drawing-budget-exceeded"
    | "dropped-by-policy"
    | "input-coercion-failed"
    | "alert-conditions-not-supported"
    | "unknown-alert-condition"
    | "alert-rate-limited"
    | "runtime-cpu-budget-exceeded"
    | "runtime-memory-budget-exceeded"
    | "runtime-log-budget-exceeded"
    | "malformed-log-meta"
    | "runtime-error-thrown"
    | "session-info-missing"
    | "tz-dst-unsupported"
    | "fixed-range-inverted"
    | "state-snapshot-restored"
    | "state-snapshot-future-dated"
    | "state-snapshot-malformed"
    | "state-snapshot-save-failed"
    | "malformed-emission"
    | "dep-error"
    | "dep-cycle"
    | "dep-unknown-output"
    | "dep-invalid-input-override"
    | "dep-dynamic"
    | "dep-output-not-titled";

/**
 * A non-rendered diagnostic the runtime / host surfaces to the editor +
 * error reporters. Never user-visible on its own.
 *
 * @since 0.1
 * @stable
 * @example
 *     const d: RuntimeDiagnostic = {
 *         kind: "diagnostic",
 *         severity: "warning",
 *         code: "unsupported-plot-kind",
 *         message: "plot kind 'area' not in adapter capabilities",
 *         slotId: "ema.ts:1:1#0",
 *         bar: 10,
 *     };
 */
export type RuntimeDiagnostic = {
    readonly kind: "diagnostic";
    readonly severity: "info" | "warning" | "error";
    readonly code: DiagnosticCode;
    readonly message: string;
    readonly slotId: string | null;
    readonly bar: number | null;
};

/**
 * Top-level drain payload the runtime hands `Adapter.onEmissions(...)`.
 * Phase 1 ships `plots` / `drawings` / `alerts` / `diagnostics`; Phase 5
 * additively adds `alertConditions` + `logs` (per PLAN §7.3).
 *
 * @since 0.1
 * @stable
 * @example
 *     const e: RunnerEmissions = {
 *         plots: [],
 *         drawings: [],
 *         alerts: [],
 *         alertConditions: [],
 *         logs: [],
 *         diagnostics: [],
 *         fromBar: 0,
 *         toBar: 0,
 *     };
 */
export type RunnerEmissions = {
    readonly plots: ReadonlyArray<PlotEmission>;
    readonly drawings: ReadonlyArray<DrawingEmission>;
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly alertConditions: ReadonlyArray<AlertConditionEmission>;
    readonly logs: ReadonlyArray<LogEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
    readonly fromBar: number;
    readonly toBar: number;
};

/**
 * The host-side contract every chartlang adapter implements.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const a: Adapter;
 *     for await (const e of a.candles({ interval: "chart" })) {
 *         void e;
 *     }
 */
export type Adapter = {
    readonly id: string;
    readonly name: string;
    readonly capabilities: Capabilities;
    /**
     * Optional per-script input override resolver. Called by hosts at script
     * mount with the script id/name and merged over manifest defaults by the
     * runtime.
     *
     * @since 0.4
     * @stable
     * @example
     *     const resolveInputs: Adapter["resolveInputs"] = (scriptId) => ({
     *         length: scriptId === "demo" ? 20 : 14,
     *     });
     *     void resolveInputs;
     */
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    /**
     * Optional per-script plot-override resolver. Called by hosts at
     * mount with the script id/name; returns a `slotId → PlotOverride`
     * map the runtime applies to emissions. Presentation-only — never
     * affects `compute`. Hosts may also push live updates after mount
     * (see `ScriptHost.setPlotOverrides`).
     *
     * @since 0.8
     * @stable
     * @example
     *     const resolvePlotOverrides: Adapter["resolvePlotOverrides"] =
     *         () => ({ "ema.ts:12:5#0": { visible: false } });
     *     void resolvePlotOverrides;
     */
    readonly resolvePlotOverrides?: (scriptId: string) => Readonly<Record<string, PlotOverride>>;
    /**
     * Optional per-script external-series feed resolver. Called by hosts at
     * script mount with the script id/name. Returned keys are
     * `input.externalSeries(...)` descriptor names; missing expected keys and
     * invalid feed objects resolve to `NaN` series values in the runtime.
     * Live updates use `ScriptHost.setExternalSeries(...)`, which replaces
     * the whole feed map.
     *
     * @since 1.8
     * @stable
     * @example
     *     const feedExternalSeries: Adapter["feedExternalSeries"] =
     *         () => ({ earnings: { values: [1, 2, 3] } });
     *     void feedExternalSeries;
     */
    readonly feedExternalSeries?: (scriptId: string) => ExternalSeriesFeedMap;
    /**
     * Optional per-mount symbol metadata payload used to populate
     * `syminfo.*`. Fields are still gated by `capabilities.symInfoFields`.
     *
     * @since 0.4
     * @stable
     * @example
     *     const info: Adapter["symInfo"] = { ticker: "DEMO" };
     *     void info;
     */
    readonly symInfo?: AdapterSymInfo;
    candles(opts: { interval: string | "chart" }): AsyncIterable<CandleEvent>;
    onEmissions(emissions: RunnerEmissions): void;
    dispose(): void;
};
