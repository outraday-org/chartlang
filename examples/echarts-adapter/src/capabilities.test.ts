// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { ECHARTS_CAPABILITIES, ECHARTS_SYM_INFO } from "./capabilities.js";

describe("ECHARTS_CAPABILITIES", () => {
    it("declares the full Phase-5 plot inventory", () => {
        for (const kind of capabilities.allPhase5Plots()) {
            expect(ECHARTS_CAPABILITIES.plots.has(kind)).toBe(true);
        }
        expect(ECHARTS_CAPABILITIES.plots.size).toBe(capabilities.allPhase5Plots().size);
    });

    it("declares all 62 Phase-3 drawing kinds plus table", () => {
        for (const kind of capabilities.allPhase3Drawings()) {
            expect(ECHARTS_CAPABILITIES.drawings.has(kind)).toBe(true);
        }
        expect(ECHARTS_CAPABILITIES.drawings.has("table")).toBe(true);
        expect(ECHARTS_CAPABILITIES.drawings.size).toBe(capabilities.allPhase3Drawings().size + 1);
    });

    it("supports log + toast alert channels but no inputs", () => {
        expect(ECHARTS_CAPABILITIES.alerts.has("log")).toBe(true);
        expect(ECHARTS_CAPABILITIES.alerts.has("toast")).toBe(true);
        expect(ECHARTS_CAPABILITIES.inputs.size).toBe(0);
    });

    it("carries timeframe, sub-pane, MTF, syminfo, budget, alert-condition, and log metadata", () => {
        expect(ECHARTS_CAPABILITIES.intervals.length).toBeGreaterThan(0);
        expect(ECHARTS_CAPABILITIES.subPanes).toBe(Number.MAX_SAFE_INTEGER);
        expect(ECHARTS_CAPABILITIES.multiTimeframe).toBe(true);
        expect(ECHARTS_CAPABILITIES.symInfoFields.has("ticker")).toBe(true);
        expect(ECHARTS_CAPABILITIES.maxDrawingsPerScript.lines).toBe(200);
        expect(ECHARTS_CAPABILITIES.alertConditions).toBe(true);
        expect(ECHARTS_CAPABILITIES.logs).toBe(true);
        expect(ECHARTS_CAPABILITIES.maxLookback).toBe(1000);
        expect(ECHARTS_CAPABILITIES.maxTickHz).toBe(30);
    });

    it("is frozen so copied adapters cannot mutate it", () => {
        expect(Object.isFrozen(ECHARTS_CAPABILITIES)).toBe(true);
        expect(Object.isFrozen(ECHARTS_SYM_INFO)).toBe(true);
    });
});

describe("ECHARTS_SYM_INFO", () => {
    it("exposes the demo symbol metadata", () => {
        expect(ECHARTS_SYM_INFO.ticker).toBe("DEMO");
        expect(ECHARTS_SYM_INFO.type).toBe("equity");
        expect(ECHARTS_SYM_INFO.mintick).toBe(0.01);
        expect(ECHARTS_SYM_INFO.meta?.vendor).toBe("echarts-example");
    });
});
