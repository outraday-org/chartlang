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

const WEBGL_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

const WEBGL_PLOT_KINDS: ReadonlyArray<PlotKind> = Object.freeze([
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

const WEBGL_DRAWING_KINDS: ReadonlySet<DrawingKind> = new Set([
    ...capabilities.allPhase3Drawings(),
    "table",
]);

/**
 * The capability bag the WebGL reference adapter declares. It targets FULL
 * parity with the canvas2d reference adapter — the same Phase-1/Phase-2 plot
 * inventory, all 63 drawing kinds (62 `allPhase3Drawings()` + `table`), alert
 * channels, canonical timeframe metadata, the unlimited sub-pane sentinel,
 * `syminfo.*` coverage, multi-timeframe / multi-symbol candles, alert
 * conditions, and runtime logs. Declaring the whole surface NOW (even though
 * the GPU renderer lands in later tasks) keeps the adapter interchangeable
 * with the other five and exercises the entire conformance surface — which
 * reads `capabilities` only.
 *
 * Frozen so consumer-repo adapters that copy from this folder cannot
 * accidentally mutate the bag at runtime (mirrors `host-worker`'s frozen
 * `HostLimits`).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { WEBGL_CAPABILITIES } from "chartlang-example-webgl-adapter";
 *     // WEBGL_CAPABILITIES.plots.has("line") === true
 *     // WEBGL_CAPABILITIES.drawings.has("fib-retracement") === true
 *     const bag = WEBGL_CAPABILITIES;
 *     void bag;
 */
export const WEBGL_CAPABILITIES: Capabilities = Object.freeze({
    plots: new Set(WEBGL_PLOT_KINDS),
    drawings: WEBGL_DRAWING_KINDS,
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(WEBGL_INTERVALS),
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
 * Demo symbol metadata exposed by the WebGL reference adapter.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { WEBGL_SYM_INFO } from "chartlang-example-webgl-adapter";
 *     void WEBGL_SYM_INFO.ticker;
 */
export const WEBGL_SYM_INFO: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "webgl-reference",
    }),
});
