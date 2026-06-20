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

const ECHARTS_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

// Mirrors `CANVAS2D_PLOT_KINDS` — the full Phase-5 plot inventory the
// `setOption` mapping in `createEChartsAdapter` routes to native ECharts
// series / itemStyle / backgroundColor facilities. Built from the
// adapter-kit `allPhase5Plots()` union so the two adapters stay in lockstep.
const ECHARTS_PLOT_KINDS: ReadonlySet<PlotKind> = capabilities.allPhase5Plots();

// Mirrors `CANVAS2D_DRAWING_KINDS` — the full 63-kind drawing set (the 62
// `allPhase3Drawings()` kinds + `table`). Declared in full now even though
// the `graphic`-path drawing renderer lands in Task 10; declaring the whole
// set keeps the adapter interchangeable with canvas2d and exercises the
// entire conformance surface.
const ECHARTS_DRAWING_KINDS: ReadonlySet<DrawingKind> = capabilities.union(
    capabilities.allPhase3Drawings(),
    capabilities.drawTable(),
);

/**
 * The capability bag the ECharts example adapter declares. Identical in
 * surface to {@link import("chartlang-example-canvas2d-adapter").CANVAS2D_CAPABILITIES}:
 * the full Phase-5 plot inventory, every drawing kind (62 `allPhase3Drawings()`
 * kinds + `table`), `log` / `toast` alert channels, no inputs, canonical
 * timeframe metadata, full `syminfo.*` coverage, an unlimited sub-pane
 * sentinel (each pane maps to one ECharts `grid`), multi-timeframe candles,
 * alert conditions, and runtime logs.
 *
 * Frozen so consumer-repo adapters that copy from this folder cannot
 * accidentally mutate the bag at runtime.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { ECHARTS_CAPABILITIES } from "chartlang-example-echarts-adapter";
 *     // ECHARTS_CAPABILITIES.plots.has("line") === true
 *     // ECHARTS_CAPABILITIES.plots.has("candle-override") === true
 *     // ECHARTS_CAPABILITIES.drawings.has("fib-retracement") === true
 *     const bag = ECHARTS_CAPABILITIES;
 *     void bag;
 */
export const ECHARTS_CAPABILITIES: Capabilities = Object.freeze({
    plots: new Set(ECHARTS_PLOT_KINDS),
    drawings: ECHARTS_DRAWING_KINDS,
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(ECHARTS_INTERVALS),
    ...capabilities.multiTimeframe(true),
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
 * Demo symbol metadata exposed by the ECharts example adapter.
 *
 * @since 1.5
 * @experimental
 * @example
 *     import { ECHARTS_SYM_INFO } from "chartlang-example-echarts-adapter";
 *     void ECHARTS_SYM_INFO.ticker;
 */
export const ECHARTS_SYM_INFO: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "echarts-example",
    }),
});
