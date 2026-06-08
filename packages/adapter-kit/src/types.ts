// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertSeverity,
    Bar,
    DrawingCounts as CoreDrawingCounts,
    DrawingKind as CoreDrawingKind,
    InputKind as CoreInputKind,
    PlotKind as CorePlotKind,
    DrawingState,
    IntervalDescriptor,
    JsonValue,
    LineStyle,
    SymbolType,
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
 * Drawing kind discriminator. Phase 3 widens the Phase-1 `"line"`
 * placeholder to the full 61-entry kebab-case union — re-exported from
 * `@invinite-org/chartlang-core`. The wire format is kebab-case; the
 * camelCase TypeScript surface (`draw.horizontalLine`,
 * `draw.fibRetracement`, …) is pinned via core's
 * `KIND_CAMELCASE` / `KIND_KEBABCASE` bijection. Phase-1 / Phase-2
 * adapter code that wrote `drawingKind: "line"` keeps compiling — the
 * widening is purely additive.
 *
 * @since 0.1
 * @experimental
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
export type InputKind = CoreInputKind;

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
 * Adapter-supplied per-mount symbol metadata payload consumed by the
 * runtime's `syminfo.*` view builder.
 *
 * @since 0.4
 * @experimental
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
 * @experimental
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
    /**
     * Whether the adapter can route `defineAlertCondition` user-wired
     * alerts per PLAN §11.2.
     *
     * @since 0.4
     * @experimental
     * @example
     *     const enabled: Capabilities["alertConditions"] = false;
     *     void enabled;
     */
    readonly alertConditions: boolean;
    /**
     * Whether the adapter renders `runtime.log.*` messages per PLAN §11.3.
     *
     * @since 0.4
     * @experimental
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
     * @experimental
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
     * @experimental
     * @example
     *     const enabled: Capabilities["multiTimeframe"] = false;
     *     void enabled;
     */
    readonly multiTimeframe: boolean;
    /**
     * Max number of sub-panes the adapter can render for one script. Use
     * `Number.MAX_SAFE_INTEGER` as the unlimited sentinel per PLAN §7.2.
     *
     * @since 0.4
     * @experimental
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
     * @experimental
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
     * @experimental
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
 * A `draw.*` emission. Phase 3 narrows `state` from `unknown` to the
 * typed {@link DrawingState} discriminated union. `op: "create"`
 * carries the initial state; `op: "update"` carries the FULL merged
 * state per the §10.3 full-state semantic (not a patch); `op:
 * "remove"` carries the last-known state.
 *
 * @since 0.1
 * @experimental
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
    /**
     * Optional per-script input override resolver. Called by hosts at script
     * mount with the script id/name and merged over manifest defaults by the
     * runtime.
     *
     * @since 0.4
     * @experimental
     * @example
     *     const resolveInputs: Adapter["resolveInputs"] = (scriptId) => ({
     *         length: scriptId === "demo" ? 20 : 14,
     *     });
     *     void resolveInputs;
     */
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    /**
     * Optional per-mount symbol metadata payload used to populate
     * `syminfo.*`. Fields are still gated by `capabilities.symInfoFields`.
     *
     * @since 0.4
     * @experimental
     * @example
     *     const info: Adapter["symInfo"] = { ticker: "DEMO" };
     *     void info;
     */
    readonly symInfo?: AdapterSymInfo;
    candles(opts: { interval: string | "chart" }): AsyncIterable<CandleEvent>;
    onEmissions(emissions: RunnerEmissions): void;
    dispose(): void;
};
