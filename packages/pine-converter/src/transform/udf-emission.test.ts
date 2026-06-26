// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Declaration } from "../ast/script.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import { transformDeclaration } from "./declaration.js";
import { DiagnosticCollector } from "./diagnosticCollector.js";
import { transformInputs } from "./inputs.js";
import type { ScriptScaffold } from "./ir.js";
import { transformOther } from "./other.js";

type ConvertibleDecl = Extract<
    Declaration,
    { kind: "indicator-declaration" | "strategy-declaration" }
>;

function run(body: string): { scaffold: ScriptScaffold; diagnostics: DiagnosticCollector } {
    const src = `//@version=6\nindicator("X")\n${body}\n`;
    const analysis = analyze(parseStatements(lex(src).tokens).script);
    const decl = analysis.script.declaration;
    if (
        decl === null ||
        decl.kind === "library-declaration" ||
        decl.kind === "import-declaration"
    ) {
        throw new Error("expected an indicator declaration in the fixture");
    }
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(decl as ConvertibleDecl, analysis, diagnostics);
    transformInputs(analysis, scaffold, diagnostics);
    transformOther(analysis, scaffold, diagnostics);
    return { scaffold, diagnostics };
}

function stmts(body: string): readonly string[] {
    return run(body).scaffold.computeBody.statements;
}

function codes(body: string): string[] {
    return run(body)
        .diagnostics.toArray()
        .map((d) => d.code);
}

const EMITTED = "pine-converter/transform/udf-emitted-function";

