// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { CHARTLANG_VERSIONS, STARTER_CLONE_REF } from "./chartlangVersions.js";

describe("chartlangVersions", () => {
    it("pins the clone ref to a giget ref suffix", () => {
        expect(STARTER_CLONE_REF.startsWith("#")).toBe(true);
    });

    it("covers the starter chartlang deps the adapter bundle does not list", () => {
        // editor + language-service are imported by the starter UI but not by any
        // adapter, so they MUST come from the baked manifest.
        expect(CHARTLANG_VERSIONS["@invinite-org/chartlang-editor"]).toMatch(/^\^/);
        expect(CHARTLANG_VERSIONS["@invinite-org/chartlang-language-service"]).toMatch(/^\^/);
        expect(CHARTLANG_VERSIONS["@invinite-org/chartlang-compiler"]).toMatch(/^\^/);
    });
});
