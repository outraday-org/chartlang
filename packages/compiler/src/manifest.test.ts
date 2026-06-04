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
            inputs: { length: 14 },
        });
        expect(Object.isFrozen(manifest)).toBe(true);
        expect(Object.isFrozen(manifest.capabilities)).toBe(true);
        expect(Object.isFrozen(manifest.requestedIntervals)).toBe(true);
        expect(Object.isFrozen(manifest.seriesCapacities)).toBe(true);
        expect(Object.isFrozen(manifest.inputs)).toBe(true);
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
        });
        expect(manifest.name).toBe("demo");
        expect(manifest.kind).toBe("alert");
        expect(manifest.capabilities).toEqual(["alerts"]);
        expect(manifest.userPickableInterval).toBe(true);
        expect(manifest.maxLookback).toBe(0);
        expect(manifest.apiVersion).toBe(1);
    });
});
