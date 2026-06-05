// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { computeMa } from "./computeMa";
import { computeMaOfFloat64 } from "./computeMaOfFloat64";
import type { MaType, MaTypeNoVolume } from "./maTypes";
import { vwmaFloat64 } from "./vwmaFloat64";

const SOURCE = new Float64Array([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
const VOLUME = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
const LENGTH = 3;

describe("computeMa", () => {
    it("routes 'vwma' to vwmaFloat64 when volume is provided", () => {
        const actual = computeMa("vwma", SOURCE, LENGTH, VOLUME);
        const expected = vwmaFloat64(SOURCE, VOLUME, LENGTH);
        for (let i = 0; i < SOURCE.length; i += 1) {
            if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
            else expect(actual[i]).toBe(expected[i]);
        }
    });

    it("throws a structured error when 'vwma' is called with null volume", () => {
        let caught: unknown = null;
        try {
            computeMa("vwma", SOURCE, LENGTH, null);
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(TypeError);
        const err = caught as TypeError & { code?: unknown };
        expect(err.code).toBe("ta-lib-vwma-requires-volume");
        expect(err.message).toBe("computeMa: vwma requires a non-null volume array");
    });

    it.each<MaTypeNoVolume>(["sma", "ema", "wma", "smma"])(
        "ignores the volume argument for non-vwma kind '%s'",
        (kind) => {
            const withVol = computeMa(kind, SOURCE, LENGTH, VOLUME);
            const withoutVol = computeMa(kind, SOURCE, LENGTH, null);
            const reference = computeMaOfFloat64(kind, SOURCE, LENGTH);
            for (let i = 0; i < SOURCE.length; i += 1) {
                if (Number.isNaN(reference[i])) {
                    expect(Number.isNaN(withVol[i])).toBe(true);
                    expect(Number.isNaN(withoutVol[i])).toBe(true);
                } else {
                    expect(withVol[i]).toBe(reference[i]);
                    expect(withoutVol[i]).toBe(reference[i]);
                }
            }
        },
    );

    it("covers every MaType literal (exhaustiveness)", () => {
        const kinds: ReadonlyArray<MaType> = ["sma", "ema", "wma", "smma", "vwma"];
        for (const kind of kinds) {
            const out = computeMa(kind, SOURCE, LENGTH, VOLUME);
            expect(out.length).toBe(SOURCE.length);
        }
    });
});
