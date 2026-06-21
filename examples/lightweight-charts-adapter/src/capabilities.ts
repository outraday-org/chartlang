// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AdapterSymInfo,
    type Capabilities,
    type DrawingKind,
    type InputKind,
    capabilities,
} from "@invinite-org/chartlang-adapter-kit";

const LWC_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

/**
 * The capability bag the lightweight-charts adapter declares. The full
 * surface is assembled from the adapter-kit `capabilities` builders +
 * `union` — never hand-built `Set`s for the umbrella inventories — so the
 * conformance suite covers every Phase-5 plot kind and every Phase-3
 * drawing kind (plus `table`) end-to-end. Task 5 wires the native series /
 * candle / pane paths; Task 6 wires drawings, so the declared drawing set
 * is wider than what this task renders — the capability surface is the
 * contract, not the current render coverage.
 *
 * Frozen so consumer-repo adapters that copy from this folder cannot
 * accidentally mutate the bag at runtime.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { LWC_CAPABILITIES } from "chartlang-example-lightweight-charts-adapter";
 *     // LWC_CAPABILITIES.plots.has("area") === true
 *     // LWC_CAPABILITIES.drawings.has("fib-retracement") === true
 *     const bag = LWC_CAPABILITIES;
 *     void bag;
 */
export const LWC_CAPABILITIES: Capabilities = Object.freeze({
    plots: capabilities.allPhase5Plots(),
    drawings: capabilities.union<DrawingKind>(
        capabilities.allPhase3Drawings(),
        new Set<DrawingKind>(["table"]),
    ),
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(LWC_INTERVALS),
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
 * Demo symbol metadata exposed by the lightweight-charts adapter.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { LWC_SYM_INFO } from "chartlang-example-lightweight-charts-adapter";
 *     void LWC_SYM_INFO.ticker;
 */
export const LWC_SYM_INFO: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "lightweight-charts-reference",
    }),
});
