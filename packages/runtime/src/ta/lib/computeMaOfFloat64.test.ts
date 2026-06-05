// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeMaOfFloat64 } from "./computeMaOfFloat64";
import { computeEmaOfFloat64 } from "./emaFloat64";
import type { MaTypeNoVolume } from "./maTypes";
import { computeSmaOfFloat64 } from "./smaFloat64";
import { smmaFloat64 } from "./smmaFloat64";
import { wmaFloat64 } from "./wmaFloat64";

const SOURCE = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const LENGTH = 3;

describe("computeMaOfFloat64", () => {
    it("routes 'sma' to computeSmaOfFloat64", () => {
        const actual = computeMaOfFloat64("sma", SOURCE, LENGTH);
        const expected = computeSmaOfFloat64(SOURCE, LENGTH);
        for (let i = 0; i < SOURCE.length; i += 1) {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
            else expect(actual[i]).toBe(expected[i]);
        }
    });

    it("routes 'ema' to computeEmaOfFloat64", () => {
        const actual = computeMaOfFloat64("ema", SOURCE, LENGTH);
        const expected = computeEmaOfFloat64(SOURCE, LENGTH);
        for (let i = 0; i < SOURCE.length; i += 1) {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
            else expect(actual[i]).toBe(expected[i]);
        }
    });

    it("routes 'wma' to wmaFloat64", () => {
        const actual = computeMaOfFloat64("wma", SOURCE, LENGTH);
        const expected = wmaFloat64(SOURCE, LENGTH);
        for (let i = 0; i < SOURCE.length; i += 1) {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
            else expect(actual[i]).toBe(expected[i]);
        }
    });

    it("routes 'smma' to smmaFloat64", () => {
        const actual = computeMaOfFloat64("smma", SOURCE, LENGTH);
        const expected = smmaFloat64(SOURCE, LENGTH);
        for (let i = 0; i < SOURCE.length; i += 1) {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
            else expect(actual[i]).toBe(expected[i]);
        }
    });

    it("covers every MaTypeNoVolume literal (exhaustiveness)", () => {
        const kinds: ReadonlyArray<MaTypeNoVolume> = ["sma", "ema", "wma", "smma"];
        for (const kind of kinds) {
            const out = computeMaOfFloat64(kind, SOURCE, LENGTH);
            expect(out.length).toBe(SOURCE.length);
        }
    });
});
