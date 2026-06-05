// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertChannel, PlotKind } from "../types";

/**
 * Helpers that assemble the `ReadonlySet` pieces of a `Capabilities`
 * bag. Phase 1 shipped the three line variants + an alert-channel
 * builder + a generic `union` combinator. Phase 2 adds one builder per
 * new `PlotKind` (`histogram`, `bars`, `area`, `filledBand`, `label`,
 * `marker`) plus `allPhase2Plots()` — the union of every Phase-1 +
 * Phase-2 kind.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const plots = capabilities.allPhase2Plots();
 *     const alerts = capabilities.alerts("toast", "log");
 *     const merged = capabilities.union(plots, capabilities.label());
 *     void merged;
 */
export const capabilities = {
    line(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["line"]);
    },
    stepLine(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["step-line"]);
    },
    horizontalLine(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["horizontal-line"]);
    },
    allLines(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["line", "step-line", "horizontal-line"]);
    },
    /** Phase-2 histogram plot kind. @since 0.2 @experimental */
    histogram(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["histogram"]);
    },
    /** Phase-2 narrow-bars plot kind. @since 0.2 @experimental */
    bars(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["bars"]);
    },
    /** Phase-2 filled-area plot kind. @since 0.2 @experimental */
    area(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["area"]);
    },
    /** Phase-2 filled-band (between two polylines) plot kind.
     *  @since 0.2 @experimental */
    filledBand(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["filled-band"]);
    },
    /** Phase-2 text-label plot kind. @since 0.2 @experimental */
    label(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["label"]);
    },
    /** Phase-2 discrete-marker plot kind. @since 0.2 @experimental */
    marker(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>(["marker"]);
    },
    /** Union of every plot kind that ships through Phase 2 — `line`,
     *  `step-line`, `horizontal-line`, `histogram`, `bars`, `area`,
     *  `filled-band`, `label`, `marker`. Phase-5 kinds are deliberately
     *  excluded; the bundled `capabilities.union(...)` combinator
     *  composes additional sets when needed.
     *  @since 0.2 @experimental */
    allPhase2Plots(): ReadonlySet<PlotKind> {
        return new Set<PlotKind>([
            "line",
            "step-line",
            "horizontal-line",
            "histogram",
            "bars",
            "area",
            "filled-band",
            "label",
            "marker",
        ]);
    },
    alerts(...channels: ReadonlyArray<AlertChannel>): ReadonlySet<AlertChannel> {
        return new Set<AlertChannel>(channels);
    },
    union<T>(...sets: ReadonlyArray<ReadonlySet<T>>): ReadonlySet<T> {
        const out = new Set<T>();
        for (const s of sets) {
            for (const v of s) {
                out.add(v);
            }
        }
        return out;
    },
};
