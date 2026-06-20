// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import defaultAdapter, {
    DEFAULT_ADAPTER,
    ECHARTS_CAPABILITIES,
    ECHARTS_SYM_INFO,
    createEChartsAdapter,
    runEChartsLoop,
} from "./index.js";

describe("public surface", () => {
    it("re-exports the factory, loop, capabilities, and default adapter", () => {
        expect(typeof createEChartsAdapter).toBe("function");
        expect(typeof runEChartsLoop).toBe("function");
        expect(ECHARTS_CAPABILITIES.plots.has("line")).toBe(true);
        expect(ECHARTS_SYM_INFO.ticker).toBe("DEMO");
        expect(DEFAULT_ADAPTER.id).toBe("echarts-example-default");
    });

    it("default export is the headless DEFAULT_ADAPTER", () => {
        expect(defaultAdapter).toBe(DEFAULT_ADAPTER);
    });
});
