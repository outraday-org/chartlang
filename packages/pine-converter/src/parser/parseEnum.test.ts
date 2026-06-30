// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { EnumDeclaration, Script } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "./parse.js";

const HEADER = "//@version=6\nindicator('a')\n";

function parse(source: string): ReturnType<typeof parseStatements> {
    return parseStatements(lex(source).tokens);
}

function enumDeclaration(script: Script): EnumDeclaration | undefined {
    return script.body.find((stmt) => stmt.kind === "enum-declaration");
}

describe("parseStatements — enum declarations", () => {
    it("parses a native enum with valued and unvalued members", () => {
        const result = parse(
            `${HEADER}enum Signal\n    buy = "Buy Signal"\n    sell = "Sell Signal"\n    flat\n`,
        );
        const decl = enumDeclaration(result.script);

        expect(result.diagnostics).toHaveLength(0);
        expect(decl).toEqual({
            kind: "enum-declaration",
            name: "Signal",
            members: [
                {
                    name: "buy",
                    value: "Buy Signal",
                    span: { startLine: 4, startColumn: 5, endLine: 4, endColumn: 23 },
                },
                {
                    name: "sell",
                    value: "Sell Signal",
                    span: { startLine: 5, startColumn: 5, endLine: 5, endColumn: 25 },
                },
                {
                    name: "flat",
                    value: null,
                    span: { startLine: 6, startColumn: 5, endLine: 6, endColumn: 9 },
                },
            ],
            span: { startLine: 3, startColumn: 1, endLine: 7, endColumn: 1 },
        });
    });

    it("rejects a missing enum name and recovers the body", () => {
        const result = parse(`${HEADER}enum\n    buy\nx = close\n`);

        expect(enumDeclaration(result.script)).toBeUndefined();
        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/parse/expected-token",
        );
        expect(result.script.body.some((stmt) => stmt.kind === "assignment")).toBe(true);
    });

    it("rejects an empty enum body", () => {
        const result = parse(`${HEADER}enum Signal\nx = close\n`);

        expect(enumDeclaration(result.script)).toBeUndefined();
        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/parse/expected-token",
        );
    });

    it("rejects an enum body on the same line as the head", () => {
        const result = parse(`${HEADER}enum Signal buy\nx = close\n`);

        expect(enumDeclaration(result.script)).toBeUndefined();
        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/parse/expected-token",
        );
    });

    it("rejects an indented enum body with no members", () => {
        const result = parse(`${HEADER}enum Signal\n    // no members\nx = close\n`);

        expect(enumDeclaration(result.script)).toBeUndefined();
        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/parse/expected-token",
        );
    });

    it("reports a non-string member value and continues with later members", () => {
        const result = parse(`${HEADER}enum Signal\n    buy = 1\n    sell = "Sell Signal"\n`);
        const decl = enumDeclaration(result.script);

        expect(result.diagnostics.map((diag) => diag.code)).toContain(
            "pine-converter/parse/unsupported-enum-member",
        );
        expect(decl?.members).toEqual([
            {
                name: "sell",
                value: "Sell Signal",
                span: { startLine: 5, startColumn: 5, endLine: 5, endColumn: 25 },
            },
        ]);
    });

    it("rejects an enum body with only malformed members", () => {
        const result = parse(`${HEADER}enum Signal\n    1\n`);

        expect(enumDeclaration(result.script)).toBeUndefined();
        expect(result.diagnostics.map((diag) => diag.code)).toEqual([
            "pine-converter/parse/unsupported-enum-member",
            "pine-converter/parse/expected-token",
        ]);
    });
});
