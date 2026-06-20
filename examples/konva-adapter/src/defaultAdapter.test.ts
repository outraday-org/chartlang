// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { KONVA_CAPABILITIES, KONVA_SYM_INFO } from "./capabilities.js";
import defaultAdapter, { DEFAULT_ADAPTER } from "./defaultAdapter.js";

describe("DEFAULT_ADAPTER", () => {
    it("is the package default export and is frozen", () => {
        expect(defaultAdapter).toBe(DEFAULT_ADAPTER);
        expect(Object.isFrozen(DEFAULT_ADAPTER)).toBe(true);
    });

    it("exposes the capabilities-only conformance triple", () => {
        expect(DEFAULT_ADAPTER.id).toBe("konva-example-default");
        expect(DEFAULT_ADAPTER.name).toContain("Konva");
        expect(DEFAULT_ADAPTER.capabilities).toBe(KONVA_CAPABILITIES);
        expect(DEFAULT_ADAPTER.symInfo).toBe(KONVA_SYM_INFO);
    });

    it("resolves empty inputs", () => {
        expect(DEFAULT_ADAPTER.resolveInputs?.("any")).toEqual({});
    });

    it("yields an empty candle source", async () => {
        const received: unknown[] = [];
        for await (const e of DEFAULT_ADAPTER.candles({ interval: "chart" })) {
            received.push(e);
        }
        expect(received).toEqual([]);
    });

    it("no-ops onEmissions and dispose without throwing", () => {
        expect(() =>
            DEFAULT_ADAPTER.onEmissions({
                plots: [],
                drawings: [],
                alerts: [],
                alertConditions: [],
                logs: [],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            }),
        ).not.toThrow();
        expect(() => DEFAULT_ADAPTER.dispose()).not.toThrow();
    });
});
