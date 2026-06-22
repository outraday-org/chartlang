// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AdapterSymInfo,
    type Capabilities,
    type DrawingKind,
    type InputKind,
    type PlotKind,
    capabilities,
} from "@invinite-org/chartlang-adapter-kit";

const CANVAS2D_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

const CANVAS2D_PLOT_KINDS: ReadonlyArray<PlotKind> = Object.freeze([
    "line",
    "step-line",
    "horizontal-line",
    "histogram",
    "area",
    "filled-band",
    "label",
    "marker",
    "shape",
    "character",
    "arrow",
    "candle-override",
    "bar-override",
    "bg-color",
    "bar-color",
    "horizontal-histogram",
]);

const CANVAS2D_DRAWING_KINDS: ReadonlySet<DrawingKind> = new Set([
    ...capabilities.allPhase3Drawings(),
    "table",
]);

/**
 * The capability bag the canvas2d reference adapter declares. Phase 2
 * widens `plots` to `capabilities.allPhase2Plots()`; Phase 3 widens
 * `drawings` to `capabilities.allPhase3Drawings()` so the conformance
 * suite covers every Phase-1 / Phase-2 plot kind AND every Phase-3
 * drawing kind end-to-end. Phase 4 adds canonical timeframe metadata,
 * full `syminfo.*` metadata coverage, and an unlimited sub-pane sentinel
 * while keeping inputs disabled. Phase 5 enables multi-timeframe
 * candles, alert conditions, and runtime logs. Per-bucket
 * `maxDrawingsPerScript` is sized so the `drawAll61`
 * smoke scenario (Task 19) fits without exhausting any bucket.
 *
 * Frozen so consumer-repo adapters that copy from this folder cannot
 * accidentally mutate the bag at runtime (mirrors `host-worker`'s frozen
 * `HostLimits`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { CANVAS2D_CAPABILITIES } from "chartlang-example-canvas2d-adapter";
 *     // CANVAS2D_CAPABILITIES.plots.has("line") === true
 *     // CANVAS2D_CAPABILITIES.plots.has("histogram") === true   // Phase 2
 *     // CANVAS2D_CAPABILITIES.drawings.has("fib-retracement") === true   // Phase 3
 *     const bag = CANVAS2D_CAPABILITIES;
 *     void bag;
 */
export const CANVAS2D_CAPABILITIES: Capabilities = Object.freeze({
    plots: new Set(CANVAS2D_PLOT_KINDS),
    drawings: CANVAS2D_DRAWING_KINDS,
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(CANVAS2D_INTERVALS),
    ...capabilities.multiTimeframe(true),
    ...capabilities.multiSymbol(true),
    ...capabilities.subPanes(Number.MAX_SAFE_INTEGER),
    ...capabilities.symInfoFields([
        "ticker",
        "type",
        "mintick",
        "currency",
        "basecurrency",
        "exchange",
        "timezone",
        "session",
        "meta",
    ]),
    ...capabilities.maxDrawingsPerScript({
        lines: 200,
        labels: 200,
        boxes: 100,
        polylines: 100,
        other: 100,
    }),
    ...capabilities.alertConditions(true),
    ...capabilities.logs(true),
});

/**
 * Demo symbol metadata exposed by the canvas2d reference adapter.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { CANVAS2D_SYM_INFO } from "chartlang-example-canvas2d-adapter";
 *     void CANVAS2D_SYM_INFO.ticker;
 */
export const CANVAS2D_SYM_INFO: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "canvas2d-reference",
    }),
});
