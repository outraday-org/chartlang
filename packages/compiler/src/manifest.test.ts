// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { buildManifest } from "./manifest";

describe("buildManifest", () => {
    it("returns a recursively-frozen manifest", () => {
        const manifest = buildManifest({
            name: "demo",
            kind: "indicator",
            capabilities: ["alerts", "indicators"],
            requestedIntervals: ["1D", "1H"],
            userPickableInterval: false,
            seriesCapacities: { dynamicFallback: 5000 },
            maxLookback: 30,
            inputs: { length: { kind: "int", defaultValue: 14 } },
        });
        expect(Object.isFrozen(manifest)).toBe(true);
        expect(Object.isFrozen(manifest.capabilities)).toBe(true);
        expect(Object.isFrozen(manifest.requestedIntervals)).toBe(true);
        expect(Object.isFrozen(manifest.seriesCapacities)).toBe(true);
        expect(Object.isFrozen(manifest.inputs)).toBe(true);
        expect(Object.isFrozen(manifest.inputs.length)).toBe(true);
    });

    it("carries through every field", () => {
        const manifest = buildManifest({
            name: "demo",
            kind: "alert",
            capabilities: ["alerts"],
            requestedIntervals: [],
            userPickableInterval: true,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
            maxBarsBack: 100,
            format: "percent",
            precision: 2,
            scale: "right",
            requiresIntervals: ["1D", "1W"],
            shortName: "DEMO",
        });
        expect(manifest.name).toBe("demo");
        expect(manifest.kind).toBe("alert");
        expect(manifest.capabilities).toEqual(["alerts"]);
        expect(manifest.userPickableInterval).toBe(true);
        expect(manifest.maxLookback).toBe(0);
        expect(manifest.apiVersion).toBe(1);
        expect(manifest.maxBarsBack).toBe(100);
        expect(manifest.format).toBe("percent");
        expect(manifest.precision).toBe(2);
        expect(manifest.scale).toBe("right");
        expect(manifest.requiresIntervals).toEqual(["1D", "1W"]);
        expect(Object.isFrozen(manifest.requiresIntervals)).toBe(true);
        expect(manifest.shortName).toBe("DEMO");
    });

    it("supports kind 'drawing' for defineDrawing scripts", () => {
        const manifest = buildManifest({
            name: "fib-tool",
            kind: "drawing",
            capabilities: ["drawings"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
        });
        expect(manifest.kind).toBe("drawing");
        expect(manifest.capabilities).toEqual(["drawings"]);
    });
});
