// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// `TextOpts` → canvas text-state derivation ported from
//   invinite/src/components/trading-chart/tools/text-tool.ts,
//   invinite/src/components/trading-chart/tools/marker-tool.ts,
//   commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// Re-licensed MIT for chartlang. See PLAN.md §3.1 + §22.10.

import type { TextOpts } from "@invinite-org/chartlang-core";

const DEFAULT_COLOR = "#000000";

/**
 * Pixel size each named {@link TextOpts.size} keyword maps to.
 * `"normal"` (12 px) is the default when `size` is omitted.
 *
 * @since 0.3
 * @experimental
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
 * Map each {@link TextOpts.halign} keyword to its canvas `textAlign`
 * value.
 *
 * @since 0.3
 * @experimental
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
 * Map each {@link TextOpts.valign} keyword to its canvas `textBaseline`
 * value.
 *
 * @since 0.3
 * @experimental
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
 * Concrete canvas text-state derived from {@link TextOpts}. Renderers
 * apply these four values directly to `ctx` before calling `fillText`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     const s: ResolvedTextOpts = {
 *         font: "12px sans-serif",
 *         textAlign: "center",
 *         textBaseline: "middle",
 *         fillStyle: "#000000",
 *     };
 *     void s;
 */
export type ResolvedTextOpts = {
    readonly font: string;
    readonly textAlign: "left" | "center" | "right";
    readonly textBaseline: "top" | "middle" | "bottom";
    readonly fillStyle: string;
};

/**
 * Resolve a {@link TextOpts} bag into the four canvas text-state
 * values. Missing fields fall back to `"normal"` size (12 px),
 * `"center"` halign, `"middle"` valign, and `"#000000"` color. Mirrors
 * marker's Task-7 fallback policy.
 *
 * @since 0.3
 * @experimental
 * @example
 *     const r = resolveTextOpts({ size: "large", color: "#10b981" });
 *     // r.font === "16px sans-serif"
 *     void r;
 */
export function resolveTextOpts(opts: TextOpts): ResolvedTextOpts {
    const sizePx = SIZE_TO_PX[opts.size ?? "normal"];
    return {
        font: `${sizePx}px sans-serif`,
        textAlign: HALIGN_TO_TEXTALIGN[opts.halign ?? "center"],
        textBaseline: VALIGN_TO_TEXTBASELINE[opts.valign ?? "middle"],
        fillStyle: opts.color ?? DEFAULT_COLOR,
    };
}
