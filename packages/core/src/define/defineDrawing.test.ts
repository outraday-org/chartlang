// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { input } from "../input/index.js";
import { defineDrawing } from "./defineDrawing.js";

describe("defineDrawing", () => {
    it("returns a frozen CompiledScriptObject with kind 'drawing'", () => {
        const compute = vi.fn();
        const script = defineDrawing({ name: "fib", apiVersion: 1, compute });

        expect(Object.isFrozen(script)).toBe(true);
        expect(Object.isFrozen(script.manifest)).toBe(true);
        expect(script.manifest.apiVersion).toBe(1);
        expect(script.manifest.kind).toBe("drawing");
        expect(script.manifest.name).toBe("fib");
        expect(script.manifest.inputs).toEqual({});
        expect([...script.manifest.capabilities]).toEqual(["drawings"]);
        expect([...script.manifest.requestedIntervals]).toEqual([]);
        expect(script.manifest.userPickableInterval).toBe(false);
        expect(script.manifest.seriesCapacities).toEqual({});
        expect(script.manifest.maxLookback).toBe(0);
    });

    it("preserves the compute function identity", () => {
        const compute = vi.fn();
        const script = defineDrawing({ name: "fib", apiVersion: 1, compute });
        expect(script.compute).toBe(compute);
    });

    it("uses provided inputs schema", () => {
        const inputs = { swingLow: input.int(100) } as const;
        const script = defineDrawing({
            name: "fib",
            apiVersion: 1,
            inputs,
            compute: () => {},
        });
        expect(script.manifest.inputs).toEqual(inputs);
    });

    it("omits manifest.maxDrawings when opts.maxDrawings is undefined", () => {
        const script = defineDrawing({
            name: "fib",
            apiVersion: 1,
            compute: () => {},
        });
        expect(script.manifest.maxDrawings).toBeUndefined();
        expect("maxDrawings" in script.manifest).toBe(false);
    });

    it("propagates opts.maxDrawings into the manifest verbatim", () => {
        const maxDrawings = {
            lines: 4,
            labels: 6,
            boxes: 2,
            polylines: 1,
            other: 5,
        } as const;
        const script = defineDrawing({
            name: "fib",
            apiVersion: 1,
            maxDrawings,
            compute: () => {},
        });
        expect(script.manifest.maxDrawings).toEqual(maxDrawings);
    });

    it("propagates drawing-applicable override fields into the manifest", () => {
        const script = defineDrawing({
            name: "fib",
            apiVersion: 1,
            format: "price",
            precision: 3,
            requiresIntervals: ["1D"],
            shortName: "FIB",
            compute: () => {},
        });
        expect(script.manifest.format).toBe("price");
        expect(script.manifest.precision).toBe(3);
        expect(script.manifest.requiresIntervals).toEqual(["1D"]);
        expect(script.manifest.shortName).toBe("FIB");
    });

    it("excludes lookback and scale overrides from the opts type", () => {
        void defineDrawing;
        // @ts-expect-error drawings are ephemeral and do not declare lookback
        const maxBarsBackOpts: Parameters<typeof defineDrawing>[0] = {
            name: "fib",
            apiVersion: 1,
            maxBarsBack: 100,
            compute: () => {},
        };
        // @ts-expect-error drawing pane placement is determined by anchors
        const scaleOpts: Parameters<typeof defineDrawing>[0] = {
            name: "fib",
            apiVersion: 1,
            scale: "right",
            compute: () => {},
        };
        void maxBarsBackOpts;
        void scaleOpts;
    });
});
