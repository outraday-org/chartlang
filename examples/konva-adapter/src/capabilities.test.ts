// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { KONVA_CAPABILITIES, KONVA_SYM_INFO } from "./capabilities.js";

describe("KONVA_CAPABILITIES", () => {
    it("declares every Phase-5 plot kind", () => {
        for (const kind of capabilities.allPhase5Plots()) {
            expect(KONVA_CAPABILITIES.plots.has(kind)).toBe(true);
        }
        expect(KONVA_CAPABILITIES.plots.size).toBe(capabilities.allPhase5Plots().size);
    });

    it("declares all 63 drawing kinds (62 Phase-3 + table)", () => {
        for (const kind of capabilities.allPhase3Drawings()) {
            expect(KONVA_CAPABILITIES.drawings.has(kind)).toBe(true);
        }
        expect(KONVA_CAPABILITIES.drawings.has("table")).toBe(true);
        expect(KONVA_CAPABILITIES.drawings.size).toBe(capabilities.allPhase3Drawings().size + 1);
    });

    it("enables alerts, conditions, logs, MTF, sub-panes, and inputs-off", () => {
        expect(KONVA_CAPABILITIES.alerts.has("log")).toBe(true);
        expect(KONVA_CAPABILITIES.alerts.has("toast")).toBe(true);
        expect(KONVA_CAPABILITIES.alertConditions).toBe(true);
        expect(KONVA_CAPABILITIES.logs).toBe(true);
        expect(KONVA_CAPABILITIES.multiTimeframe).toBe(true);
        expect(KONVA_CAPABILITIES.multiSymbol).toBe(true);
        expect(KONVA_CAPABILITIES.subPanes).toBe(Number.MAX_SAFE_INTEGER);
        expect(KONVA_CAPABILITIES.inputs.size).toBe(0);
    });

    it("lists canonical intervals and full syminfo fields", () => {
        expect(KONVA_CAPABILITIES.intervals.map((i) => i.value)).toContain("1D");
        expect(KONVA_CAPABILITIES.symInfoFields.has("ticker")).toBe(true);
        expect(KONVA_CAPABILITIES.symInfoFields.has("meta")).toBe(true);
    });

    it("sizes the per-bucket drawing budget", () => {
        expect(KONVA_CAPABILITIES.maxDrawingsPerScript.lines).toBe(200);
        expect(KONVA_CAPABILITIES.maxLookback).toBe(1000);
        expect(KONVA_CAPABILITIES.maxTickHz).toBe(30);
    });

    it("is frozen so copied adapters cannot mutate the bag", () => {
        expect(Object.isFrozen(KONVA_CAPABILITIES)).toBe(true);
    });
});

describe("KONVA_SYM_INFO", () => {
    it("exposes the demo symbol metadata, frozen", () => {
        expect(KONVA_SYM_INFO.ticker).toBe("DEMO");
        expect(KONVA_SYM_INFO.mintick).toBe(0.01);
        expect(KONVA_SYM_INFO.meta?.vendor).toBe("konva-example");
        expect(Object.isFrozen(KONVA_SYM_INFO)).toBe(true);
    });
});
