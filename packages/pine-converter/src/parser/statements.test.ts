// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import { lex } from "../lexer/index.js";
import type { Token } from "../lexer/index.js";
import { createContext } from "./context.js";
import { parseVersionDirective } from "./declarations.js";
import { parseBlock, parseStatement } from "./statements.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

function bodyOf(source: string) {
    const ctx = createContext(lex(source).tokens);
    parseVersionDirective(ctx);
    // Skip the declaration line so the cursor sits on the first body statement.
    while (ctx.cursor.peekKind() !== "newline" && !ctx.cursor.atEnd()) {
        ctx.cursor.next();
    }
    ctx.cursor.match("newline");
    return { ctx };
}

describe("parseStatement — return", () => {
    it("captures the returned value when one is present", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\nreturn close\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("return-statement");
        if (stmt?.kind === "return-statement") {
            expect(stmt.value).not.toBeNull();
        }
    });

    it("leaves the value null for a bare return", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\nreturn\n");
        const stmt = parseStatement(ctx);
        if (stmt?.kind === "return-statement") {
            expect(stmt.value).toBeNull();
        }
    });
});

describe("parseStatement — compound assignment", () => {
    it("parses each compound operator into an assignment carrying that operator", () => {
        for (const op of ["+=", "-=", "*=", "/="] as const) {
            const { ctx } = bodyOf(`//@version=6\nindicator()\ncount ${op} 1\n`);
            const stmt = parseStatement(ctx);
            expect(stmt?.kind).toBe("assignment");
            if (stmt?.kind === "assignment") {
                expect(stmt.operator).toBe(op);
                expect(stmt.name).toBe("count");
                expect(stmt.value.kind).toBe("literal-expression");
            }
        }
    });

    it("still parses plain `=` and `:=` assignments", () => {
        const decl = bodyOf("//@version=6\nindicator()\nx = 1\n");
        expect(parseStatement(decl.ctx)?.kind).toBe("assignment");
        const reassign = bodyOf("//@version=6\nindicator()\nx := 1\n");
        const stmt = parseStatement(reassign.ctx);
        if (stmt?.kind === "assignment") {
            expect(stmt.operator).toBe(":=");
        }
    });
});

describe("parseBlock — defensive dedent recovery", () => {
    it("returns an empty block when an indent runs into eof without a dedent", () => {
        // The lexer never emits an unbalanced indent/dedent, but parseBlock
        // must still terminate and span the trailing token rather than loop.
        const tokens: readonly Token[] = [
            { kind: "indent", text: "", span: SPAN },
            { kind: "eof", text: "", span: SPAN },
        ];
        const ctx = createContext(tokens);
        const block = parseBlock(ctx);
        expect(block.kind).toBe("block-statement");
        expect(block.body).toHaveLength(0);
    });
});

describe("parseStatement — user-defined function declarations", () => {
    it("parses a single-line decl with the body as a one-statement return block", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf_slope(ma, n) => ta.ema(close, n)\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("function-declaration");
        if (stmt?.kind === "function-declaration") {
            expect(stmt.name).toBe("cf_slope");
            expect(stmt.params.map((p) => p.name)).toEqual(["ma", "n"]);
            // Each param carries its own identifier span (no collision).
            expect(stmt.params.every((p) => p.span.startColumn > 0)).toBe(true);
            expect(stmt.body.kind).toBe("block-statement");
            expect(stmt.body.body).toHaveLength(1);
            expect(stmt.body.body[0].kind).toBe("expression-statement");
        }
        expect(ctx.diagnostics).toHaveLength(0);
    });

    it("parses a multi-line decl whose last statement is the implicit return", () => {
        const { ctx } = bodyOf(
            "//@version=6\nindicator()\ncf_atr(length) =>\n    atr = ta.atr(length)\n    p = (atr / close) * 100\n",
        );
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("function-declaration");
        if (stmt?.kind === "function-declaration") {
            expect(stmt.name).toBe("cf_atr");
            expect(stmt.params.map((p) => p.name)).toEqual(["length"]);
            expect(stmt.body.body).toHaveLength(2);
            const last = stmt.body.body[1];
            expect(last.kind).toBe("assignment");
            if (last.kind === "assignment") {
                expect(last.name).toBe("p");
            }
        }
    });

    it("parses a zero-parameter declaration", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\npi() => 3\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("function-declaration");
        if (stmt?.kind === "function-declaration") {
            expect(stmt.params).toHaveLength(0);
            expect(stmt.body.body).toHaveLength(1);
        }
    });

    it("parses a multi-line body that uses a leading-operator continuation", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf_or(a, b) =>\n    a\n        or b\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("function-declaration");
        if (stmt?.kind === "function-declaration") {
            expect(stmt.body.body).toHaveLength(1);
            const only = stmt.body.body[0];
            expect(only.kind).toBe("expression-statement");
            if (only.kind === "expression-statement") {
                expect(only.expression.kind).toBe("binary-expression");
            }
        }
    });

    it("drops a typed parameter to its bare name with a warning", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(float x) => x\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("function-declaration");
        if (stmt?.kind === "function-declaration") {
            expect(stmt.params.map((p) => p.name)).toEqual(["x"]);
        }
        expect(ctx.diagnostics.map((d) => d.code)).toContain(
            "pine-converter/parse/udf-typed-param-unsupported",
        );
    });

    it("keeps a parameter whose name matches a type keyword (no false typed-param)", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(line) => line\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("function-declaration");
        if (stmt?.kind === "function-declaration") {
            expect(stmt.params.map((p) => p.name)).toEqual(["line"]);
        }
        expect(ctx.diagnostics).toHaveLength(0);
    });

    it("rejects a defaulted parameter and skips the whole declaration", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(x, y = 2) => x\n");
        expect(parseStatement(ctx)).toBeNull();
        expect(ctx.diagnostics.map((d) => d.code)).toContain(
            "pine-converter/parse/udf-param-default-unsupported",
        );
    });

    it("rejects a non-identifier parameter and recovers", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(1 + 2) => x\n");
        expect(parseStatement(ctx)).toBeNull();
        expect(ctx.diagnostics.map((d) => d.code)).toContain("pine-converter/parse/expected-token");
    });

    it("rejects a trailing-comma parameter list and recovers", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(a,) => x\n");
        expect(parseStatement(ctx)).toBeNull();
        expect(ctx.diagnostics.map((d) => d.code)).toContain("pine-converter/parse/expected-token");
    });

    it("recovers a multi-line malformed decl by draining its indented block", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(a,) =>\n    x = 1\nplot(close)\n");
        expect(parseStatement(ctx)).toBeNull();
        // Recovery drained the head line + the indented body; the next sibling
        // statement (`plot(close)`) still parses.
        const next = parseStatement(ctx);
        expect(next?.kind).toBe("expression-statement");
    });

    it("recognizes a nested-paren head but rejects its non-identifier param", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf((a)) => x\n");
        expect(parseStatement(ctx)).toBeNull();
        expect(ctx.diagnostics.map((d) => d.code)).toContain("pine-converter/parse/expected-token");
    });

    it("leaves a standalone call (no `=>`) as an expression statement", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(e, 2)\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("expression-statement");
    });

    it("leaves an assignment whose RHS is a call unchanged", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ns = cf(e, 2)\n");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("assignment");
    });

    it("treats an unclosed head as an expression, not a declaration", () => {
        const { ctx } = bodyOf("//@version=6\nindicator()\ncf(a");
        const stmt = parseStatement(ctx);
        expect(stmt?.kind).toBe("expression-statement");
    });
});
