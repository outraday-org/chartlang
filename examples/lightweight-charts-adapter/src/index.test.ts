// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import defaultExport, * as publicSurface from "./index.js";

describe("public surface", () => {
    it("re-exports the capability bag, factory, and loop helper", () => {
        expect(publicSurface.LWC_CAPABILITIES).toBeDefined();
        expect(publicSurface.LWC_SYM_INFO).toBeDefined();
        expect(typeof publicSurface.createLightweightChartsAdapter).toBe("function");
        expect(typeof publicSurface.runRendererLoop).toBe("function");
    });

    it("default export is the headless conformance adapter", () => {
        expect(defaultExport).toBe(publicSurface.DEFAULT_ADAPTER);
        expect(defaultExport.capabilities.plots.has("line")).toBe(true);
    });
});
