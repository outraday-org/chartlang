// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fromGradient, hsl, rgb, withAlpha } from "./colorHelpers";
import { COLOR_PALETTE } from "./parseColor";

export { fromGradient, hsl, rgb, withAlpha } from "./colorHelpers";
export type { GradientStop } from "./colorHelpers";

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
