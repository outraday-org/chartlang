// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";

describe("LWC_CAPABILITIES", () => {
    it("declares every Phase-5 plot kind", () => {
        const expected = capabilities.allPhase5Plots();
        expect(LWC_CAPABILITIES.plots.size).toBe(expected.size);
        for (const kind of expected) {
            expect(LWC_CAPABILITIES.plots.has(kind)).toBe(true);
        }
    });

    it("declares every Phase-3 drawing kind plus table", () => {
        const expected = capabilities.union(capabilities.allPhase3Drawings(), new Set(["table"]));
        expect(LWC_CAPABILITIES.drawings.size).toBe(expected.size);
        for (const kind of expected) {
            expect(LWC_CAPABILITIES.drawings.has(kind)).toBe(true);
        }
        expect(LWC_CAPABILITIES.drawings.has("table")).toBe(true);
        expect(LWC_CAPABILITIES.drawings.has("fib-retracement")).toBe(true);
    });

    it("declares the log + toast alert channels", () => {
        expect(LWC_CAPABILITIES.alerts.has("log")).toBe(true);
        expect(LWC_CAPABILITIES.alerts.has("toast")).toBe(true);
        expect(LWC_CAPABILITIES.alerts.size).toBe(2);
    });

    it("declares no inputs", () => {
        expect(LWC_CAPABILITIES.inputs.size).toBe(0);
    });

    it("enables multiTimeframe, unlimited subPanes, conditions and logs", () => {
        expect(LWC_CAPABILITIES.multiTimeframe).toBe(true);
        expect(LWC_CAPABILITIES.multiSymbol).toBe(true);
        expect(LWC_CAPABILITIES.subPanes).toBe(Number.MAX_SAFE_INTEGER);
        expect(LWC_CAPABILITIES.alertConditions).toBe(true);
        expect(LWC_CAPABILITIES.logs).toBe(true);
    });

    it("declares the eight-entry interval list", () => {
        expect(LWC_CAPABILITIES.intervals.map((i) => i.value)).toEqual([
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

    it("declares the full symInfo field set", () => {
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
            expect(LWC_CAPABILITIES.symInfoFields.has(field)).toBe(true);
        }
    });

    it("declares per-bucket drawing budgets and limits", () => {
        expect(LWC_CAPABILITIES.maxDrawingsPerScript).toEqual({
            lines: 200,
            labels: 200,
            boxes: 100,
            polylines: 100,
            other: 100,
        });
        expect(LWC_CAPABILITIES.maxLookback).toBe(1000);
        expect(LWC_CAPABILITIES.maxTickHz).toBe(30);
    });

    it("is frozen so copied adapters cannot mutate it", () => {
        expect(Object.isFrozen(LWC_CAPABILITIES)).toBe(true);
    });
});

describe("LWC_SYM_INFO", () => {
    it("exposes frozen demo metadata", () => {
        expect(LWC_SYM_INFO.ticker).toBe("DEMO");
        expect(LWC_SYM_INFO.mintick).toBe(0.01);
        expect(LWC_SYM_INFO.meta).toEqual({ vendor: "lightweight-charts-reference" });
        expect(Object.isFrozen(LWC_SYM_INFO)).toBe(true);
    });
});
