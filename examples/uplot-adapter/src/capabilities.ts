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

const UPLOT_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

// Full plot inventory — the canonical Phase-5 set, identical to the
// canvas2d reference adapter so the conformance suite covers the same
// surface. Built from the adapter-kit `allPhase5Plots()` builder rather
// than a hand-maintained literal so a future kind lands here for free.
const UPLOT_PLOT_KINDS: ReadonlySet<PlotKind> = capabilities.allPhase5Plots();

// `allPhase3Drawings()` is the 62-kind user-facing drawing union; `table`
// is the 63rd. Composed via the `union` combinator so neither set is
// duplicated.
const UPLOT_DRAWING_KINDS: ReadonlySet<DrawingKind> = capabilities.union(
    capabilities.allPhase3Drawings(),
    new Set<DrawingKind>(["table"]),
);

/**
 * The capability bag the uPlot example adapter declares. Matches the
 * canvas2d reference adapter's full surface — every Phase-5 plot kind,
 * all 63 drawing kinds, `log` / `toast` alerts, canonical timeframe
 * metadata, full `syminfo.*` coverage, an unlimited sub-pane sentinel,
 * multi-timeframe candles, alert conditions, and runtime logs — so the
 * two adapters are interchangeable under conformance.
 *
 * Frozen so consumer-repo adapters that copy from this folder cannot
 * accidentally mutate the bag at runtime.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { UPLOT_CAPABILITIES } from "chartlang-example-uplot-adapter";
 *     // UPLOT_CAPABILITIES.plots.has("line") === true
 *     // UPLOT_CAPABILITIES.drawings.has("fib-retracement") === true
 *     const bag = UPLOT_CAPABILITIES;
 *     void bag;
 */
export const UPLOT_CAPABILITIES: Capabilities = Object.freeze({
    plots: new Set(UPLOT_PLOT_KINDS),
    drawings: UPLOT_DRAWING_KINDS,
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(UPLOT_INTERVALS),
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
 * Demo symbol metadata exposed by the uPlot example adapter.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { UPLOT_SYM_INFO } from "chartlang-example-uplot-adapter";
 *     void UPLOT_SYM_INFO.ticker;
 */
export const UPLOT_SYM_INFO: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "uplot-example",
    }),
});
