// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import defaultAdapter, {
    DEFAULT_ADAPTER,
    UPLOT_CAPABILITIES,
    UPLOT_PRICE_SCALE,
    UPLOT_SYM_INFO,
    buildViewport,
    createUplotAdapter,
    drawCandlePaths,
    offsetForViewport,
    runUplotLoop,
} from "./index.js";

describe("public surface", () => {
    it("re-exports the named symbols", () => {
        expect(UPLOT_CAPABILITIES).toBeDefined();
        expect(UPLOT_SYM_INFO).toBeDefined();
        expect(DEFAULT_ADAPTER).toBeDefined();
        expect(typeof createUplotAdapter).toBe("function");
        expect(typeof runUplotLoop).toBe("function");
        expect(typeof drawCandlePaths).toBe("function");
        expect(typeof buildViewport).toBe("function");
        expect(typeof offsetForViewport).toBe("function");
        expect(UPLOT_PRICE_SCALE).toBe("y");
    });

    it("default export is the headless adapter", () => {
        expect(defaultAdapter).toBe(DEFAULT_ADAPTER);
    });
});