describe("transformOther — pure UDF emission", () => {
    it("emits a single-expression pure UDF as an expression-bodied arrow before its call site", () => {
        expect(stmts("cf_add(a, b) => a + b\nv = close\ny = cf_add(v, 2)\nplot(y)")).toEqual([
            "const cf_add = (a: number, b: number) => a + b;",
            "let v = bar.close;",
            "let y = cf_add(v, 2);",
            "plot(y);",
        ]);
    });

    it("raises one udf-emitted-function info per pure UDF", () => {
        expect(codes("cf_add(a, b) => a + b\nplot(cf_add(close, 2))")).toEqual([EMITTED]);
    });

    it("emits a multi-line pure UDF as a block arrow with a `let` local and an implicit return", () => {
        expect(
            stmts(
                "cf_limit(input_val, upper_limit, lower_limit) =>\n" +
                    "    input_limited = math.max(math.min(input_val, upper_limit), lower_limit)\n" +
                    "x = cf_limit(close, 1, -1)\nplot(x)",
            ),
        ).toEqual([
            "const cf_limit = (input_val: number, upper_limit: number, lower_limit: number) => { " +
                "let input_limited = Math.max(Math.min(input_val, upper_limit), lower_limit); " +
                "return input_limited; };",
            "let x = cf_limit(bar.close, 1, -1);",
            "plot(x);",
        ]);
    });

    it("lowers several typed intermediate locals then returns the final expression", () => {
        expect(
            stmts(
                "gd(val) =>\n" +
                    "    float a = math.abs(val)\n" +
                    "    int t = math.round(80 - (a * 80))\n" +
                    "    a + t\n" +
                    "plot(gd(close))",
            ),
        ).toEqual([
            "const gd = (val: number) => { let a = Math.abs(val); let t = Math.round(80 - (a * 80)); return a + t; };",
            "plot(gd(bar.close));",
        ]);
    });

    it("keeps param refs verbatim but rewrites an input passed as an arg in the caller", () => {
        expect(stmts("len = input.int(20)\ncf(x) => x + 1\nplot(cf(len))")).toEqual([
            "const cf = (x: number) => x + 1;",
            "plot(cf((inputs.len as number)));",
        ]);
    });

    it("emits a pure UDF that calls another pure UDF after its callee", () => {
        expect(stmts("cf_b(x) => x * 2\ncf_a(x) => cf_b(x) + 1\nplot(cf_a(close))")).toEqual([
            "const cf_b = (x: number) => x * 2;",
            "const cf_a = (x: number) => cf_b(x) + 1;",
            "plot(cf_a(bar.close));",
        ]);
    });

    it("emits a shared callee once when two pure UDFs depend on it (diamond)", () => {
        expect(
            stmts(
                "u(x) => x + 1\na(x) => u(x) * 2\nb(x) => u(x) * 3\n" +
                    "m(x) => a(x) + b(x)\nplot(m(close))",
            ),
        ).toEqual([
            "const u = (x: number) => x + 1;",
            "const a = (x: number) => u(x) * 2;",
            "const b = (x: number) => u(x) * 3;",
            "const m = (x: number) => a(x) + b(x);",
            "plot(m(bar.close));",
        ]);
    });

    it("ignores a bare non-UDF callee (`nz`) in the call graph and stays pure", () => {
        expect(stmts("cf_n(x) => nz(x) + 1\nplot(cf_n(close))")).toEqual([
            "const cf_n = (x: number) => math.nz(x) + 1;",
            "plot(cf_n(bar.close));",
        ]);
    });

    it("lowers a reassigned body local with a `let` declaration and a compound reassignment", () => {
        expect(stmts("acc(a) =>\n    s = a\n    s += a\n    s\nplot(acc(close))")).toEqual([
            "const acc = (a: number) => { let s = a; s += a; return s; };",
            "plot(acc(bar.close));",
        ]);
    });

    it("lowers `:=` and `=` body reassignments to plain assignments", () => {
        expect(
            stmts(
                "cf_multi(a) =>\n    r = a\n    r := r + 1\n    r = r * 2\n    r\nplot(cf_multi(close))",
            ),
        ).toEqual([
            "const cf_multi = (a: number) => { let r = a; r = r + 1; r = r * 2; return r; };",
            "plot(cf_multi(bar.close));",
        ]);
    });

    it("routes UDF-body control flow through the statement lowering with no return value", () => {
        expect(
            stmts(
                "cf_pick(a, b, c) =>\n    r = a\n    if c\n        r := b\n    r\n" +
                    "plot(cf_pick(close, open, high > low))",
            ),
        ).toEqual([
            "const cf_pick = (a: number, b: number, c: number) => { let r = a; if (c) { r = b; } return r; };",
            "plot(cf_pick(bar.close, bar.open, bar.high > bar.low));",
        ]);
    });

    it("emits a non-final bare expression statement as a statement, not a return", () => {
        expect(stmts("cf_x(a) =>\n    nz(a)\n    a + 1\nplot(cf_x(close))")).toEqual([
            "const cf_x = (a: number) => { math.nz(a); return a + 1; };",
            "plot(cf_x(bar.close));",
        ]);
    });

    it("does NOT emit a stateful UDF as a reusable function (inlined at the call site)", () => {
        // A stateful UDF is never a hoisted `const` — `emitPureUdfs` excludes it
        // (no `udf-emitted-function`) and the inline path expands it at the call
        // site (`udfInline.ts`), so the call lowers to the body, not `cf_s(...)`.
        const result = run("cf_s(x) => ta.ema(x, 5)\nplot(cf_s(close))");
        expect(result.scaffold.computeBody.statements).toEqual([
            "plot(ta.ema(bar.close, 5).current);",
        ]);
        expect(result.diagnostics.toArray().map((d) => d.code)).not.toContain(EMITTED);
    });

    it("emits only the last of two same-named UDF declarations", () => {
        expect(codes("f(x) => x + 1\nf(x) => x + 2\nplot(f(close))")).toEqual([EMITTED]);
        expect(stmts("f(x) => x + 1\nf(x) => x + 2\nplot(f(close))")).toEqual([
            "const f = (x: number) => x + 2;",
            "plot(f(bar.close));",
        ]);
    });
});
