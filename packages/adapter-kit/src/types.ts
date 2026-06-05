// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertSeverity,
    Bar,
    IntervalDescriptor,
    JsonValue,
    LineStyle,
    PlotKind as CorePlotKind,
} from "@invinite-org/chartlang-core";

/**
 * Adapter-supplied candle event the runtime consumes through
 * `Adapter.candles(...)`. `history` is a batched warm-up payload; `close`
 * carries a finalised bar; `tick` carries an intra-bar update that the
 * runtime applies to the current bar's head slot.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const evt: CandleEvent = { kind: "history", bars: [] };
 */
export type CandleEvent =
    | { readonly kind: "history"; readonly bars: ReadonlyArray<Bar> }
    | { readonly kind: "close"; readonly bar: Bar }
    | { readonly kind: "tick"; readonly bar: Bar };

/**
 * Indicator plot styles Phase 1 ships. Re-exported from
 * `@invinite-org/chartlang-core` so the script-facing and adapter-facing
 * surfaces stay in lock-step — the full PLAN §7.2 set lands in Phase 2+,
 * additively, in the core declaration.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const k: PlotKind = "line";
 */
export type PlotKind = CorePlotKind;

/**
 * Drawing kind discriminator. Phase 1 ships only a placeholder; the full
 * 61-entry union from PLAN §7.2 lands with `draw.*` in Phase 3.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const k: DrawingKind = "line";
 */
export type DrawingKind = "line";

/**
 * Channels an alert emission can be dispatched on. Adapters declare the
 * subset they support via `Capabilities.alerts`; emissions to unsupported
 * channels drop with `unsupported-alert-channel`.
 *
 * @since 0.1
 * @experimental
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
 * @experimental
 * @example
 *     const k: InputKind = "int";
 */
export type InputKind =
    | "int"
    | "float"
    | "bool"
    | "string"
    | "enum"
    | "color"
    | "source"
    | "time"
    | "price"
    | "symbol"
    | "interval"
    | "external-series";

/**
 * `syminfo.*` fields the adapter populates. Phase-1 scripts don't read
 * symbol metadata; the type is here so consumer-repo adapters can pin
 * against a stable shape now.
 *
 * @since 0.1
 * @experimental
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
 * Per-script drawing-emission budget. Excess `draw.*` calls fall back to
 * no-op + `drawing-budget-exceeded`. Mirrors Pine's `max_*_count` family.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const c: DrawingCounts = {
 *         lines: 50, labels: 50, boxes: 50, polylines: 50, other: 50,
 *     };
 */
export type DrawingCounts = {
    readonly lines: number;
    readonly labels: number;
    readonly boxes: number;
    readonly polylines: number;
    readonly other: number;
};

/**
 * Capability bag an adapter declares. The runtime, host-worker, and
 * editor all gate emissions through this shape. Primitives outside the
 * declared set become silent no-ops + diagnostic (PLAN §7.4).
 *
 * Phase 1 omits `feedExternalSeries`-related `inputs` entries from any
 * declared subset; Phase 4 wires the surface.
 *
 * @since 0.1
 * @experimental
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
    readonly alertConditions: boolean;
    readonly logs: boolean;
    readonly inputs: ReadonlySet<InputKind>;
    readonly intervals: ReadonlyArray<IntervalDescriptor>;
    readonly multiTimeframe: boolean;
    readonly subPanes: number;
    readonly symInfoFields: ReadonlySet<SymInfoField>;
    readonly maxDrawingsPerScript: DrawingCounts;
    readonly maxLookback: number;
    readonly maxTickHz: number;
};

/**
 * Plot style discriminated union. Phase 1 shipped `line` / `step-line` /
 * `horizontal-line`; Phase 2 adds `histogram` / `bars` / `area` /
 * `filled-band` / `label` / `marker` per PLAN §7.3. Phase 5 will extend
 * further (`shape`, `character`, `arrow`, `vertical-line`,
 * `bar-override`, …). Every expansion is additive — `apiVersion: 1`
 * scripts stay valid.
 *
 * @since 0.1
 * @experimental
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
          readonly kind: "histogram" | "bars";
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
      };

/**
 * A `plot()` / `hline()` emission the runtime sends to the adapter.
 * Numeric `value: null` is the wire-level "skip this bar" — NaN/Infinity
 * are forbidden in `value` and anywhere in `meta` (PLAN §7.3 universal
 * payload rules).
 *
 * @since 0.1
 * @experimental
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
};

/**
 * An `alert()` emission. `dedupeKey` is computed by the runtime
 * (`slotId + bar + hash(message + meta)`) and adapters that dispatch
 * via async channels MUST use it for idempotency.
 *
 * @since 0.1
 * @experimental
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
 * A `draw.*` emission. Phase-1 ships no `draw.*` primitives; the shape
 * is pinned so the runtime + host-worker boundary stays additive when
 * Phase 3 lands real drawings.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const e: DrawingEmission = {
 *         kind: "drawing",
 *         handleId: "ph3.ts:1:1#0",
 *         drawingKind: "line",
 *         op: "create",
 *         state: null,
 *         bar: 0,
 *         time: 0,
 *     };
 */
export type DrawingEmission = {
    readonly kind: "drawing";
    readonly handleId: string;
    readonly drawingKind: DrawingKind;
    readonly op: "create" | "update" | "remove";
    readonly state: unknown;
    readonly bar: number;
    readonly time: number;
};

/**
 * Stable machine-readable diagnostic code emitted by the runtime / host
 * when an emission is dropped, an input fails coercion, or a budget is
 * exceeded. Pinned set — additive only across `apiVersion: 1.x`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const code: DiagnosticCode = "unsupported-plot-kind";
 */
export type DiagnosticCode =
    | "unsupported-plot-kind"
    | "unsupported-drawing-kind"
    | "unsupported-alert-channel"
    | "unsupported-pane"
    | "unsupported-interval"
    | "multi-timeframe-not-supported"
    | "lookback-exceeded"
    | "drawing-budget-exceeded"
    | "dropped-by-policy"
    | "input-coercion-failed"
    | "alert-rate-limited"
    | "runtime-cpu-budget-exceeded"
    | "runtime-memory-budget-exceeded"
    | "malformed-emission";

/**
 * A non-rendered diagnostic the runtime / host surfaces to the editor +
 * error reporters. Never user-visible on its own.
 *
 * @since 0.1
 * @experimental
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
 * @experimental
 * @example
 *     const e: RunnerEmissions = {
 *         plots: [],
 *         drawings: [],
 *         alerts: [],
 *         diagnostics: [],
 *         fromBar: 0,
 *         toBar: 0,
 *     };
 */
export type RunnerEmissions = {
    readonly plots: ReadonlyArray<PlotEmission>;
    readonly drawings: ReadonlyArray<DrawingEmission>;
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
    readonly fromBar: number;
    readonly toBar: number;
};

/**
 * The host-side contract every chartlang adapter implements. Phase 1
 * omits PLAN §7.1's optional `feedExternalSeries?` — that surface
 * arrives in Phase 4 alongside `input.external-series`. The shape is
 * additive, so consumer-repo adapters won't need a breaking change to
 * opt in later.
 *
 * @since 0.1
 * @experimental
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
    candles(opts: { interval: string | "chart" }): AsyncIterable<CandleEvent>;
    onEmissions(emissions: RunnerEmissions): void;
    dispose(): void;
};
