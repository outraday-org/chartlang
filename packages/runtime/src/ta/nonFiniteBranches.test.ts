// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { chaikinOsc } from "./chaikinOsc.js";
import { klinger } from "./klinger.js";
import { macd } from "./macd.js";
import { massIndex } from "./massIndex.js";
import { ppo } from "./ppo.js";
import { tema } from "./tema.js";

// Deterministic non-finite inputs. The property tests reach these branches
// only when their random draw happens to produce one, which made the package's
// 100 % coverage threshold depend on the seed.

const BARS = syntheticBars(60, 41);
const GAP = 30;

/** `bar.close` with one NaN at bar `GAP`. */
function closeWithGap(bar: Bar, i: number): number {
    return i === GAP ? Number.NaN : bar.close;
}

function indexed<T>(step: (bar: Bar, i: number) => T): (bar: Bar) => T {
    let i = 0;
    return (bar) => {
        const out = step(bar, i);
        i += 1;
        return out;
    };
}

describe("ta.* on non-finite inputs", () => {
    it("tema is NaN on a NaN source", () => {
        const out = harness(
            BARS,
            BARS.length + 1,
            indexed((b, i) => tema("t", closeWithGap(b, i), 3).current),
        );
        expect(out[GAP]).toBeNaN();
        expect(Number.isFinite(out[GAP - 1])).toBe(true);
    });

    it("macd line and hist are NaN on a NaN source", () => {
        const out = harness(
            BARS,
            BARS.length + 1,
            indexed((b, i) => {
                const r = macd("m", closeWithGap(b, i));
                return { m: r.macd.current, h: r.hist.current };
            }),
        );
        expect(out[GAP]?.m).toBeNaN();
        expect(out[GAP]?.h).toBeNaN();
        expect(Number.isFinite(out[GAP - 1]?.h)).toBe(true);
    });

    it("ppo is NaN on a NaN source and on a zero slow average", () => {
        const out = harness(
            BARS,
            BARS.length + 1,
            indexed((b, i) => {
                const r = ppo("p", closeWithGap(b, i));
                return { p: r.ppo.current, h: r.hist.current };
            }),
        );
        expect(out[GAP]?.p).toBeNaN();
        expect(out[GAP]?.h).toBeNaN();
        const zeros = harness(BARS, BARS.length + 1, () => ppo("z", 0).ppo.current);
        expect(zeros.every(Number.isNaN)).toBe(true);
    });

    it("chaikinOsc is NaN when an average is undefined (ADL itself never is)", () => {
        // `ta.adl` treats a non-finite bar as a zero contribution, so only an
        // undefined EMA (a non-positive length has no alpha) reaches the guard.
        const out = harness(
            BARS,
            BARS.length + 1,
            () => chaikinOsc("c", { slowLength: 0 }).current,
        );
        expect(out.every(Number.isNaN)).toBe(true);
    });

    it("klinger is NaN when an average is undefined (a NaN bar contributes no flow)", () => {
        const out = harness(
            BARS,
            BARS.length + 1,
            () => klinger("k", { slowLength: 0 }).klinger.current,
        );
        expect(out.every(Number.isNaN)).toBe(true);
    });

    it("massIndex recomputes its window sum once a NaN ratio slides out", () => {
        // Flat bars first: high === low, so the range EMAs are 0 and the ratio NaN.
        const bars = BARS.map((b, i) => (i < 3 ? { ...b, high: b.close, low: b.close } : b));
        const out = harness(
            bars,
            bars.length + 1,
            () => massIndex("x", { emaLength: 2, sumLength: 4 }).current,
        );
        expect(out[3]).toBeNaN();
        expect(Number.isFinite(out[out.length - 1])).toBe(true);
    });
});
