// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { CANVAS2D_CAPABILITIES } from "./capabilities";

describe("CANVAS2D_CAPABILITIES", () => {
    it("declares all 9 Phase-1+Phase-2 plot kinds (cardinality + membership)", () => {
        expect(CANVAS2D_CAPABILITIES.plots.size).toBe(9);
        expect([...CANVAS2D_CAPABILITIES.plots].sort()).toEqual(
            [
                "area",
                "bars",
                "filled-band",
                "histogram",
                "horizontal-line",
                "label",
                "line",
                "marker",
                "step-line",
            ].sort(),
        );
    });

    it("declares exactly the log + toast alert channels", () => {
        expect([...CANVAS2D_CAPABILITIES.alerts].sort()).toEqual(["log", "toast"]);
    });

    it("declares all 61 Phase-3 drawing kinds", () => {
        expect(CANVAS2D_CAPABILITIES.drawings.size).toBe(61);
        // Sample a few from each category to confirm membership routes
        // through `capabilities.allPhase3Drawings()`.
        expect(CANVAS2D_CAPABILITIES.drawings.has("line")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("fib-retracement")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("elliott-impulse-wave")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("group")).toBe(true);
    });

    it("sizes maxDrawingsPerScript so the Phase-3 drawAll61 smoke fits every bucket", () => {
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.lines).toBe(200);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.labels).toBe(200);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.boxes).toBe(100);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.polylines).toBe(100);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.other).toBe(100);
    });

    it("disables inputs, alertConditions, logs, multiTimeframe, sub-panes, sym-info", () => {
        expect(CANVAS2D_CAPABILITIES.inputs.size).toBe(0);
        expect(CANVAS2D_CAPABILITIES.alertConditions).toBe(false);
        expect(CANVAS2D_CAPABILITIES.logs).toBe(false);
        expect(CANVAS2D_CAPABILITIES.multiTimeframe).toBe(false);
        expect(CANVAS2D_CAPABILITIES.subPanes).toBe(0);
        expect(CANVAS2D_CAPABILITIES.symInfoFields.size).toBe(0);
    });

    it("ships the three Phase-1 intervals (1D / 1h / 5m)", () => {
        const values = CANVAS2D_CAPABILITIES.intervals.map((i) => i.value);
        expect(values).toEqual(["1D", "1h", "5m"]);
    });

    it("clamps maxLookback / maxTickHz to the documented defaults", () => {
        expect(CANVAS2D_CAPABILITIES.maxLookback).toBe(1000);
        expect(CANVAS2D_CAPABILITIES.maxTickHz).toBe(30);
    });

    it("is frozen — consumers cannot mutate the bag", () => {
        expect(Object.isFrozen(CANVAS2D_CAPABILITIES)).toBe(true);
    });
});
