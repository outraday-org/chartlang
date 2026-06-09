// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color } from "../types";
import { parseColor } from "./parseColor";

/**
 * Gradient color stop for `color.fromGradient`.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const stop: GradientStop = { at: 0, color: "#0000ff" };
 *     void stop;
 */
export type GradientStop = Readonly<{ at: number; color: Color }>;

const TRANSPARENT_BLACK = "rgba(0, 0, 0, 0)";

function clampUnit(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function clampByte(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(255, Math.max(0, Math.floor(value)));
}

function clampHue(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(359.999, Math.max(0, value));
}

function clampPercent(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(100, Math.max(0, value));
}

function formatNumber(value: number): string {
    const rounded = Math.round(value * 1000) / 1000;
    return String(rounded);
}

function emitRgb(r: number, g: number, b: number, alpha: number): Color {
    if (alpha >= 1) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${formatNumber(alpha)})`;
}

function emitRgba(r: number, g: number, b: number, alpha: number): Color {
    return `rgba(${r}, ${g}, ${b}, ${formatNumber(alpha)})`;
}

/**
 * Dynamic color from a normalised position. `t` is clamped to `[0, 1]`;
 * out-of-range maps to the boundary stop. Stops must be pre-sorted by `at`
 * ascending. Empty stops return transparent black.
 *
 * Pine's `color.from_gradient`.
 *
 * @since 0.5
 * @experimental
 * @example
 *     // const blue = "#0000ff";
 *     // const red = "#ff0000";
 *     // color.fromGradient(0.5, [{ at: 0, color: blue }, { at: 1, color: red }]);
 */
export function fromGradient(t: number, stops: ReadonlyArray<GradientStop>): Color {
    const first = stops[0];
    if (first === undefined) return TRANSPARENT_BLACK;
    if (stops.length === 1 || Number.isNaN(t)) return first.color;

    const position = clampUnit(t);
    if (position <= first.at) return first.color;
    const last = stops[stops.length - 1];
    if (position >= last.at) return last.color;

    let previous = first;
    let next = last;
    for (let i = 1; i < stops.length; i += 1) {
        const candidate = stops[i];
        if (position <= candidate.at) {
            next = candidate;
            break;
        }
        previous = candidate;
    }

    const left = parseColor(previous.color);
    const right = parseColor(next.color);
    if (left === null || right === null) return previous.color;
    const ratio = (position - previous.at) / (next.at - previous.at);
    const alpha = left.a + (right.a - left.a) * ratio;
    return emitRgb(
        clampByte(left.r + (right.r - left.r) * ratio),
        clampByte(left.g + (right.g - left.g) * ratio),
        clampByte(left.b + (right.b - left.b) * ratio),
        clampUnit(alpha),
    );
}

/**
 * Override an existing color's alpha channel. `alpha` is clamped to
 * `[0, 1]`. NaN returns the input color unchanged. Pine's `color.new(c,
 * transp)` analogue using direct alpha.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const c = withAlpha("#ff0000", 0.5);
 *     void c;
 */
export function withAlpha(c: Color, alpha: number): Color {
    if (Number.isNaN(alpha)) return c;
    const parsed = parseColor(c);
    if (parsed === null) return c;
    return emitRgba(parsed.r, parsed.g, parsed.b, clampUnit(alpha));
}

/**
 * Construct a color from RGB(A) components. Each component is clamped to
 * `[0, 255]`; alpha defaults to `1`. NaN components clamp to `0`.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const red = rgb(255, 0, 0);
 *     void red;
 */
export function rgb(r: number, g: number, b: number, alpha?: number): Color {
    const red = clampByte(r);
    const green = clampByte(g);
    const blue = clampByte(b);
    if (alpha === undefined) return `rgb(${red}, ${green}, ${blue})`;
    return emitRgba(red, green, blue, clampUnit(alpha));
}

/**
 * Construct a color from HSL(A) components. `h` is clamped to `[0, 360)`;
 * `s` and `l` are clamped to `[0, 100]`. Alpha defaults to `1`. NaN
 * components clamp to `0`.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const red = hsl(0, 100, 50);
 *     void red;
 */
export function hsl(h: number, s: number, l: number, alpha?: number): Color {
    const hue = formatNumber(clampHue(h));
    const sat = formatNumber(clampPercent(s));
    const light = formatNumber(clampPercent(l));
    if (alpha === undefined) return `hsl(${hue}, ${sat}%, ${light}%)`;
    return `hsla(${hue}, ${sat}%, ${light}%, ${formatNumber(clampUnit(alpha))})`;
}
