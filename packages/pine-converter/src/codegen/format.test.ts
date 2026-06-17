// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { formatSource } from "./format.js";

describe("formatSource", () => {
    it("indents nested blocks at 4 spaces and dedents on a leading close", () => {
        expect(formatSource("a {\nb;\n}\n")).toBe("a {\n    b;\n}\n");
    });

    it("dedents nested braces by depth", () => {
        const out = formatSource("a {\nb {\nc;\n}\n}\n");
        expect(out).toBe("a {\n    b {\n        c;\n    }\n}\n");
    });

    it("ignores brackets inside double-quoted string literals", () => {
        const out = formatSource('f("a { b }");\ng;\n');
        expect(out).toBe('f("a { b }");\ng;\n');
    });

    it("ignores brackets inside single-quoted and template literals", () => {
        const out = formatSource("f('x}');\ng(`y}`);\nh;\n");
        expect(out).toBe("f('x}');\ng(`y}`);\nh;\n");
    });

    it("honours an escaped quote inside a string literal", () => {
        const out = formatSource('f("a\\"{}");\ng;\n');
        expect(out).toBe('f("a\\"{}");\ng;\n');
    });

    it("collapses consecutive blank lines to one and trims trailing blanks", () => {
        const out = formatSource("a;\n\n\nb;\n\n\n");
        expect(out).toBe("a;\n\nb;\n");
    });

    it("drops leading blank lines before any content", () => {
        const out = formatSource("\n\na;\n");
        expect(out).toBe("a;\n");
    });

    it("never lets depth go negative on an unbalanced close", () => {
        const out = formatSource("}\na;\n");
        expect(out).toBe("}\na;\n");
    });
});
