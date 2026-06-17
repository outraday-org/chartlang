// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { lex } from "./lex.js";
import type { Token, TokenKind } from "./tokens.js";

function kinds(tokens: readonly Token[]): TokenKind[] {
    return tokens.map((t) => t.kind);
}

function texts(tokens: readonly Token[]): string[] {
    return tokens.map((t) => t.text);
}

describe("lex — acceptance fixture", () => {
    it("tokenizes the version directive + indicator call exactly", () => {
        const { tokens, diagnostics } = lex("//@version=6\nindicator('hi')");
        expect(diagnostics).toHaveLength(0);
        expect(kinds(tokens)).toEqual([
            "version-directive",
            "newline",
            "identifier",
            "punctuation",
            "string",
            "punctuation",
            "newline",
            "eof",
        ]);
        expect(tokens[0]?.versionNumber).toBe(6);
        expect(tokens[2]?.text).toBe("indicator");
        expect(tokens[3]?.text).toBe("(");
        expect(tokens[4]?.stringValue).toBe("hi");
        expect(tokens[5]?.text).toBe(")");
        const last = tokens[tokens.length - 1];
        expect(last?.kind).toBe("eof");
    });

    it("balances indent and dedent counts before eof", () => {
        const { tokens } = lex("if true\n    x = 1\n    y = 2\nz = 3");
        const indents = tokens.filter((t) => t.kind === "indent").length;
        const dedents = tokens.filter((t) => t.kind === "dedent").length;
        expect(indents).toBe(dedents);
        expect(indents).toBeGreaterThan(0);
    });
});

describe("lex — keywords and identifiers", () => {
    it("classifies keywords vs identifiers", () => {
        const { tokens } = lex("if and not close");
        expect(kinds(tokens.slice(0, 4))).toEqual(["keyword", "keyword", "keyword", "identifier"]);
    });

    it("treats reserved built-in references as plain identifiers", () => {
        const { tokens } = lex("syminfo");
        expect(tokens[0]?.kind).toBe("identifier");
    });

    it("lexes an identifier containing digits", () => {
        const { tokens } = lex("ma200");
        expect(tokens[0]?.kind).toBe("identifier");
        expect(tokens[0]?.text).toBe("ma200");
    });

    it("lexes member access dots as punctuation", () => {
        const { tokens } = lex("line.new");
        expect(kinds(tokens.slice(0, 3))).toEqual(["identifier", "punctuation", "identifier"]);
        expect(tokens[1]?.text).toBe(".");
    });
});

describe("lex — operators and punctuation", () => {
    it("lexes every operator longest-match-first", () => {
        const src = "+ - * / % == != < <= > >= and or not ? : := => [ ] ( ) { } ,";
        const { tokens } = lex(src);
        const ops = tokens.filter((t) => t.kind === "operator").map((t) => t.text);
        expect(ops).toEqual([
            "+",
            "-",
            "*",
            "/",
            "%",
            "==",
            "!=",
            "<",
            "<=",
            ">",
            ">=",
            "?",
            ":",
            ":=",
            "=>",
        ]);
        const punct = tokens.filter((t) => t.kind === "punctuation").map((t) => t.text);
        expect(punct).toEqual(["[", "]", "(", ")", "{", "}", ","]);
    });

    it("lexes a bare assignment equals as an operator", () => {
        const { tokens } = lex("x = 1");
        expect(tokens[1]?.kind).toBe("operator");
        expect(tokens[1]?.text).toBe("=");
    });
});

