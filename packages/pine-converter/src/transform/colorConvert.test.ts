// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { convertColor, transpToAlphaHex } from "./colorConvert.js";

// Parse `x = <expr>` and return the value expression.
function parseValue(expr: string): ExpressionNode {
    const { script } = parseStatements(lex(`x = ${expr}\n`).tokens);
    const stmt = script.body[0];
    if (stmt.kind !== "assignment") {
        throw new Error(`expected an assignment, got ${stmt.kind}`);
    }
    return stmt.value;
}

describe("transpToAlphaHex", () => {
    it("maps transp=0 → FF (fully opaque)", () => {
        expect(transpToAlphaHex(0)).toBe("FF");
    });

    it("maps transp=100 → 00 (fully transparent)", () => {
        expect(transpToAlphaHex(100)).toBe("00");
    });

    it("maps transp=80 → 33", () => {
        expect(transpToAlphaHex(80)).toBe("33");
    });

    it("clamps out-of-range transp", () => {
        expect(transpToAlphaHex(-10)).toBe("FF");
        expect(transpToAlphaHex(150)).toBe("00");
    });

    it("always yields a valid two-char uppercase hex", () => {
        fc.assert(
            fc.property(fc.integer({ min: -50, max: 200 }), (transp) => {
                const hex = transpToAlphaHex(transp);
                return /^[0-9A-F]{2}$/.test(hex);
            }),
        );
    });
});

describe("convertColor", () => {
    it('folds color.new(color.gray, 80) → "#787B8633"', () => {
        expect(convertColor(parseValue("color.new(color.gray, 80)"), new Map())).toBe(
            '"#787B8633"',
        );
    });

    it('folds color.new(#FF8800, 0) → "#FF8800FF"', () => {
        expect(convertColor(parseValue("color.new(#FF8800, 0)"), new Map())).toBe('"#FF8800FF"');
    });

    it("folds color.new with a unary +transp", () => {
        expect(convertColor(parseValue("color.new(color.red, +50)"), new Map())).toBe(
            '"#FF525280"',
        );
    });

    it("lowers a bare color.* enum to its hex", () => {
        expect(convertColor(parseValue("color.blue"), new Map())).toBe('"#2196F3"');
    });

    it("passes a #RRGGBB literal through as a quoted string (case preserved)", () => {
        expect(convertColor(parseValue("#abcdef"), new Map())).toBe('"#abcdef"');
    });

    it("falls back to emitExpr for a non-literal transp", () => {
        expect(convertColor(parseValue("color.new(color.gray, len)"), new Map())).toBe(
            "color.new(color.gray, len)",
        );
    });

    it("falls back to emitExpr for a non-foldable base color", () => {
        expect(convertColor(parseValue("color.new(myColor, 80)"), new Map())).toBe(
            "color.new(myColor, 80)",
        );
    });

    it("falls back for color.new missing its transp arg", () => {
        expect(convertColor(parseValue("color.new(color.gray)"), new Map())).toBe(
            "color.new(color.gray)",
        );
    });

    it("rejects an 8-digit #RRGGBBAA base (not a 6-digit hex)", () => {
        // An already-alpha'd literal is not a 6-digit base, so no double fold;
        // the emitExpr fallback quotes the color literal verbatim.
        const node = parseValue("color.new(#11223344, 50)");
        expect(convertColor(node, new Map())).toBe('color.new("#11223344", 50)');
    });

    it("lowers a non-color expression via emitExpr", () => {
        expect(convertColor(parseValue("close"), new Map())).toBe("bar.close");
    });

    it("does not treat a non-color.new call as a fold", () => {
        const node = parseValue("color.rgb(1, 2, 3)");
        expect(node.kind).toBe("call-expression");
        expect(convertColor(node, new Map())).toBe("color.rgb(1, 2, 3)");
    });

    it("handles a call with a non-member-access callee (dottedCallee null)", () => {
        // `f(1)` has an identifier callee, so dottedCallee returns null and the
        // color.new fold is skipped.
        const node = parseValue("f(1)");
        expect(node.kind).toBe("call-expression");
        expect(convertColor(node, new Map())).toBe("f(1)");
    });

    it("falls back for an unrecognised bare member chain (enumLookup null)", () => {
        const out = convertColor(parseValue("color.notARealColor"), new Map());
        expect(out).toBe("color.notARealColor");
    });

    it("ignores an enum whose target is a string but not a 6-digit hex", () => {
        // `size.auto` maps to the string "normal" (length 6), not a colour
        // hex; convertColor must not treat it as a base hex.
        const out = convertColor(parseValue("size.auto"), new Map());
        expect(out).not.toMatch(/^"#/);
        expect(out).toBe("size.auto");
    });

    it("ignores a line-style enum (string target, not a colour hex)", () => {
        const out = convertColor(parseValue("line.style_dashed"), new Map());
        expect(out).not.toMatch(/^"#/);
    });
});

describe("convertColor — head-null callee guard", () => {
    it("does not fold a member-rooted color.new (head !== null)", () => {
        const inner = parseValue("obj.color.new(color.gray, 80)") as CallExpression;
        // A `obj.color.new(...)` chain has head=null but chain ["obj","color","new"];
        // dottedCallee !== "color.new", so no fold.
        expect(convertColor(inner, new Map())).toContain("obj.color.new");
    });
});
