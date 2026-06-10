// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fromGradient, hsl, rgb, withAlpha } from "./colorHelpers.js";
import { COLOR_PALETTE } from "./parseColor.js";

export { fromGradient, hsl, rgb, withAlpha } from "./colorHelpers.js";
export type { GradientStop } from "./colorHelpers.js";

/**
 * Pine-style color namespace. Includes the named palette plus dynamic
 * helpers for compute-time colors.
 *
 * @since 0.5
 * @stable
 * @example
 *     const c = color.withAlpha(color.red, 0.5);
 *     void c;
 */
export const color = Object.freeze({
    ...COLOR_PALETTE,
    fromGradient,
    withAlpha,
    rgb,
    hsl,
});
