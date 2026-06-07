// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { defineIndicator } from "./defineIndicator";

describe("defineIndicator", () => {
    it("returns a frozen CompiledScriptObject with default manifest fields", () => {
        const compute = vi.fn();
        const script = defineIndicator({ name: "demo", apiVersion: 1, compute });

        expect(Object.isFrozen(script)).toBe(true);
        expect(Object.isFrozen(script.manifest)).toBe(true);
        expect(script.manifest.apiVersion).toBe(1);
        expect(script.manifest.kind).toBe("indicator");
        expect(script.manifest.name).toBe("demo");
        expect(script.manifest.inputs).toEqual({});
        expect([...script.manifest.capabilities]).toEqual(["indicators"]);
        expect([...script.manifest.requestedIntervals]).toEqual([]);
        expect(script.manifest.userPickableInterval).toBe(false);
        expect(script.manifest.seriesCapacities).toEqual({});
        expect(script.manifest.maxLookback).toBe(0);
    });

    it("preserves the compute function identity", () => {
        const compute = vi.fn();
        const script = defineIndicator({ name: "demo", apiVersion: 1, compute });
        expect(script.compute).toBe(compute);
    });

    it("uses provided inputs schema", () => {
        const inputs = { length: 14 } as const;
        const script = defineIndicator({
            name: "demo",
            apiVersion: 1,
            inputs,
            compute: () => {},
        });
        expect(script.manifest.inputs).toEqual(inputs);
    });

    it("omits manifest.maxDrawings when opts.maxDrawings is undefined", () => {
        const script = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        expect(script.manifest.maxDrawings).toBeUndefined();
        expect("maxDrawings" in script.manifest).toBe(false);
    });

    it("propagates opts.maxDrawings into the manifest verbatim", () => {
        const maxDrawings = {
            lines: 10,
            labels: 5,
            boxes: 3,
            polylines: 7,
            other: 1,
        } as const;
        const script = defineIndicator({
            name: "demo",
            apiVersion: 1,
            maxDrawings,
            compute: () => {},
        });
        expect(script.manifest.maxDrawings).toEqual(maxDrawings);
    });
});
