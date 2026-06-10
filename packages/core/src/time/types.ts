// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Supported market-session boundary families.
 *
 * @since 0.6
 * @stable
 * @example
 *     const type: SessionType = "regular";
 *     void type;
 */
export type SessionType = "regular" | "extended";

/**
 * Day-of-week index where Sunday is 0 and Saturday is 6.
 *
 * @since 0.6
 * @stable
 * @example
 *     const day: Weekday = 1;
 *     void day;
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Half-open UTC millisecond session bounds.
 *
 * @since 0.6
 * @stable
 * @example
 *     const bounds: SessionBounds = { startMs: 0, endMs: 1 };
 *     void bounds;
 */
export type SessionBounds = {
    readonly startMs: number;
    readonly endMs: number;
};
