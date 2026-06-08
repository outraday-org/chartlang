// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { CANVAS2D_CAPABILITIES } from "./capabilities";
import { DEFAULT_ADAPTER } from "./defaultAdapter";

describe("DEFAULT_ADAPTER", () => {
    it("exposes the canvas2d capability bag verbatim", () => {
        expect(DEFAULT_ADAPTER.capabilities).toBe(CANVAS2D_CAPABILITIES);
    });

    it("declares a stable id + name pair", () => {
        expect(DEFAULT_ADAPTER.id).toBe("canvas2d-reference-default");
        expect(DEFAULT_ADAPTER.name).toBe("Canvas 2D Reference Adapter (default)");
    });

    it("exposes demo sym-info metadata", () => {
        expect(DEFAULT_ADAPTER.symInfo?.ticker).toBe("DEMO");
        expect(DEFAULT_ADAPTER.symInfo?.type).toBe("equity");
        expect(DEFAULT_ADAPTER.symInfo?.mintick).toBe(0.01);
    });

    it("exposes an empty input override resolver", () => {
        expect(DEFAULT_ADAPTER.resolveInputs?.("demo")).toEqual({});
    });

    it("yields an empty async candle source", async () => {
        const source = DEFAULT_ADAPTER.candles({ interval: "chart" });
        const collected: unknown[] = [];
        for await (const event of source) {
            collected.push(event);
        }
        expect(collected).toEqual([]);
    });

    it("ignores onEmissions / dispose calls (no-ops)", () => {
        expect(() =>
            DEFAULT_ADAPTER.onEmissions({
                plots: [],
                drawings: [],
                alerts: [],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            }),
        ).not.toThrow();
        expect(() => DEFAULT_ADAPTER.dispose()).not.toThrow();
    });

    it("is frozen", () => {
        expect(Object.isFrozen(DEFAULT_ADAPTER)).toBe(true);
    });
});
