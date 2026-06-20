// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { ECHARTS_CAPABILITIES } from "./capabilities.js";
import { DEFAULT_ADAPTER } from "./defaultAdapter.js";

describe("DEFAULT_ADAPTER", () => {
    it("exposes the capabilities-only headless triple", () => {
        expect(DEFAULT_ADAPTER.id).toBe("echarts-example-default");
        expect(DEFAULT_ADAPTER.name).toContain("ECharts");
        expect(DEFAULT_ADAPTER.capabilities).toBe(ECHARTS_CAPABILITIES);
        expect(Object.isFrozen(DEFAULT_ADAPTER)).toBe(true);
    });

    it("resolveInputs returns an empty record", () => {
        expect(DEFAULT_ADAPTER.resolveInputs?.("any")).toEqual({});
    });

    it("candles yields an empty async iterable and onEmissions/dispose are no-ops", async () => {
        const events: CandleEvent[] = [];
        for await (const event of DEFAULT_ADAPTER.candles({ interval: "1D" })) {
            events.push(event);
        }
        expect(events).toEqual([]);
        expect(() => {
            DEFAULT_ADAPTER.onEmissions({
                plots: [],
                drawings: [],
                alerts: [],
                alertConditions: [],
                logs: [],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            });
            DEFAULT_ADAPTER.dispose();
        }).not.toThrow();
    });
});
