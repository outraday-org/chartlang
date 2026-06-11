// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as publicSurface from "./index.js";

describe("public surface", () => {
    it("loads the package barrel", () => {
        expect(publicSurface).toBeDefined();
    });

    it("re-exports isCompiledScriptBundle as a runtime function", () => {
        expect(typeof publicSurface.isCompiledScriptBundle).toBe("function");
    });

    it("isCompiledScriptBundle narrows by 'primary' ownership", () => {
        const indicator = publicSurface.defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        expect(publicSurface.isCompiledScriptBundle(indicator)).toBe(false);
        const bundle = {
            primary: indicator,
            siblings: [],
            dependencies: [],
        };
        expect(publicSurface.isCompiledScriptBundle(bundle)).toBe(true);
    });
});