describe("lex — numerics", () => {
    it("lexes ints, underscore separators, floats, scientific, and hex", () => {
        const { tokens, diagnostics } = lex("123 1_000_000 1.5 .5 1. 1e3 1.5e-2 0xDEAD");
        expect(diagnostics).toHaveLength(0);
        const nums = tokens.filter((t) => t.kind === "int" || t.kind === "float");
        expect(nums.map((t) => t.kind)).toEqual([
            "int",
            "int",
            "float",
            "float",
            "float",
            "float",
            "float",
            "int",
        ]);
        expect(nums[0]?.numericValue).toBe(123);
        expect(nums[1]?.numericValue).toBe(1_000_000);
        expect(nums[2]?.numericValue).toBe(1.5);
        expect(nums[3]?.numericValue).toBe(0.5);
        expect(nums[5]?.numericValue).toBe(1000);
        expect(nums[6]?.numericValue).toBeCloseTo(0.015);
        expect(nums[7]?.numericValue).toBe(0xdead);
    });

    it("flags 1.2.3 as malformed and emits a NaN token", () => {
        const { tokens, diagnostics } = lex("1.2.3");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/malformed-numeric");
        expect(tokens[0]?.malformed).toBe(true);
        expect(Number.isNaN(tokens[0]?.numericValue ?? 0)).toBe(true);
    });

    it("flags 1e as malformed", () => {
        const { diagnostics } = lex("1e");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/malformed-numeric");
    });

    it("flags 0x with no hex digits as malformed", () => {
        const { tokens, diagnostics } = lex("0x");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/malformed-numeric");
        expect(tokens[0]?.kind).toBe("int");
    });

    it("does not absorb a leading minus into the literal", () => {
        const { tokens } = lex("-5");
        expect(tokens[0]?.kind).toBe("operator");
        expect(tokens[0]?.text).toBe("-");
        expect(tokens[1]?.kind).toBe("int");
    });

    it("accepts uppercase 0X hex and underscore-grouped hex digits", () => {
        const { tokens, diagnostics } = lex("0XDE_AD");
        expect(diagnostics).toHaveLength(0);
        expect(tokens[0]?.kind).toBe("int");
        expect(tokens[0]?.numericValue).toBe(0xdead);
    });

    it("accepts lowercase hex digits", () => {
        const { tokens } = lex("0xabcdef");
        expect(tokens[0]?.numericValue).toBe(0xabcdef);
    });

    it("lexes a bare dot at end of input as punctuation, not a float", () => {
        const { tokens } = lex("a.");
        expect(tokens[1]?.kind).toBe("punctuation");
        expect(tokens[1]?.text).toBe(".");
    });

    it("lexes a positive-signed exponent", () => {
        const { tokens } = lex("1e+3");
        expect(tokens[0]?.kind).toBe("float");
        expect(tokens[0]?.numericValue).toBe(1000);
    });
});

describe("lex — strings", () => {
    it("lexes both quote styles with escapes", () => {
        const { tokens } = lex(`'a\\n\\t\\\\b' "c\\'\\"d"`);
        expect(tokens[0]?.stringValue).toBe("a\n\t\\b");
        expect(tokens[1]?.stringValue).toBe("c'\"d");
    });

    it("decodes hex and unicode escapes", () => {
        const { tokens } = lex(`'\\x41\\u0042'`);
        expect(tokens[0]?.stringValue).toBe("AB");
    });

    it("falls back gracefully on bad hex/unicode/unknown escapes", () => {
        const { tokens } = lex(`'\\xZZ\\uZZZZ\\q'`);
        expect(tokens[0]?.stringValue).toBe("xZZuZZZZq");
    });

    it("falls back on a too-short unicode escape", () => {
        const { tokens } = lex(`'\\u12'`);
        expect(tokens[0]?.stringValue).toBe("u12");
    });

    it("treats a trailing backslash at end of input as an empty escape", () => {
        const { tokens, diagnostics } = lex("'a\\");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/unterminated-string");
        expect(tokens[0]?.stringValue).toBe("a");
    });

    it("flags an unterminated string and captures the bytes so far", () => {
        const { tokens, diagnostics } = lex("'abc");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/unterminated-string");
        expect(tokens[0]?.stringValue).toBe("abc");
    });

    it("stops an unterminated string at the newline", () => {
        const { tokens, diagnostics } = lex("'abc\nx = 1");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/unterminated-string");
        expect(tokens[0]?.stringValue).toBe("abc");
        expect(tokens.some((t) => t.kind === "newline")).toBe(true);
    });
});

describe("lex — colors", () => {
    it("lexes #RRGGBB and #RRGGBBAA", () => {
        const { tokens, diagnostics } = lex("#FF8800 #FF8800AA");
        expect(diagnostics).toHaveLength(0);
        expect(tokens[0]?.kind).toBe("color");
        expect(tokens[1]?.kind).toBe("color");
    });

    it("lexes lowercase hex color digits", () => {
        const { tokens, diagnostics } = lex("#ffaa00");
        expect(diagnostics).toHaveLength(0);
        expect(tokens[0]?.kind).toBe("color");
    });

    it("flags a color glued to an alphanumeric", () => {
        const { tokens, diagnostics } = lex("#FF8800Z");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/invalid-color");
        expect(tokens[0]?.kind).toBe("color");
    });

    it("flags a malformed short color", () => {
        const { diagnostics } = lex("#FFF");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/invalid-color");
    });
});

