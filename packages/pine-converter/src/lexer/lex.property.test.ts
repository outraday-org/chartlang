// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { lex } from "./lex.js";
import type { TokenKind } from "./tokens.js";

// Pinned seed: deterministic across runs so a flaky failure reproduces
// identically for everyone.
const SEED = 0x1c0de;

const STRUCTURAL: ReadonlySet<TokenKind> = new Set(["indent", "dedent", "newline", "eof"]);

// A vocabulary of Pine-ish lexemes that round-trips through the scanner
// without merging adjacent tokens — separated by single spaces so the
// whitespace-stripped reassembly property holds.
const lexeme = fc.constantFrom(
    "indicator",
    "close",
    "if",
    "and",
    "123",
    "1.5",
    "0xFF",
    "'hi'",
    "#FF8800",
    "+",
    "==",
    ":=",
    "(",
    ")",
    ",",
    ".",
);

describe("lex — properties", () => {
    it("reassembles non-structural token text into a whitespace-stripped substring of source", () => {
        fc.assert(
            fc.property(fc.array(lexeme, { minLength: 1, maxLength: 20 }), (parts) => {
                const source = parts.join(" ");
                const { tokens } = lex(source);
                const reassembled = tokens
                    .filter((t) => !STRUCTURAL.has(t.kind))
                    .map((t) => t.text)
                    .join("");
                expect(reassembled).toBe(source.replace(/\s+/g, ""));
            }),
            { seed: SEED },
        );
    });

    it("gives every token a contiguous, well-ordered source span", () => {
        fc.assert(
            fc.property(fc.array(lexeme, { minLength: 1, maxLength: 20 }), (parts) => {
                const source = parts.join(" ");
                const { tokens } = lex(source);
                for (const token of tokens) {
                    const { startLine, startColumn, endLine, endColumn } = token.span;
                    expect(startLine).toBeGreaterThanOrEqual(1);
                    expect(startColumn).toBeGreaterThanOrEqual(1);
                    expect(endLine).toBeGreaterThanOrEqual(startLine);
                    if (endLine === startLine) {
                        expect(endColumn).toBeGreaterThanOrEqual(startColumn);
                    }
                }
            }),
            { seed: SEED },
        );
    });

    it("always terminates with exactly one eof and balances indent/dedent", () => {
        fc.assert(
            fc.property(fc.array(lexeme, { minLength: 0, maxLength: 20 }), (parts) => {
                const source = parts.join(" ");
                const { tokens } = lex(source);
                const eofs = tokens.filter((t) => t.kind === "eof");
                expect(eofs).toHaveLength(1);
                expect(tokens[tokens.length - 1]?.kind).toBe("eof");
                const indents = tokens.filter((t) => t.kind === "indent").length;
                const dedents = tokens.filter((t) => t.kind === "dedent").length;
                expect(indents).toBe(dedents);
            }),
            { seed: SEED },
        );
    });
});
