// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission, PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { MutableRunnerEmissions } from "../runtimeContext.js";
import { pushAlert, pushPlot } from "./emissionsQueue.js";

function makeQueue(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function makePlot(slotId: string, bar: number, value: number): PlotEmission {
    return {
        kind: "plot",
        slotId,
        title: "",
        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar,
        time: 1_700_000_000_000,
        value,
        color: null,
        meta: {},
        pane: "overlay",
    };
}

function makeAlert(slotId: string, bar: number, message: string): AlertEmission {
    return {
        kind: "alert",
        slotId,
        severity: "info",
        message,
        bar,
        time: 1_700_000_000_000,
        meta: {},
        channels: Object.freeze(["toast"] as const),
        dedupeKey: `${slotId}::${bar}::deadbeef`,
    };
}

describe("emissionsQueue — dedup properties", () => {
    it("pushPlot ∘ pushPlot with same (slotId, bar) leaves exactly one entry", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 8 }),
                fc.nat({ max: 1000 }),
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                (slotId, bar, v1, v2) => {
                    const q = makeQueue();
                    pushPlot(q, makePlot(slotId, bar, v1));
                    pushPlot(q, makePlot(slotId, bar, v2));
                    expect(q.plots).toHaveLength(1);
                    expect(q.plots[0].value).toBe(v2);
                },
            ),
        );
    });

    it("after an arbitrary push sequence, plots.length equals unique (slotId, bar) count", () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.tuple(
                        fc.constantFrom("a:1:1#0", "b:1:1#0", "c:1:1#0"),
                        fc.nat({ max: 5 }),
                        fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 }),
                    ),
                    { minLength: 1, maxLength: 30 },
                ),
                (pushes) => {
                    const q = makeQueue();
                    for (const [slot, bar, val] of pushes) {
                        pushPlot(q, makePlot(slot, bar, val));
                    }
                    const uniqueKeys = new Set(pushes.map(([s, b]) => `${s}::${b}`));
                    expect(q.plots).toHaveLength(uniqueKeys.size);
                },
            ),
        );
    });

    it("pushAlert ∘ pushAlert with same (slotId, bar) leaves exactly one entry", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 8 }),
                fc.nat({ max: 1000 }),
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.string({ minLength: 1, maxLength: 20 }),
                (slotId, bar, m1, m2) => {
                    const q = makeQueue();
                    pushAlert(q, makeAlert(slotId, bar, m1));
                    pushAlert(q, makeAlert(slotId, bar, m2));
                    expect(q.alerts).toHaveLength(1);
                    expect(q.alerts[0].message).toBe(m2);
                },
            ),
        );
    });
});
