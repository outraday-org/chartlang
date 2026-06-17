// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseExpression } from "./expression-stub.js";

function exprFrom(source: string) {
    const ctx = createContext(lex(source).tokens);
    return parseExpression(ctx);
}

describe("parseExpression (Task 3 stub)", () => {
    it("captures the run of tokens up to a newline boundary", () => {
        const expr = exprFrom("close + 1\n");
        expect(expr.kind).toBe("unknown-expression");
        if (expr.kind === "unknown-expression") {
            expect(expr.tokens.map((t) => t.text)).toEqual(["close", "+", "1"]);
        }
    });

    it("stops at a comma without consuming it", () => {
        const ctx = createContext(lex("a, b\n").tokens);
        const expr = parseExpression(ctx);
        if (expr.kind === "unknown-expression") {
            expect(expr.tokens.map((t) => t.text)).toEqual(["a"]);
        }
        expect(ctx.cursor.peek().text).toBe(",");
    });

    it("stops at the => switch-arm operator", () => {
        const ctx = createContext(lex("x => y\n").tokens);
        const expr = parseExpression(ctx);
        if (expr.kind === "unknown-expression") {
            expect(expr.tokens.map((t) => t.text)).toEqual(["x"]);
        }
        expect(ctx.cursor.peek().text).toBe("=>");
    });

    it("stops at the `to` and `by` for-loop keywords", () => {
        const ctx = createContext(lex("0 to 9\n").tokens);
        const from = parseExpression(ctx);
        if (from.kind === "unknown-expression") {
            expect(from.tokens.map((t) => t.text)).toEqual(["0"]);
        }
        expect(ctx.cursor.peek().text).toBe("to");
    });

    it("returns a zero-width node when no tokens precede the boundary", () => {
        const ctx = createContext(lex(")\n").tokens);
        const expr = parseExpression(ctx);
        expect(expr.kind).toBe("unknown-expression");
        if (expr.kind === "unknown-expression") {
            expect(expr.tokens).toHaveLength(0);
        }
        expect(expr.span.startColumn).toBe(expr.span.endColumn);
        expect(expr.span.startLine).toBe(expr.span.endLine);
    });
});
