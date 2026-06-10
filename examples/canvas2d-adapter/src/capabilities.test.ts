// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { CANVAS2D_CAPABILITIES } from "./capabilities.js";

describe("CANVAS2D_CAPABILITIES", () => {
    it("declares all 17 Phase-1 through Phase-5 plot kinds (cardinality + membership)", () => {
        expect(CANVAS2D_CAPABILITIES.plots.size).toBe(17);
        expect([...CANVAS2D_CAPABILITIES.plots].sort()).toEqual(
            [
                "area",
                "arrow",
                "bars",
                "bar-color",
                "bar-override",
                "bg-color",
                "candle-override",
                "character",
                "filled-band",
                "histogram",
                "horizontal-line",
                "horizontal-histogram",
                "label",
                "line",
                "marker",
                "shape",
                "step-line",
            ].sort(),
        );
    });

    it("declares exactly the log + toast alert channels", () => {
        expect([...CANVAS2D_CAPABILITIES.alerts].sort()).toEqual(["log", "toast"]);
    });

    it("declares all 61 Phase-3 drawing kinds plus Phase-5 table", () => {
        expect(CANVAS2D_CAPABILITIES.drawings.size).toBe(62);
        // Sample a few from each category to confirm membership routes
        // through `capabilities.allPhase3Drawings()`.
        expect(CANVAS2D_CAPABILITIES.drawings.has("line")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("fib-retracement")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("elliott-impulse-wave")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("group")).toBe(true);
        expect(CANVAS2D_CAPABILITIES.drawings.has("table")).toBe(true);
    });

    it("sizes maxDrawingsPerScript so the Phase-3 drawAll61 smoke fits every bucket", () => {
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.lines).toBe(200);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.labels).toBe(200);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.boxes).toBe(100);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.polylines).toBe(100);
        expect(CANVAS2D_CAPABILITIES.maxDrawingsPerScript.other).toBe(100);
    });

    it("disables inputs while enabling logs, multiTimeframe, and alertConditions", () => {
        expect(CANVAS2D_CAPABILITIES.inputs.size).toBe(0);
        expect(CANVAS2D_CAPABILITIES.alertConditions).toBe(true);
        expect(CANVAS2D_CAPABILITIES.logs).toBe(true);
        expect(CANVAS2D_CAPABILITIES.multiTimeframe).toBe(true);
    });

    it("ships the Phase-6 intervals in picker order with canonical groups", () => {
        expect(CANVAS2D_CAPABILITIES.intervals).toEqual([
            { value: "15s", label: "15 seconds", group: "second" },
            { value: "30s", label: "30 seconds", group: "second" },
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "5m", label: "5 minutes", group: "minute" },
            { value: "15m", label: "15 minutes", group: "minute" },
            { value: "1h", label: "1 hour", group: "hour" },
            { value: "1D", label: "1 day", group: "daily" },
            { value: "1W", label: "1 week", group: "weekly" },
        ]);
        expect(CANVAS2D_CAPABILITIES.intervals.length).toBe(8);
        expect(Object.isFrozen(CANVAS2D_CAPABILITIES.intervals)).toBe(true);
    });

    it("declares unlimited sub-panes and all Phase-4 syminfo fields", () => {
        expect(CANVAS2D_CAPABILITIES.subPanes).toBe(Number.MAX_SAFE_INTEGER);
        expect(CANVAS2D_CAPABILITIES.symInfoFields.size).toBe(9);
        expect([...CANVAS2D_CAPABILITIES.symInfoFields].sort()).toEqual(
            [
                "basecurrency",
                "currency",
                "exchange",
                "meta",
                "mintick",
                "session",
                "ticker",
                "timezone",
                "type",
            ].sort(),
        );
    });

    it("clamps maxLookback / maxTickHz to the documented defaults", () => {
        expect(CANVAS2D_CAPABILITIES.maxLookback).toBe(1000);
        expect(CANVAS2D_CAPABILITIES.maxTickHz).toBe(30);
    });

    it("is frozen — consumers cannot mutate the bag", () => {
        expect(Object.isFrozen(CANVAS2D_CAPABILITIES)).toBe(true);
    });
});
