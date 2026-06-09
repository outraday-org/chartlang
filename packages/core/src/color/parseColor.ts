// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color } from "../types";

/**
 * Pine-style named palette values accepted by the color parser and exposed
 * through the `color` namespace.
 *
 * @internal
 * @since 0.5
 * @example
 *     const red = COLOR_PALETTE.red;
 *     void red;
 */
export const COLOR_PALETTE = Object.freeze({
    aqua: "#00ffff",
    black: "#000000",
    blue: "#0000ff",
    fuchsia: "#ff00ff",
    gray: "#808080",
    green: "#008000",
    lime: "#00ff00",
    maroon: "#800000",
    navy: "#000080",
    olive: "#808000",
    orange: "#ffa500",
    purple: "#800080",
    red: "#ff0000",
    silver: "#c0c0c0",
    teal: "#008080",
    white: "#ffffff",
    yellow: "#ffff00",
});

type PaletteName = keyof typeof COLOR_PALETTE;

const HEX_SHORT = /^#([0-9a-f]{3})$/i;
const HEX_LONG = /^#([0-9a-f]{6})$/i;
const RGB = /^rgba?\(\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)(?:\s*,\s*([^,\s]+))?\s*\)$/i;
const HSL = /^hsla?\(\s*([^,\s]+)\s*,\s*([^,\s%]+)%\s*,\s*([^,\s%]+)%(?:\s*,\s*([^,\s]+))?\s*\)$/i;

function isPaletteName(value: string): value is PaletteName {
    return Object.prototype.hasOwnProperty.call(COLOR_PALETTE, value);
}

function clampByte(value: number): number {
    return Math.min(255, Math.max(0, Math.floor(value)));
}

function clampRoundedByte(value: number): number {
    return Math.min(255, Math.max(0, Math.round(value)));
}

function clampUnit(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function parseNumber(value: string): number | null {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return null;
    return parsed;
}

function hslToRgb(h: number, s: number, l: number): Readonly<{ r: number; g: number; b: number }> {
    const hue = Math.min(359.999, Math.max(0, h)) / 360;
    const sat = Math.min(100, Math.max(0, s)) / 100;
    const light = Math.min(100, Math.max(0, l)) / 100;

    if (sat === 0) {
        const gray = clampRoundedByte(light * 255);
        return { r: gray, g: gray, b: gray };
    }

    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    const channel = (t: number): number => {
        let adjusted = t;
        if (adjusted < 0) adjusted += 1;
        if (adjusted > 1) adjusted -= 1;
        if (adjusted < 1 / 6) return p + (q - p) * 6 * adjusted;
        if (adjusted < 1 / 2) return q;
        if (adjusted < 2 / 3) return p + (q - p) * (2 / 3 - adjusted) * 6;
        return p;
    };

    return {
        r: clampRoundedByte(channel(hue + 1 / 3) * 255),
        g: clampRoundedByte(channel(hue) * 255),
        b: clampRoundedByte(channel(hue - 1 / 3) * 255),
    };
}

/**
 * Parse the CSS color forms chartlang emits: `#rgb`, `#rrggbb`,
 * `rgb(...)`, `rgba(...)`, `hsl(...)`, `hsla(...)`, and the named palette.
 * Returns `null` for unparseable input.
 *
 * @internal
 * @since 0.5
 * @example
 *     const parsed = parseColor("#ff0000");
 *     void parsed;
 */
export function parseColor(c: Color): Readonly<{ r: number; g: number; b: number; a: number }> | null {
    const value = c.trim().toLowerCase();
    if (isPaletteName(value)) return parseColor(COLOR_PALETTE[value]);

    const shortHex = HEX_SHORT.exec(value);
    if (shortHex) {
        const hex = shortHex[1];
        return {
            r: Number.parseInt(`${hex[0]}${hex[0]}`, 16),
            g: Number.parseInt(`${hex[1]}${hex[1]}`, 16),
            b: Number.parseInt(`${hex[2]}${hex[2]}`, 16),
            a: 1,
        };
    }

    const longHex = HEX_LONG.exec(value);
    if (longHex) {
        const hex = longHex[1];
        return {
            r: Number.parseInt(hex.slice(0, 2), 16),
            g: Number.parseInt(hex.slice(2, 4), 16),
            b: Number.parseInt(hex.slice(4, 6), 16),
            a: 1,
        };
    }

    const rgbMatch = RGB.exec(value);
    if (rgbMatch) {
        const r = parseNumber(rgbMatch[1]);
        const g = parseNumber(rgbMatch[2]);
        const b = parseNumber(rgbMatch[3]);
        const a = rgbMatch[4] === undefined ? 1 : parseNumber(rgbMatch[4]);
        if (r === null || g === null || b === null || a === null) return null;
        return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clampUnit(a) };
    }

    const hslMatch = HSL.exec(value);
    if (hslMatch) {
        const h = parseNumber(hslMatch[1]);
        const s = parseNumber(hslMatch[2]);
        const l = parseNumber(hslMatch[3]);
        const a = hslMatch[4] === undefined ? 1 : parseNumber(hslMatch[4]);
        if (h === null || s === null || l === null || a === null) return null;
        return { ...hslToRgb(h, s, l), a: clampUnit(a) };
    }

    return null;
}
