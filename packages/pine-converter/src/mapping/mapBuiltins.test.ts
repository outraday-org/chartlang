// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MAP_BUILTIN_MAP, type MapBuiltinForm, mapBuiltinLookup } from "./mapBuiltins.js";

describe("MAP_BUILTIN_MAP", () => {
    it("maps each supported Pine map.* member onto its chartlang method + form", () => {
        const expected: ReadonlyArray<readonly [string, string, MapBuiltinForm]> = [
            ["map.put", "set", "put"],
            ["map.get", "get", "get"],
            ["map.contains", "has", "has"],
            ["map.remove", "delete", "remove"],
            ["map.size", "size", "size"],
            ["map.clear", "clear", "clear"],
        ];
        for (const [pine, chartlang, form] of expected) {
            const entry = MAP_BUILTIN_MAP.get(pine);
            expect(entry).toEqual({ pine, chartlang, form });
        }
    });

    it("marks the no-iterator reads (keys/values) as REJECTs with a note", () => {
        for (const pine of ["map.keys", "map.values"]) {
            const entry = MAP_BUILTIN_MAP.get(pine);
            expect(entry?.chartlang).toBeNull();
            expect(entry?.notes).toContain("iterator");
        }
    });
});

describe("mapBuiltinLookup", () => {
    it("returns the mapping for a supported member", () => {
        expect(mapBuiltinLookup("map.put")?.chartlang).toBe("set");
        expect(mapBuiltinLookup("map.size")?.form).toBe("size");
    });

    it("collapses a REJECT (keys/values) to null", () => {
        expect(mapBuiltinLookup("map.keys")).toBeNull();
        expect(mapBuiltinLookup("map.values")).toBeNull();
    });

    it("returns null for an unknown member", () => {
        expect(mapBuiltinLookup("map.copy")).toBeNull();
    });
});
