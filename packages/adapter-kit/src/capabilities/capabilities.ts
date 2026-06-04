// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertChannel, PlotKind } from "../types";

/**
 * Helpers that assemble the `ReadonlySet` pieces of a `Capabilities`
 * bag. Phase 1 ships the three line variants + an alert-channel builder
 * + a generic `union` combinator; Phase 2+ extends additively
 * (`histogram`, `area`, `filledBand`, …).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { capabilities } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const plots = capabilities.allLines();
 *     const alerts = capabilities.alerts("toast", "log");
 *     const merged = capabilities.union(plots, capabilities.horizontalLine());
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
