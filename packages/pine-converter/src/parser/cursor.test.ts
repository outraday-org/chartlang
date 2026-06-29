// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { SourceSpan } from "../index.js";
import type { Token, TokenKind } from "../lexer/index.js";
import { createCursor } from "./cursor.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };

function tok(kind: TokenKind, text: string): Token {
    return { kind, text, span: SPAN };
}

const EOF = tok("eof", "");

describe("createCursor", () => {
    it("skips comment tokens transparently on peek and next", () => {
        const cursor = createCursor([
            tok("comment", "// a"),
            tok("identifier", "x"),
            tok("comment", "// b"),
            EOF,
        ]);
        expect(cursor.peek().text).toBe("x");
        expect(cursor.peekKind()).toBe("identifier");
        expect(cursor.next().text).toBe("x");
        expect(cursor.atEnd()).toBe(true);
    });

    it("parks on eof and never advances past it", () => {
        const cursor = createCursor([tok("identifier", "x"), EOF]);
        cursor.next();
        expect(cursor.atEnd()).toBe(true);
        const first = cursor.next();
        const second = cursor.next();
        expect(first.kind).toBe("eof");
        expect(second.kind).toBe("eof");
    });

    it("peekAhead returns the nth significant token, skipping comments", () => {
        const cursor = createCursor([
            tok("identifier", "a"),
            tok("comment", "// c"),
            tok("operator", "="),
            tok("int", "1"),
            EOF,
        ]);
        expect(cursor.peekAhead(0).text).toBe("a");
        expect(cursor.peekAhead(1).text).toBe("=");
        expect(cursor.peekAhead(2).text).toBe("1");
    });

    it("peekAhead clamps to the trailing eof past the end", () => {
        const cursor = createCursor([tok("identifier", "a"), EOF]);
        expect(cursor.peekAhead(5).kind).toBe("eof");
    });

    it("match consumes only on a kind (and optional text) hit", () => {
        const cursor = createCursor([tok("operator", ":="), tok("identifier", "y"), EOF]);
        expect(cursor.match("operator", "=")).toBeNull();
        expect(cursor.match("operator", ":=")?.text).toBe(":=");
        expect(cursor.match("identifier")?.text).toBe("y");
    });

    it("expect mirrors match — null on a miss, token on a hit", () => {
        const cursor = createCursor([tok("punctuation", "("), EOF]);
        expect(cursor.expect("punctuation", ")")).toBeNull();
        expect(cursor.expect("punctuation", "(")?.text).toBe("(");
    });

    it("skipNewlines drops a run of newlines (and interleaved comments)", () => {
        const cursor = createCursor([
            tok("comment", "// a"),
            tok("newline", "\n"),
            tok("newline", "\n"),
            tok("comment", "// b"),
            tok("newline", "\n"),
            tok("version-directive", "//@version=6"),
            EOF,
        ]);
        cursor.skipNewlines();
        expect(cursor.peekKind()).toBe("version-directive");
    });

    it("skipNewlines is a no-op when the current token is not a newline", () => {
        const cursor = createCursor([tok("indent", ""), EOF]);
        cursor.skipNewlines();
        expect(cursor.peekKind()).toBe("indent");
    });

    it("recover skips tokens until a stop kind or eof", () => {
        const cursor = createCursor([
            tok("identifier", "junk"),
            tok("operator", "+"),
            tok("newline", "\n"),
            tok("identifier", "next"),
            EOF,
        ]);
        cursor.recover(new Set<TokenKind>(["newline"]));
        expect(cursor.peekKind()).toBe("newline");
    });

    it("recover halts at eof when no stop kind is present", () => {
        const cursor = createCursor([tok("identifier", "junk"), EOF]);
        cursor.recover(new Set<TokenKind>(["newline"]));
        expect(cursor.atEnd()).toBe(true);
    });
});