describe("lex — comments and directives", () => {
    it("lexes a plain line comment", () => {
        const { tokens } = lex("// hello world");
        expect(tokens[0]?.kind).toBe("comment");
    });

    it("lexes a version directive with surrounding whitespace", () => {
        const { tokens } = lex("//@version = 5");
        expect(tokens[0]?.kind).toBe("version-directive");
        expect(tokens[0]?.versionNumber).toBe(5);
    });

    it("does not emit indentation for a comment-only line", () => {
        const { tokens } = lex("if true\n    // note\n    x = 1");
        const indents = tokens.filter((t) => t.kind === "indent").length;
        expect(indents).toBe(1);
    });
});

describe("lex — line continuation", () => {
    it("suppresses newline inside open parentheses", () => {
        const { tokens } = lex("f(\n  a,\n  b)");
        const newlines = tokens.filter((t) => t.kind === "newline").length;
        expect(newlines).toBe(1);
    });

    it("continues a line that ends in a trailing comma", () => {
        const { tokens } = lex("a,\nb");
        const newlinesBeforeEof = tokens.slice(0, -1).filter((t) => t.kind === "newline").length;
        expect(newlinesBeforeEof).toBe(1);
    });

    it("balances brackets to re-enable newlines after close", () => {
        const { tokens } = lex("f(a)\nb");
        const indents = tokens.filter((t) => t.kind === "indent").length;
        expect(indents).toBe(0);
        expect(tokens.filter((t) => t.kind === "newline").length).toBe(2);
    });
});

describe("lex — illegal characters", () => {
    it("flags an unexpected character and continues", () => {
        const { tokens, diagnostics } = lex("a @ b");
        expect(diagnostics[0]?.code).toBe("pine-converter/lex/illegal-character");
        expect(texts(tokens.filter((t) => t.kind === "identifier"))).toEqual(["a", "b"]);
    });
});

describe("lex — eof and structure", () => {
    it("emits exactly one eof at the very end", () => {
        const { tokens } = lex("x = 1\ny = 2\n");
        expect(tokens.filter((t) => t.kind === "eof")).toHaveLength(1);
        expect(tokens[tokens.length - 1]?.kind).toBe("eof");
    });

    it("dedents back to zero at eof", () => {
        const { tokens } = lex("if a\n    if b\n        x = 1");
        const trailing = tokens.slice(-3);
        expect(trailing.map((t) => t.kind)).toEqual(["dedent", "dedent", "eof"]);
    });

    it("handles empty input", () => {
        const { tokens, diagnostics } = lex("");
        expect(kinds(tokens)).toEqual(["eof"]);
        expect(diagnostics).toHaveLength(0);
    });

    it("handles whitespace-and-comment-only input without a trailing newline", () => {
        const { tokens } = lex("  // just a comment");
        expect(tokens.filter((t) => t.kind === "newline")).toHaveLength(0);
        expect(tokens[tokens.length - 1]?.kind).toBe("eof");
    });

    it("ignores carriage returns", () => {
        const { tokens } = lex("x = 1\r\ny = 2");
        expect(tokens.some((t) => t.text === "\r")).toBe(false);
    });
});

describe("lex — inconsistent dedent", () => {
    it("warns when a dedent lands between two enclosing levels", () => {
        const { diagnostics } = lex("if a\n    if b\n        x = 1\n      y = 2");
        const codes = diagnostics.map((d) => d.code);
        expect(codes).toContain("pine-converter/lex/inconsistent-dedent");
    });
});

describe("lex — mixed indentation", () => {
    it("warns once on mixed tabs and spaces and counts tabs as 4", () => {
        const { tokens, diagnostics } = lex("if a\n\t x = 1\n\t y = 2");
        const mixed = diagnostics.filter((d) => d.code === "pine-converter/lex/mixed-indent");
        expect(mixed).toHaveLength(1);
        expect(tokens.filter((t) => t.kind === "indent")).toHaveLength(1);
    });
});
