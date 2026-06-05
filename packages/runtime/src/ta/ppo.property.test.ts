// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { harness } from "./__fixtures__/runPrimitive";
import { ppo } from "./ppo";

const arbBar = fc
    .tuple(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        fc.integer({ min: 0, max: 60_000 }),
    )
    .map(
        ([close, spread, dt]): Bar => ({
            time: 1_700_000_000_000 + dt,
            open: close,
            high: close + spread,
            low: close - spread,
            close,
            volume: 0,
            symbol: "T",
            interval: "1m",
        }),
    );

describe("ta.ppo — property invariants", () => {
    it("output length advances by 1 per close", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) => ppo("slot", bar.close).ppo.current,
                );
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 20 },
        );
    });

    it("warmup is at least slowLength + signalLength − 2 NaN slots on signal", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 30, maxLength: 60 }), (bars) => {
                const out = harness(
                    bars,
                    bars.length + 1,
                    (bar) =>
                        ppo("slot", bar.close, {
                            fastLength: 3,
                            slowLength: 6,
                            signalLength: 4,
                        }).signal.current,
                );
                // First defined signal at bar `6 + 4 - 2 = 8`.
                for (let i = 0; i < 8 && i < out.length; i += 1) {
                    expect(Number.isNaN(out[i])).toBe(true);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical ppo / signal / hist output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 50 }), (bars) => {
                const a = harness(bars, bars.length + 1, (bar) => {
                    const p = ppo("slot", bar.close);
                    return {
                        ppo: p.ppo.current,
                        signal: p.signal.current,
                        hist: p.hist.current,
                    };
                });
                const b = harness(bars, bars.length + 1, (bar) => {
                    const p = ppo("slot", bar.close);
                    return {
                        ppo: p.ppo.current,
                        signal: p.signal.current,
                        hist: p.hist.current,
                    };
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i].ppo)) expect(Number.isNaN(b[i].ppo)).toBe(true);
                    else expect(b[i].ppo).toBe(a[i].ppo);
                    if (Number.isNaN(a[i].signal)) expect(Number.isNaN(b[i].signal)).toBe(true);
                    else expect(b[i].signal).toBe(a[i].signal);
                    if (Number.isNaN(a[i].hist)) expect(Number.isNaN(b[i].hist)).toBe(true);
                    else expect(b[i].hist).toBe(a[i].hist);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("hist == ppo − signal where both finite", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 20, maxLength: 50 }), (bars) => {
                const out = harness(bars, bars.length + 1, (bar) => {
                    const p = ppo("slot", bar.close);
                    return {
                        ppo: p.ppo.current,
                        signal: p.signal.current,
                        hist: p.hist.current,
                    };
                });
                for (const { ppo: pv, signal, hist } of out) {
                    if (Number.isFinite(pv) && Number.isFinite(signal)) {
                        expect(hist).toBeCloseTo(pv - signal, 12);
                    } else {
                        expect(Number.isNaN(hist)).toBe(true);
                    }
                }
            }),
            { numRuns: 15 },
        );
    });
});
