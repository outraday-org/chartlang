// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { input } from "../input";
import { defineAlert } from "./defineAlert";

describe("defineAlert", () => {
    it("returns a frozen CompiledScriptObject with kind 'alert'", () => {
        const compute = vi.fn();
        const script = defineAlert({ name: "ob", apiVersion: 1, compute });

        expect(Object.isFrozen(script)).toBe(true);
        expect(Object.isFrozen(script.manifest)).toBe(true);
        expect(script.manifest.apiVersion).toBe(1);
        expect(script.manifest.kind).toBe("alert");
        expect(script.manifest.name).toBe("ob");
        expect(script.manifest.inputs).toEqual({});
        expect([...script.manifest.capabilities]).toEqual(["alerts"]);
        expect([...script.manifest.requestedIntervals]).toEqual([]);
        expect(script.manifest.userPickableInterval).toBe(false);
        expect(script.manifest.seriesCapacities).toEqual({});
        expect(script.manifest.maxLookback).toBe(0);
    });

    it("preserves the compute function identity", () => {
        const compute = vi.fn();
        const script = defineAlert({ name: "ob", apiVersion: 1, compute });
        expect(script.compute).toBe(compute);
    });

    it("uses provided inputs schema", () => {
        const inputs = { threshold: input.int(70) } as const;
        const script = defineAlert({
            name: "ob",
            apiVersion: 1,
            inputs,
            compute: () => {},
        });
        expect(script.manifest.inputs).toEqual(inputs);
    });

    it("propagates alert-applicable override fields into the manifest", () => {
        const script = defineAlert({
            name: "ob",
            apiVersion: 1,
            maxBarsBack: 250,
            requiresIntervals: ["1H", "1D"],
            shortName: "OB",
            compute: () => {},
        });
        expect(script.manifest.maxBarsBack).toBe(250);
        expect(script.manifest.requiresIntervals).toEqual(["1H", "1D"]);
        expect(script.manifest.shortName).toBe("OB");
    });

    it("excludes indicator-only display overrides from the opts type", () => {
        void defineAlert;
        // @ts-expect-error alerts do not bind a display scale
        const scaleOpts: Parameters<typeof defineAlert>[0] = {
            name: "ob",
            apiVersion: 1,
            scale: "right",
            compute: () => {},
        };
        // @ts-expect-error alerts do not render formatted axis values
        const formatOpts: Parameters<typeof defineAlert>[0] = {
            name: "ob",
            apiVersion: 1,
            format: "price",
            compute: () => {},
        };
        // @ts-expect-error alerts do not render with display precision
        const precisionOpts: Parameters<typeof defineAlert>[0] = {
            name: "ob",
            apiVersion: 1,
            precision: 2,
            compute: () => {},
        };
        void scaleOpts;
        void formatOpts;
        void precisionOpts;
    });
});
