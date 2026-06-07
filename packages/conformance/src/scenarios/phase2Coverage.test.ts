// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
import { TA_REGISTRY } from "@invinite-org/chartlang-runtime";
import { describe, expect, it } from "vitest";

import { PHASE_2_INDICATORS, PHASE_5_DEFERRED } from "./phase2Inventory";

const PHASE_1_INDICATORS: ReadonlyArray<string> = Object.freeze([
    "sma",
    "ema",
    "stdev",
    "bb",
    "rsi",
    "macd",
    "atr",
    "crossover",
    "crossunder",
] as const);

describe("Phase 2 surface", () => {
    it("every PLAN §9.2 indicator has a ta.* primitive", () => {
        for (const id of PHASE_2_INDICATORS) {
            expect(TA_REGISTRY).toHaveProperty(id);
        }
    });

    it("every Phase-1 ta.* primitive is still present (no regressions)", () => {
        for (const id of PHASE_1_INDICATORS) {
            expect(TA_REGISTRY).toHaveProperty(id);
        }
    });

    it("TA_REGISTRY cardinality is 90 (9 Phase-1 + 81 Phase-2)", () => {
        expect(Object.keys(TA_REGISTRY).length).toBe(90);
        expect(PHASE_1_INDICATORS.length + PHASE_2_INDICATORS.length).toBe(90);
    });

    it("STATEFUL_PRIMITIVES cardinality is 154 (93 Phase-2 + 61 Phase-3 draw.* kinds)", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(154);
    });

    it("ta.nz is the only slot:false entry", () => {
        const stateless = [...STATEFUL_PRIMITIVES].filter((e) => e.slot === false);
        expect(stateless.map((e) => e.name)).toEqual(["ta.nz"]);
    });

    it("no Phase-5 deferred primitive leaked into the registry", () => {
        for (const id of PHASE_5_DEFERRED) {
            expect(TA_REGISTRY).not.toHaveProperty(id);
        }
    });

    it("the registry contains no extras beyond Phase-1 + Phase-2 + the inventory", () => {
        const known = new Set([...PHASE_1_INDICATORS, ...PHASE_2_INDICATORS]);
        const extras = Object.keys(TA_REGISTRY).filter((k) => !known.has(k));
        expect(extras).toEqual([]);
    });
});
