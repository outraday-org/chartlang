// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { readSourceField } from "./readSourceField";

describe("readSourceField", () => {
    it("returns the canonical field when the params bag holds one", () => {
        expect(readSourceField({ source: "hl2" })).toBe("hl2");
        expect(readSourceField({ source: "open" })).toBe("open");
        expect(readSourceField({ source: "hlcc4" })).toBe("hlcc4");
    });

    it("falls back to 'close' when the entry is absent", () => {
        expect(readSourceField({})).toBe("close");
    });

    it("falls back to the supplied default when the entry is absent", () => {
        expect(readSourceField({}, "high")).toBe("high");
    });

    it("falls back when the entry is not a recognised string", () => {
        expect(readSourceField({ source: "bogus" })).toBe("close");
        expect(readSourceField({ source: 42 })).toBe("close");
        expect(readSourceField({ source: null })).toBe("close");
    });
});
