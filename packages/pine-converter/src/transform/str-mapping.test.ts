// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { CallExpression } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import type { EmitContext } from "./emitContext.js";
import { emitStr, parsePineFormat } from "./strFormat.js";

const CTX: EmitContext = {
    annotations: new Map(),
    inputNames: new Set(),
    localNames: new Set(),
    stateSlots: new Map(),
};

// Parse the first statement's expression as a call (the str.* fixture).
function call(expr: string): CallExpression {
    const src = `//@version=6\nindicator("X")\nv = ${expr}\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    for (const stmt of script.body) {
        if (stmt.kind === "assignment" && stmt.value.kind === "call-expression") {
            return stmt.value;
        }
    }
    throw new Error("no call expression in fixture");
}

describe("parsePineFormat", () => {
    it("counts fractional digits in a precision mask", () => {
        expect(parsePineFormat("#.##")).toBe(2);
        expect(parsePineFormat("0.0")).toBe(1);
        expect(parsePineFormat("#")).toBe(0);
        expect(parsePineFormat("0")).toBe(0);
    });

    it("returns null for a grouped / non-mask format", () => {
        expect(parsePineFormat("#,###")).toBeNull();
        expect(parsePineFormat("{0}")).toBeNull();
        expect(parsePineFormat("#.#.#")).toBeNull();
    });
});

describe("emitStr", () => {
    it("returns null for a non-str.* call", () => {
        expect(emitStr(call("ta.ema(close, 9)"), CTX)).toBeNull();
    });

    it("lowers str.tostring(x) to String(x)", () => {
        expect(emitStr(call("str.tostring(close)"), CTX)).toEqual({
            kind: "code",
            source: "String(bar.close)",
        });
    });

    it("lowers str.tostring(x, mask) to toFixed", () => {
        expect(emitStr(call('str.tostring(close, "#.##")'), CTX)).toEqual({
            kind: "code",
            source: "(bar.close).toFixed(2)",
        });
    });

    it("warns on a non-string-literal format arg", () => {
        expect(emitStr(call("str.tostring(close, fmt)"), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
    });

    it("warns on an unmappable format mask", () => {
        expect(emitStr(call('str.tostring(close, "#,###")'), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
    });

    it("lowers str.length / str.upper / str.lower", () => {
        expect(emitStr(call("str.length(sym)"), CTX)).toEqual({
            kind: "code",
            source: "sym.length",
        });
        expect(emitStr(call("str.upper(sym)"), CTX)).toEqual({
            kind: "code",
            source: "sym.toUpperCase()",
        });
        expect(emitStr(call("str.lower(sym)"), CTX)).toEqual({
            kind: "code",
            source: "sym.toLowerCase()",
        });
    });

    it("lowers str.contains to includes", () => {
        expect(emitStr(call('str.contains(sym, "BTC")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.includes("BTC")',
        });
    });

    it("synthesises a template literal for str.format", () => {
        expect(emitStr(call('str.format("a={0} b={1}", close, open)'), CTX)).toEqual({
            kind: "code",
            source: "`a=${bar.close} b=${bar.open}`",
        });
    });

    it("escapes template metacharacters in the format string", () => {
        expect(emitStr(call('str.format("p`{0}", close)'), CTX)).toEqual({
            kind: "code",
            source: "`p\\`${bar.close}`",
        });
    });

    it("warns on a styled / out-of-range str.format placeholder", () => {
        expect(emitStr(call('str.format("{0,number}", close)'), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
        expect(emitStr(call('str.format("{5}", close)'), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
    });

    it("warns on an unterminated str.format placeholder", () => {
        expect(emitStr(call('str.format("{0", close)'), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
    });

    it("warns str-not-mapped for an unknown str.* member", () => {
        expect(emitStr(call("str.replace_all(sym, a, b)"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
    });

    it("warns when required args are missing", () => {
        expect(emitStr(call("str.tostring()"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call("str.length()"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call("str.contains(sym)"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call("str.format()"), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
    });

    it("warns when str.format's template is not a literal", () => {
        expect(emitStr(call("str.format(tmpl, close)"), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
        });
    });
});
