// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    capabilities,
    type Capabilities,
    type DrawingKind,
    type InputKind,
    type SymInfoField,
} from "@invinite-org/chartlang-adapter-kit";

/**
 * The capability bag the canvas2d reference adapter declares. Covers the
 * exact set of Phase-1 stateful primitives the runtime emits — `plot`
 * (`line`), `hline` (`horizontal-line`), and `alert` (`log` + `toast`
 * channels). Drawings, alert conditions, inputs, sub-panes, and
 * multi-timeframe are all empty: those surfaces land in Phases 3–5.
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
 *     const bag = CANVAS2D_CAPABILITIES;
 *     void bag;
 */
export const CANVAS2D_CAPABILITIES: Capabilities = Object.freeze({
    plots: capabilities.union(capabilities.line(), capabilities.horizontalLine()),
    drawings: new Set<DrawingKind>(),
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
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
});
