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

    it("lowers str.split to the native split", () => {
        expect(emitStr(call('str.split(sym, ",")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.split(",")',
        });
    });

    it("lowers str.replace_all to the native replaceAll", () => {
        expect(emitStr(call('str.replace_all(sym, "X", "Y")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.replaceAll("X", "Y")',
        });
    });

    it("lowers str.startswith / str.endswith / str.pos", () => {
        expect(emitStr(call('str.startswith(sym, "BTC")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.startsWith("BTC")',
        });
        expect(emitStr(call('str.endswith(sym, "USD")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.endsWith("USD")',
        });
        expect(emitStr(call('str.pos(sym, ":")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.indexOf(":")',
        });
    });

    it("lowers str.trim to the native trim", () => {
        expect(emitStr(call("str.trim(sym)"), CTX)).toEqual({
            kind: "code",
            source: "sym.trim()",
        });
    });

    it("lowers str.tonumber to Number(...)", () => {
        expect(emitStr(call("str.tonumber(sym)"), CTX)).toEqual({
            kind: "code",
            source: "Number(sym)",
        });
    });

    it("lowers str.substring with 2 and 3 args", () => {
        expect(emitStr(call("str.substring(sym, 1)"), CTX)).toEqual({
            kind: "code",
            source: "sym.substring(1)",
        });
        expect(emitStr(call("str.substring(sym, 1, 4)"), CTX)).toEqual({
            kind: "code",
            source: "sym.substring(1, 4)",
        });
    });

    it("lowers str.repeat 2-arg and 3-arg empty separator", () => {
        expect(emitStr(call("str.repeat(sym, 3)"), CTX)).toEqual({
            kind: "code",
            source: "sym.repeat(3)",
        });
        expect(emitStr(call('str.repeat(sym, 3, "")'), CTX)).toEqual({
            kind: "code",
            source: "sym.repeat(3)",
        });
    });

    it("warns on str.repeat with a non-empty separator", () => {
        expect(emitStr(call('str.repeat(sym, 3, "-")'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
    });

    it("lowers str.replace (no occurrence and literal-0 occurrence)", () => {
        expect(emitStr(call('str.replace(sym, "X", "Y")'), CTX)).toEqual({
            kind: "code",
            source: 'sym.replace("X", "Y")',
        });
        expect(emitStr(call('str.replace(sym, "X", "Y", 0)'), CTX)).toEqual({
            kind: "code",
            source: 'sym.replace("X", "Y")',
        });
        expect(emitStr(call('str.replace(sym, "X", "Y", +0)'), CTX)).toEqual({
            kind: "code",
            source: 'sym.replace("X", "Y")',
        });
        expect(emitStr(call('str.replace(sym, "X", "Y", 0.0)'), CTX)).toEqual({
            kind: "code",
            source: 'sym.replace("X", "Y")',
        });
    });

    it("warns on str.replace with a non-zero / non-literal occurrence", () => {
        expect(emitStr(call('str.replace(sym, "X", "Y", 1)'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call('str.replace(sym, "X", "Y", n)'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call('str.replace(sym, "X", "Y", "0")'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
    });

    it("rejects str.match and str.format_time as str-not-mapped", () => {
        expect(emitStr(call('str.match(sym, "[0-9]+")'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call('str.format_time(time, "yyyy")'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
    });

    it("warns when the new custom-helper members are missing required args", () => {
        expect(emitStr(call("str.substring(sym)"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call("str.repeat(sym)"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call('str.replace(sym, "X")'), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
    });

    it("warns str-format-not-mapped for the deferred mintick form", () => {
        expect(emitStr(call("str.tostring(close, format.mintick)"), CTX)).toEqual({
            kind: "warn",
            code: "str-format-not-mapped",
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
        expect(emitStr(call("str.fizz(sym)"), CTX)).toEqual({
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
        expect(emitStr(call("str.split(sym)"), CTX)).toEqual({
            kind: "warn",
            code: "str-not-mapped",
        });
        expect(emitStr(call('str.replace_all(sym, "X")'), CTX)).toEqual({
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
