// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { UPLOT_CAPABILITIES, UPLOT_SYM_INFO } from "./capabilities.js";

describe("UPLOT_CAPABILITIES", () => {
    it("declares the full Phase-5 plot inventory", () => {
        for (const kind of capabilities.allPhase5Plots()) {
            expect(UPLOT_CAPABILITIES.plots.has(kind)).toBe(true);
        }
        expect(UPLOT_CAPABILITIES.plots.size).toBe(capabilities.allPhase5Plots().size);
    });

    it("declares all 63 drawing kinds (allPhase3Drawings + table)", () => {
        for (const kind of capabilities.allPhase3Drawings()) {
            expect(UPLOT_CAPABILITIES.drawings.has(kind)).toBe(true);
        }
        expect(UPLOT_CAPABILITIES.drawings.has("table")).toBe(true);
        expect(UPLOT_CAPABILITIES.drawings.size).toBe(capabilities.allPhase3Drawings().size + 1);
    });

    it("enables log + toast alerts only", () => {
        expect(UPLOT_CAPABILITIES.alerts.has("log")).toBe(true);
        expect(UPLOT_CAPABILITIES.alerts.has("toast")).toBe(true);
        expect(UPLOT_CAPABILITIES.alerts.has("webhook")).toBe(false);
    });

    it("declares no inputs", () => {
        expect(UPLOT_CAPABILITIES.inputs.size).toBe(0);
    });

    it("declares MTF, unlimited sub-panes, alert conditions, and logs", () => {
        expect(UPLOT_CAPABILITIES.multiTimeframe).toBe(true);
        expect(UPLOT_CAPABILITIES.subPanes).toBe(Number.MAX_SAFE_INTEGER);
        expect(UPLOT_CAPABILITIES.alertConditions).toBe(true);
        expect(UPLOT_CAPABILITIES.logs).toBe(true);
    });

    it("preserves interval picker order", () => {
        expect(UPLOT_CAPABILITIES.intervals.map((i) => i.value)).toEqual([
            "15s",
            "30s",
            "1m",
            "5m",
            "15m",
            "1h",
            "1D",
            "1W",
        ]);
    });

    it("declares the full syminfo field set", () => {
        for (const field of [
            "ticker",
            "type",
            "mintick",
            "currency",
            "basecurrency",
            "exchange",
            "timezone",
            "session",
            "meta",
        ] as const) {
            expect(UPLOT_CAPABILITIES.symInfoFields.has(field)).toBe(true);
        }
    });

    it("sizes the drawing budget", () => {
        expect(UPLOT_CAPABILITIES.maxDrawingsPerScript).toEqual({
            lines: 200,
            labels: 200,
            boxes: 100,
            polylines: 100,
            other: 100,
        });
    });

    it("is frozen", () => {
        expect(Object.isFrozen(UPLOT_CAPABILITIES)).toBe(true);
    });
});

describe("UPLOT_SYM_INFO", () => {
    it("exposes demo metadata", () => {
        expect(UPLOT_SYM_INFO.ticker).toBe("DEMO");
        expect(UPLOT_SYM_INFO.mintick).toBe(0.01);
        expect(UPLOT_SYM_INFO.meta?.vendor).toBe("uplot-example");
    });

    it("is frozen", () => {
        expect(Object.isFrozen(UPLOT_SYM_INFO)).toBe(true);
    });
});
