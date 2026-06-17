// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";
import { lookup } from "./types.js";

describe("lookup", () => {
    const map = new Map<string, { readonly chartlang: string | null }>([
        ["ok", { chartlang: "target" }],
        ["reject", { chartlang: null }],
    ]);

    it("returns the entry for a present non-REJECT key", () => {
        expect(lookup(map, "ok")?.chartlang).toBe("target");
    });

    it("returns null for an absent key", () => {
        expect(lookup(map, "missing")).toBeNull();
    });

    it("returns null for a REJECT entry (chartlang === null)", () => {
        expect(lookup(map, "reject")).toBeNull();
    });
});
