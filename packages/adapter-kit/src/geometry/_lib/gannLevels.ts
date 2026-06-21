// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Gann box subdivision + fan-slope tables moved verbatim from the
// canvas2d adapter's renderer helper
//   examples/canvas2d-adapter/src/render/draw/gannLevels.ts.
// The originating subdivision + slope conventions are invinite's
// gann-box / gann-fan tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

/**
 * Canonical Gann box subdivision ratios. Each box decomposer emits one
 * horizontal + one vertical stroke at each ratio (including 0 and 1.0
 * for the outer rectangle). The 1/4 subdivisions match the upstream
 * invinite default and are the pinned Phase-3 wire shape.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { GANN_LEVELS } from "./gannLevels.js";
 *     for (const level of GANN_LEVELS) void level;
 */
export const GANN_LEVELS: ReadonlyArray<number> = Object.freeze([0, 0.25, 0.5, 0.75, 1]);

/**
 * Canonical Gann fan slope ratios. Each entry is the slope multiplier
 * applied to the (a→b) direction vector — the 1×1 ray points at b, 1×2
 * doubles the slope, 2×1 halves it, etc. The 9-entry tuple matches the
 * upstream invinite default `FibGannLevel` set.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { GANN_FAN_RATIOS } from "./gannLevels.js";
 *     for (const r of GANN_FAN_RATIOS) void r;
 */
export const GANN_FAN_RATIOS: ReadonlyArray<number> = Object.freeze([
    1,
    2,
    3,
    0.5,
    1 / 3,
    4,
    0.25,
    8,
    0.125,
]);

/**
 * Human-readable label for each {@link GANN_FAN_RATIOS} entry. Order
 * matches the ratios array so a decomposer can co-index them. Ratios
 * greater than 1 render as `"1x<n>"`; ratios less than 1 render as
 * `"<n>x1"`; 1×1 is the identity.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { GANN_FAN_LABELS } from "./gannLevels.js";
 *     for (const label of GANN_FAN_LABELS) void label;
 */
export const GANN_FAN_LABELS: ReadonlyArray<string> = Object.freeze([
    "1x1",
    "1x2",
    "1x3",
    "2x1",
    "3x1",
    "1x4",
    "4x1",
    "1x8",
    "8x1",
]);

/**
 * Map a fan ratio to its kebab label. Ratios `>= 1` render as
 * `"1x<n>"`; ratios `< 1` render as `"<n>x1"` where `n = round(1 /
 * ratio)`. Used when fan labels are enabled.
 *
 * @since 1.3
 * @stable
 * @example
 *     import { formatGannRatio } from "./gannLevels.js";
 *     formatGannRatio(1); // "1x1"
 *     formatGannRatio(2); // "1x2"
 *     formatGannRatio(0.5); // "2x1"
 */
export function formatGannRatio(ratio: number): string {
    if (ratio >= 1) return `1x${Math.round(ratio)}`;
    return `${Math.round(1 / ratio)}x1`;
}
