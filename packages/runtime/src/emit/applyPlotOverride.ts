// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission, PlotOverride } from "@invinite-org/chartlang-adapter-kit";

function isLineFamily(
    kind: PlotEmission["style"]["kind"],
): kind is "line" | "step-line" | "horizontal-line" | "area" {
    return kind === "line" || kind === "step-line" || kind === "horizontal-line" || kind === "area";
}

/**
 * Apply a `PlotOverride` to a built `PlotEmission`. Pure / immutable —
 * returns the input unchanged when `override` is `undefined`, sets
 * `visible: false` only when `override.visible === false`, overwrites
 * `color`, and merges `lineWidth` / `lineStyle` into `style` only
 * when the emission's `style.kind` is line-family
 * (`line | step-line | horizontal-line | area`). Non-line kinds
 * ignore width/style silently (no diagnostic). `visible` is only ever
 * written as `false` (never `true`), so no-override and visible-override
 * emissions stay byte-identical to today.
 *
 * @since 0.8
 * @stable
 * @example
 *     const emission: PlotEmission = {
 *         kind: "plot", slotId: "s", title: "", style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
 *         bar: 0, time: 0, value: 1, color: null, meta: {}, pane: "overlay",
 *     };
 *     const next = applyPlotOverride(emission, { color: "#f00" });
 *     void next;
 */
export function applyPlotOverride(
    emission: PlotEmission,
    override: PlotOverride | undefined,
): PlotEmission {
    if (override === undefined) return emission;
    let next = emission;
    if (override.visible === false) next = { ...next, visible: false };
    if (override.color !== undefined) next = { ...next, color: override.color };
    if (
        (override.lineWidth !== undefined || override.lineStyle !== undefined) &&
        isLineFamily(next.style.kind)
    ) {
        next = {
            ...next,
            style: {
                ...next.style,
                ...(override.lineWidth !== undefined ? { lineWidth: override.lineWidth } : {}),
                ...(override.lineStyle !== undefined ? { lineStyle: override.lineStyle } : {}),
            },
        };
    }
    return next;
}
