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
