// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AdapterSymInfo,
    type Capabilities,
    type DrawingKind,
    type InputKind,
    capabilities,
} from "@invinite-org/chartlang-adapter-kit";

const KONVA_INTERVALS = [
    { value: "15s", label: "15 seconds", group: "second" },
    { value: "30s", label: "30 seconds", group: "second" },
    { value: "1m", label: "1 minute", group: "minute" },
    { value: "5m", label: "5 minutes", group: "minute" },
    { value: "15m", label: "15 minutes", group: "minute" },
    { value: "1h", label: "1 hour", group: "hour" },
    { value: "1D", label: "1 day", group: "daily" },
    { value: "1W", label: "1 week", group: "weekly" },
] as const;

// All 63 drawing kinds (62 Phase-3 kinds + `table`). Konva builds every
// drawing as a scene-graph node (via `decomposeDrawing` + `primitiveToNode`),
// so the full set is declared — exactly like the canvas2d reference adapter —
// to keep the adapters interchangeable and exercise the whole conformance
// surface.
const KONVA_DRAWING_KINDS: ReadonlySet<DrawingKind> = capabilities.union(
    capabilities.allPhase3Drawings(),
    capabilities.drawTable(),
);

/**
 * The capability bag the Konva example adapter declares. Konva is a
 * generic 2D scene-graph with no chart facilities, so the adapter hand-
 * builds every plot kind, candle, horizontal line, and drawing from Konva
 * nodes — there is nothing it cannot express, so it declares the full
 * surface: every Phase-5 plot kind, all 63 drawing
 * kinds, alert channels, multi-timeframe candles, unlimited sub-panes,
 * full `syminfo.*` metadata, alert conditions, and runtime logs.
 *
 * Mirrors `CANVAS2D_CAPABILITIES` so the two example adapters stay
 * interchangeable under the conformance suite. Frozen so consumer-repo
 * adapters that copy from this folder cannot accidentally mutate the bag
 * at runtime.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { KONVA_CAPABILITIES } from "chartlang-example-konva-adapter";
 *     // KONVA_CAPABILITIES.plots.has("line") === true
 *     // KONVA_CAPABILITIES.drawings.has("fib-retracement") === true
 *     const bag = KONVA_CAPABILITIES;
 *     void bag;
 */
export const KONVA_CAPABILITIES: Capabilities = Object.freeze({
    plots: new Set(capabilities.allPhase5Plots()),
    drawings: KONVA_DRAWING_KINDS,
    alerts: capabilities.alerts("log", "toast"),
    inputs: new Set<InputKind>(),
    maxLookback: 1000,
    maxTickHz: 30,
    ...capabilities.intervals(KONVA_INTERVALS),
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
 * Demo symbol metadata exposed by the Konva example adapter.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { KONVA_SYM_INFO } from "chartlang-example-konva-adapter";
 *     void KONVA_SYM_INFO.ticker;
 */
export const KONVA_SYM_INFO: AdapterSymInfo = Object.freeze({
    ticker: "DEMO",
    type: "equity",
    mintick: 0.01,
    currency: "USD",
    basecurrency: "USD",
    exchange: "CHARTLANG",
    timezone: "Etc/UTC",
    session: "regular",
    meta: Object.freeze({
        vendor: "konva-example",
    }),
});
