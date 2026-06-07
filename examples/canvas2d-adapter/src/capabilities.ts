// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    capabilities,
    type Capabilities,
    type InputKind,
    type SymInfoField,
} from "@invinite-org/chartlang-adapter-kit";

/**
 * The capability bag the canvas2d reference adapter declares. Phase 2
 * widens `plots` to `capabilities.allPhase2Plots()`; Phase 3 widens
 * `drawings` to `capabilities.allPhase3Drawings()` so the conformance
 * suite covers every Phase-1 / Phase-2 plot kind AND every Phase-3
 * drawing kind end-to-end. Per-bucket `maxDrawingsPerScript` is sized
 * so the `drawAll61` smoke scenario (Task 19) fits without exhausting
 * any bucket. The adapter still only emits `alert` (`log` + `toast`
 * channels) and no inputs / sub-panes / multi-timeframe — those
 * surfaces land in Phases 4–5.
 *
 * Frozen so consumer-repo adapters that copy from this folder cannot
 * accidentally mutate the bag at runtime (mirrors `host-worker`'s frozen
 * `HostLimits`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { CANVAS2D_CAPABILITIES } from "chartlang-example-canvas2d-adapter";
 *     // CANVAS2D_CAPABILITIES.plots.has("line") === true
 *     // CANVAS2D_CAPABILITIES.plots.has("histogram") === true   // Phase 2
 *     // CANVAS2D_CAPABILITIES.drawings.has("fib-retracement") === true   // Phase 3
 *     const bag = CANVAS2D_CAPABILITIES;
 *     void bag;
 */
export const CANVAS2D_CAPABILITIES: Capabilities = Object.freeze({
    plots: capabilities.allPhase2Plots(),
    drawings: capabilities.allPhase3Drawings(),
    alerts: capabilities.alerts("log", "toast"),
    alertConditions: false,
    logs: false,
    inputs: new Set<InputKind>(),
    intervals: [
        { value: "1D", label: "1 day", group: "daily" },
        { value: "1h", label: "1 hour", group: "intraday" },
        { value: "5m", label: "5 minutes", group: "intraday" },
    ],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set<SymInfoField>(),
    maxDrawingsPerScript: { lines: 200, labels: 200, boxes: 100, polylines: 100, other: 100 },
    maxLookback: 1000,
    maxTickHz: 30,
});
