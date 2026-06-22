// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { capabilities } from "./capabilities/index.js";
import { defineAdapter } from "./defineAdapter.js";
import { mockCandleSource } from "./mocks/index.js";
import type { Capabilities } from "./types.js";

const minimalCapabilities: Capabilities = {
    plots: capabilities.allLines(),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    multiSymbol: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: {
        lines: 0,
        labels: 0,
        boxes: 0,
        polylines: 0,
        other: 0,
    },
    maxLookback: 5000,
    maxTickHz: 10,
};

describe("defineAdapter", () => {
    it("returns an Adapter with the supplied id, name, capabilities, and callbacks", () => {
        const onEmissions = vi.fn();
        const a = defineAdapter({
            id: "demo",
            name: "Demo",
            capabilities: minimalCapabilities,
            candles: () => mockCandleSource([]),
            onEmissions,
        });
        expect(a.id).toBe("demo");
        expect(a.name).toBe("Demo");
        expect(a.capabilities).toBe(minimalCapabilities);
        expect(typeof a.candles).toBe("function");
        expect(a.onEmissions).toBe(onEmissions);
    });

    it("substitutes a no-op dispose when none is supplied", () => {
        const a = defineAdapter({
            id: "demo",
            name: "Demo",
            capabilities: minimalCapabilities,
            candles: () => mockCandleSource([]),
            onEmissions: () => {},
        });
        expect(() => a.dispose()).not.toThrow();
        expect(a.dispose()).toBeUndefined();
    });

    it("forwards the supplied dispose by reference", () => {
        const dispose = vi.fn();
        const a = defineAdapter({
            id: "demo",
            name: "Demo",
            capabilities: minimalCapabilities,
            candles: () => mockCandleSource([]),
            onEmissions: () => {},
            dispose,
        });
        a.dispose();
        expect(dispose).toHaveBeenCalledOnce();
    });

    it("preserves optional sym-info metadata", () => {
        const resolveInputs = vi.fn<(scriptId: string) => Readonly<Record<string, unknown>>>(
            () => ({
                length: 20,
            }),
        );
        const a = defineAdapter({
            id: "demo",
            name: "Demo",
            capabilities: minimalCapabilities,
            resolveInputs,
            symInfo: { ticker: "DEMO", type: "equity", mintick: 0.01 },
            candles: () => mockCandleSource([]),
            onEmissions: () => {},
        });

        expect(a.symInfo).toEqual({ ticker: "DEMO", type: "equity", mintick: 0.01 });
        expect(a.resolveInputs).toBe(resolveInputs);
        expect(a.resolveInputs?.("demo")).toEqual({ length: 20 });
    });
});
