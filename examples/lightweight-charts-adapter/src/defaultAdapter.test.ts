// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";
import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

describe("DEFAULT_ADAPTER", () => {
    it("exposes the capabilities + symInfo triple", () => {
        expect(DEFAULT_ADAPTER.id).toBe("lightweight-charts-reference-default");
        expect(DEFAULT_ADAPTER.name).toContain("Lightweight Charts");
        expect(DEFAULT_ADAPTER.capabilities).toBe(LWC_CAPABILITIES);
        expect(DEFAULT_ADAPTER.symInfo).toBe(LWC_SYM_INFO);
    });

    it("is frozen", () => {
        expect(Object.isFrozen(DEFAULT_ADAPTER)).toBe(true);
    });

    it("resolveInputs returns an empty record", () => {
        expect(DEFAULT_ADAPTER.resolveInputs?.("any")).toEqual({});
    });

    it("candles yields an empty async iterable", async () => {
        const collected: unknown[] = [];
        for await (const event of DEFAULT_ADAPTER.candles({ interval: "1D" })) {
            collected.push(event);
        }
        expect(collected).toEqual([]);
    });

    it("onEmissions and dispose are no-op", () => {
        expect(() =>
            DEFAULT_ADAPTER.onEmissions({
                plots: [],
                drawings: [],
                alerts: [],
                alertConditions: [],
                logs: [],
                diagnostics: [],
            }),
        ).not.toThrow();
        expect(() => DEFAULT_ADAPTER.dispose?.()).not.toThrow();
    });
});
