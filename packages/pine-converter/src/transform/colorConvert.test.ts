// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { CallExpression, ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import {
    convertColor,
    convertColorWith,
    isTranspColorForm,
    literalColorDefault,
    transpToAlphaHex,
} from "./colorConvert.js";
import { emitExpr } from "./exprEmit.js";

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

    it("emits color.withAlpha for a literal base + dynamic transp", () => {
        // A dynamic transp cannot fold to a hex; the literal base resolves to
        // its hex and the alpha becomes the `(100 - transp) / 100` fraction.
        expect(convertColor(parseValue("color.new(color.gray, len)"), new Map())).toBe(
            'color.withAlpha("#787B86", (100 - len) / 100)',
        );
    });

    it("emits color.withAlpha for a dynamic base + literal transp", () => {
        // transp 80 → alpha 0.2; the dynamic base lowers through the emitter.
        expect(convertColor(parseValue("color.new(myColor, 80)"), new Map())).toBe(
            "color.withAlpha(myColor, 0.2)",
        );
    });

    it("falls back for color.new missing its transp arg", () => {
        expect(convertColor(parseValue("color.new(color.gray)"), new Map())).toBe(
            "color.new(color.gray)",
        );
    });

    it("lowers an 8-digit #RRGGBBAA base via color.withAlpha (not a 6-digit fold)", () => {
        // An already-alpha'd literal is not a 6-digit base, so no hex fold; the
        // dynamic path quotes the literal verbatim and applies the alpha.
        const node = parseValue("color.new(#11223344, 50)");
        expect(convertColor(node, new Map())).toBe('color.withAlpha("#11223344", 0.5)');
    });

    it("clamps an out-of-range transp in the color.new hex fold", () => {
        expect(convertColor(parseValue("color.new(color.red, 150)"), new Map())).toBe(
            '"#FF525200"',
        );
    });

    it("folds a 4-arg color.rgb(r, g, b, transp) to a #RRGGBBAA hex", () => {
        // transp 60 → alpha 0x66.
        expect(convertColor(parseValue("color.rgb(255, 153, 0, 60)"), new Map())).toBe(
            '"#FF990066"',
        );
    });

    it("clamps an out-of-range rgb component in the 4-arg fold", () => {
        expect(convertColor(parseValue("color.rgb(300, 0, 0, 0)"), new Map())).toBe('"#FF0000FF"');
    });

    it("emits color.withAlpha for a 4-arg color.rgb with a dynamic transp", () => {
        expect(convertColor(parseValue("color.rgb(255, 153, 0, x)"), new Map())).toBe(
            "color.withAlpha(color.rgb(255, 153, 0), (100 - x) / 100)",
        );
    });

    it("emits color.withAlpha for a 4-arg color.rgb with a dynamic component", () => {
        expect(convertColor(parseValue("color.rgb(r, 153, 0, 60)"), new Map())).toBe(
            "color.withAlpha(color.rgb(r, 153, 0), 0.4)",
        );
    });

    it("lowers a non-color expression via emitExpr", () => {
        expect(convertColor(parseValue("close"), new Map())).toBe("bar.close");
    });

    it("folds a literal 3-arg color.rgb(r, g, b) to a #RRGGBB hex", () => {
        const node = parseValue("color.rgb(1, 2, 3)");
        expect(node.kind).toBe("call-expression");
        expect(convertColor(node, new Map())).toBe('"#010203"');
    });

    it("passes a dynamic 3-arg color.rgb(r, g, b) through unchanged", () => {
        const node = parseValue("color.rgb(r, 2, 3)");
        expect(node.kind).toBe("call-expression");
        expect(convertColor(node, new Map())).toBe("color.rgb(r, 2, 3)");
    });

    it("passes a malformed color.rgb call through unchanged", () => {
        expect(convertColor(parseValue("color.rgb(1, 2)"), new Map())).toBe("color.rgb(1, 2)");
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

describe("convertColorWith — context-aware emit", () => {
    // A stub emitter that rewrites a bare `len` to `inputs.len` (mimics the
    // input-aware `emitWithContext`), proving the dynamic sub-expressions route
    // through the caller's emitter rather than the annotation-based default.
    const inputEmit = (node: ExpressionNode): string =>
        node.kind === "identifier-expression" && node.name === "len"
            ? "inputs.len"
            : emitExpr(node, new Map());

    it("routes a dynamic transp through the supplied emitter", () => {
        expect(convertColorWith(parseValue("color.new(color.gray, len)"), inputEmit)).toBe(
            'color.withAlpha("#787B86", (100 - inputs.len) / 100)',
        );
    });

    it("routes a non-colour fallback through the supplied emitter", () => {
        expect(convertColorWith(parseValue("len"), inputEmit)).toBe("inputs.len");
    });
});

describe("literalColorDefault", () => {
    it("rejects malformed color.new defaults", () => {
        expect(literalColorDefault(parseValue("color.new(color.red)"))).toBeNull();
    });

    it("rejects dynamic color.new defaults", () => {
        expect(literalColorDefault(parseValue("color.new(dynamicColor, 40)"))).toBeNull();
        expect(literalColorDefault(parseValue("color.new(color.red, transp)"))).toBeNull();
    });

    it("rejects malformed color.rgb defaults", () => {
        expect(literalColorDefault(parseValue("color.rgb(1, 2)"))).toBeNull();
    });

    it("rejects color.rgb defaults with dynamic transparency", () => {
        expect(literalColorDefault(parseValue("color.rgb(1, 2, 3, transp)"))).toBeNull();
    });

    it("rejects unrecognized color calls in literal-default contexts", () => {
        expect(literalColorDefault(parseValue("color.hsl(1, 2, 3)"))).toBeNull();
    });
});

describe("isTranspColorForm", () => {
    it("is true for a 2-arg color.new", () => {
        expect(isTranspColorForm(parseValue("color.new(color.red, 80)"))).toBe(true);
    });

    it("is false for a 1-arg color.new (no transp)", () => {
        expect(isTranspColorForm(parseValue("color.new(color.red)"))).toBe(false);
    });

    it("is true for a 4-arg color.rgb", () => {
        expect(isTranspColorForm(parseValue("color.rgb(1, 2, 3, 60)"))).toBe(true);
    });

    it("is false for a 3-arg color.rgb (no transp)", () => {
        expect(isTranspColorForm(parseValue("color.rgb(1, 2, 3)"))).toBe(false);
    });

    it("is false for another color call", () => {
        expect(isTranspColorForm(parseValue("color.hsl(1, 2, 3)"))).toBe(false);
    });

    it("is false for a non-call node", () => {
        expect(isTranspColorForm(parseValue("color.red"))).toBe(false);
    });
});
