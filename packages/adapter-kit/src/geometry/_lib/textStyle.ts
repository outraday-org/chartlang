// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `TextOpts` → text-state derivation ported from
//   invinite/src/components/trading-chart/tools/text-tool.ts,
//   invinite/src/components/trading-chart/tools/marker-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang.

import type { TextOpts } from "@invinite-org/chartlang-core";

const DEFAULT_COLOR = "#000000";

/**
 * Pixel size each named {@link TextOpts.size} keyword maps to.
 * `"normal"` (12 px) is the default when `size` is omitted.
 *
 * @since 1.3
 * @stable
 * @example
 *     const px = SIZE_TO_PX.normal; // 12
 *     void px;
 */
export const SIZE_TO_PX: Readonly<Record<NonNullable<TextOpts["size"]>, number>> = {
    tiny: 8,
    small: 10,
    normal: 12,
    large: 16,
    huge: 20,
};

/**
 * Map each {@link TextOpts.halign} keyword to the IR `text` primitive's
 * `align` value.
 *
 * @since 1.3
 * @stable
 * @example
 *     const a = HALIGN_TO_TEXTALIGN.center; // "center"
 *     void a;
 */
export const HALIGN_TO_TEXTALIGN: Readonly<
    Record<NonNullable<TextOpts["halign"]>, "left" | "center" | "right">
> = {
    left: "left",
    center: "center",
    right: "right",
};

/**
 * Map each {@link TextOpts.valign} keyword to the IR `text` primitive's
 * `baseline` value.
 *
 * @since 1.3
 * @stable
 * @example
 *     const b = VALIGN_TO_TEXTBASELINE.middle; // "middle"
 *     void b;
 */
export const VALIGN_TO_TEXTBASELINE: Readonly<
    Record<NonNullable<TextOpts["valign"]>, "top" | "middle" | "bottom">
> = {
    top: "top",
    middle: "middle",
    bottom: "bottom",
};

/**
 * Concrete text-state derived from {@link TextOpts}, mapped directly
 * onto the IR `text` primitive's `font` / `align` / `baseline` /
 * `color` fields.
 *
 * @since 1.3
 * @stable
 * @example
 *     const s: ResolvedTextOpts = {
 *         font: "12px sans-serif",
 *         align: "center",
 *         baseline: "middle",
 *         color: "#000000",
 *     };
 *     void s;
 */
export type ResolvedTextOpts = {
    readonly font: string;
    readonly align: "left" | "center" | "right";
    readonly baseline: "top" | "middle" | "bottom";
    readonly color: string;
};

/**
 * Resolve a {@link TextOpts} bag into the four IR text-state values.
 * Missing fields fall back to `"normal"` size (12 px), `"center"`
 * halign, `"middle"` valign, and `"#000000"` color. Pure — no `ctx`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const r = resolveTextOpts({ size: "large", color: "#10b981" });
 *     // r.font === "16px sans-serif"
 *     void r;
 */
export function resolveTextOpts(opts: TextOpts): ResolvedTextOpts {
    const sizePx = SIZE_TO_PX[opts.size ?? "normal"];
    return {
        font: `${sizePx}px sans-serif`,
        align: HALIGN_TO_TEXTALIGN[opts.halign ?? "center"],
        baseline: VALIGN_TO_TEXTBASELINE[opts.valign ?? "middle"],
        color: opts.color ?? DEFAULT_COLOR,
    };
}
