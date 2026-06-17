// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseExpression } from "./expressions.js";
import { unparse } from "./unparse.js";

function roundTrip(source: string): string {
    const node = parseExpression(createContext(lex(`${source}\n`).tokens));
    return unparse(node);
}

function parse(source: string): ExpressionNode {
    return parseExpression(createContext(lex(`${source}\n`).tokens));
}

describe("unparse", () => {
    it("emits each primary form", () => {
        expect(roundTrip("close")).toBe("close");
        expect(roundTrip("42")).toBe("42");
        expect(roundTrip('"hi"')).toBe('"hi"');
        expect(roundTrip("na")).toBe("na");
    });

    it("emits operator forms with explicit grouping", () => {
        expect(roundTrip("-x")).toBe("(- x)");
        expect(roundTrip("a + b")).toBe("(a + b)");
        expect(roundTrip("c ? 1 : 2")).toBe("(c ? 1 : 2)");
    });

    it("emits a call with named args", () => {
        expect(roundTrip("ta.ema(close, length = 9)")).toBe("ta.ema(close, length = 9)");
    });

    it("emits a member chain and a history access", () => {
        expect(roundTrip("a.b.c")).toBe("a.b.c");
        expect(roundTrip("close[1]")).toBe("close[1]");
    });

    it("collapses a redundant paren around an operator form", () => {
        expect(roundTrip("(a + b)")).toBe("(a + b)");
    });

    it("emits a member access with a computed head", () => {
        expect(roundTrip("f().bar")).toBe("f().bar");
    });

    it("emits a tuple", () => {
        expect(roundTrip("(a, b)")).toBe("(a, b)");
    });

    it("emits a lambda", () => {
        expect(roundTrip("(x, y) => x + y")).toBe("(x, y) => (x + y)");
    });

    it("emits an unknown-expression as joined token text", () => {
        const node = parse(")");
        expect(node.kind).toBe("unknown-expression");
        expect(unparse(node)).toBe("");
    });

    it("emits a captured stray token inside an unknown-expression", () => {
        // `@` is illegal — the prefix parser captures the next stray token.
        const node = parse("=");
        expect(node.kind).toBe("unknown-expression");
        if (node.kind === "unknown-expression") {
            expect(unparse(node)).toBe("=");
        }
    });
});
