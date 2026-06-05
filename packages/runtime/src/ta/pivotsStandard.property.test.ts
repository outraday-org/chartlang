// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers";
import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { pivotsStandard } from "./pivotsStandard";

describe("ta.pivotsStandard — property invariants", () => {
    it("output length equals input length", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 40 }), (bars) => {
                const out = harness(bars, bars.length + 1, () => {
                    const p = pivotsStandard("slot");
                    return p.pp.current;
                });
                expect(out.length).toBe(bars.length);
            }),
            { numRuns: 15 },
        );
    });

    it("returns the same record identity across all bars", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 30 }), (bars) => {
                const refs: unknown[] = [];
                harness(bars, bars.length + 1, () => {
                    refs.push(pivotsStandard("slot"));
                    return null;
                });
                for (let i = 1; i < refs.length; i += 1) expect(refs[i]).toBe(refs[0]);
            }),
            { numRuns: 15 },
        );
    });

    it("determinism: same input → identical output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 25 }), (bars) => {
                const a = harness(bars, bars.length + 1, () => {
                    const p = pivotsStandard("slot");
                    return p.pp.current;
                });
                const b = harness(bars, bars.length + 1, () => {
                    const p = pivotsStandard("slot");
                    return p.pp.current;
                });
                for (let i = 0; i < a.length; i += 1) {
                    if (Number.isNaN(a[i])) expect(Number.isNaN(b[i])).toBe(true);
                    else expect(b[i]).toBe(a[i]);
                }
            }),
            { numRuns: 15 },
        );
    });

    it("every system produces only NaN within the first UTC day (no boundary)", () => {
        // arbBar emits all bars at the same time (1_700_000_000_000)
        // — every bar is in the same UTC day, so no boundary fires
        // and every output stays NaN.
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 3, maxLength: 20 }),
                fc.constantFrom("classic", "fibonacci", "camarilla", "woodie"),
                (bars, system) => {
                    const out = harness(bars, bars.length + 1, () => {
                        const p = pivotsStandard("slot", {
                            system: system as "classic" | "fibonacci" | "camarilla" | "woodie",
                        });
                        return p.pp.current;
                    });
                    for (const v of out) expect(Number.isNaN(v)).toBe(true);
                },
            ),
            { numRuns: 20 },
        );
    });

    it("ticking the last closed bar with its own values reproduces the close output", () => {
        fc.assert(
            fc.property(fc.array(arbBar, { minLength: 5, maxLength: 20 }), (bars) => {
                const closedOut = harness(bars, bars.length + 1, () => {
                    const p = pivotsStandard("slot");
                    return p.pp.current;
                });
                const expected = closedOut[closedOut.length - 1];
                const { ctxRef } = harnessWithCtx(bars, bars.length + 1, () =>
                    pivotsStandard("slot"),
                );
                const last = bars[bars.length - 1];
                const tickHead = tick(ctxRef, last, () => {
                    const p = pivotsStandard("slot");
                    return p.pp.current;
                });
                if (Number.isNaN(expected)) {
                    expect(Number.isNaN(tickHead)).toBe(true);
                } else {
                    expect(tickHead).toBeCloseTo(expected, 8);
                }
            }),
            { numRuns: 15 },
        );
    });
});
