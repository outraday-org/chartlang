// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseExpression } from "./expressions.js";

function exprFrom(source: string): ExpressionNode {
    const ctx = createContext(lex(source).tokens);
    return parseExpression(ctx);
}

describe("history operator", () => {
    it("parses close[1] with an identifier receiver", () => {
        const e = exprFrom("close[1]\n");
        if (e.kind === "history-access-expression") {
            expect(e.receiver.kind).toBe("identifier-expression");
            expect(e.offset).toMatchObject({ literalKind: "int", value: "1" });
        } else {
            throw new Error(`expected history-access-expression, got ${e.kind}`);
        }
    });

    it("chains close[1][2] left-associatively", () => {
        const e = exprFrom("close[1][2]\n");
        if (e.kind === "history-access-expression") {
            expect(e.offset).toMatchObject({ value: "2" });
            expect(e.receiver.kind).toBe("history-access-expression");
        } else {
            throw new Error(`expected history-access-expression, got ${e.kind}`);
        }
    });

    it("wraps a call: ta.ema(close, 9)[3]", () => {
        const e = exprFrom("ta.ema(close, 9)[3]\n");
        if (e.kind === "history-access-expression") {
            expect(e.receiver.kind).toBe("call-expression");
            expect(e.offset).toMatchObject({ value: "3" });
        } else {
            throw new Error(`expected history-access-expression, got ${e.kind}`);
        }
    });

    it("allows an identifier offset (arr[i])", () => {
        const e = exprFrom("arr[i]\n");
        if (e.kind === "history-access-expression") {
            expect(e.offset.kind).toBe("identifier-expression");
        } else {
            throw new Error(`expected history-access-expression, got ${e.kind}`);
        }
    });

    it("recovers an unterminated subscript", () => {
        const ctx = createContext(lex("close[1\n").tokens);
        parseExpression(ctx);
        expect(ctx.diagnostics.map((d) => d.code)).toContain("pine-converter/parse/expected-token");
    });
});
