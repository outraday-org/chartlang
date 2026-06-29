// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { Statement } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "./parse.js";

function parse(source: string) {
    return parseStatements(lex(source).tokens);
}

function codes(result: ReturnType<typeof parse>): string[] {
    return result.diagnostics.map((d) => d.code);
}

function firstBody(source: string): readonly Statement[] {
    return parse(source).script.body;
}

describe("parseStatements — declarations", () => {
    it("parses an indicator-only script with zero diagnostics", () => {
        const result = parse('//@version=6\nindicator("hi")\n');
        expect(result.diagnostics).toHaveLength(0);
        expect(result.script.version?.version).toBe(6);
        expect(result.script.declaration?.kind).toBe("indicator-declaration");
        expect(result.script.body).toHaveLength(0);
    });

    it("parses named + positional declaration arguments", () => {
        const result = parse('//@version=6\nindicator("hi", overlay = true)\n');
        const decl = result.script.declaration;
        expect(decl?.kind).toBe("indicator-declaration");
        if (decl?.kind === "indicator-declaration") {
            expect(decl.args).toHaveLength(2);
            expect(decl.args[0].name).toBeNull();
            expect(decl.args[1].name).toBe("overlay");
        }
    });

    it("rejects strategy() with exactly one unsupported-strategy diagnostic", () => {
        const result = parse('//@version=6\nstrategy("x")\n');
        expect(result.script.declaration?.kind).toBe("strategy-declaration");
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-strategy"]);
    });

    it("rejects library() with exactly one unsupported-library diagnostic", () => {
        const result = parse('//@version=6\nlibrary("x")\n');
        expect(result.script.declaration?.kind).toBe("library-declaration");
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-library"]);
    });

    it("emits missing-version-directive when the script omits //@version", () => {
        const result = parse('indicator("hi")\n');
        expect(codes(result)).toContain("pine-converter/parse/missing-version-directive");
        expect(result.script.declaration?.kind).toBe("indicator-declaration");
    });

    it("emits unsupported-pine-version when the directive is not v6", () => {
        const result = parse('//@version=5\nindicator("hi")\n');
        expect(codes(result)).toContain("pine-converter/parse/unsupported-pine-version");
        expect(result.script.version?.version).toBe(5);
    });

    it("recovers from a declaration missing its opening paren", () => {
        const result = parse("//@version=6\nindicator\n");
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
        expect(result.script.declaration?.kind).toBe("indicator-declaration");
    });

    it("recovers from a declaration missing its closing paren", () => {
        const result = parse('//@version=6\nindicator("hi"\n');
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
    });

    it("treats a non-declaration head as the first body statement", () => {
        const result = parse("//@version=6\nx := 1\n");
        expect(result.script.declaration).toBeNull();
        expect(result.script.body[0]?.kind).toBe("assignment");
    });
});

describe("parseStatements — statements", () => {
    it("parses a var declaration with a type annotation", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nvar float total = 0.0\n");
        expect(stmt.kind).toBe("variable-declaration");
        if (stmt.kind === "variable-declaration") {
            expect(stmt.qualifier).toBe("var");
            expect(stmt.typeAnnotation?.kind).toBe("named-type");
            expect(stmt.name).toBe("total");
        }
    });

    it("parses a varip declaration without a type annotation", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nvarip count = 0\n");
        if (stmt.kind === "variable-declaration") {
            expect(stmt.qualifier).toBe("varip");
            expect(stmt.typeAnnotation).toBeNull();
        }
    });

    it("parses a bare typed declaration (no qualifier)", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nfloat x = 1.0\n");
        if (stmt.kind === "variable-declaration") {
            expect(stmt.qualifier).toBe("none");
            expect(stmt.typeAnnotation?.kind).toBe("named-type");
        }
    });

    it("parses := reassignment", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nx := close\n");
        expect(stmt.kind).toBe("assignment");
        if (stmt.kind === "assignment") {
            expect(stmt.operator).toBe(":=");
            expect(stmt.name).toBe("x");
        }
    });

    it("parses = assignment", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\ny = 5\n");
        if (stmt.kind === "assignment") {
            expect(stmt.operator).toBe("=");
        }
    });

    it("parses an expression statement", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nplot(close)\n");
        expect(stmt.kind).toBe("expression-statement");
    });

    it("parses an if / else if / else chain", () => {
        const source =
            "//@version=6\nindicator()\nif a\n    x := 1\nelse if b\n    x := 2\nelse\n    x := 3\n";
        const [stmt] = firstBody(source);
        expect(stmt.kind).toBe("if-statement");
        if (stmt.kind === "if-statement") {
            expect(stmt.thenBody.body).toHaveLength(1);
            expect(stmt.elseIfClauses).toHaveLength(1);
            expect(stmt.elseBody?.body).toHaveLength(1);
        }
    });

    it("parses an if with no else", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nif a\n    x := 1\n");
        if (stmt.kind === "if-statement") {
            expect(stmt.elseIfClauses).toHaveLength(0);
            expect(stmt.elseBody).toBeNull();
        }
    });

    it("parses a literal-bounded for loop with a by step", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nfor i = 0 to 9 by 2\n    x := i\n");
        expect(stmt.kind).toBe("for-statement");
        if (stmt.kind === "for-statement") {
            expect(stmt.variable).toBe("i");
            expect(stmt.step).not.toBeNull();
        }
    });

    it("parses a for loop without a by step", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nfor i = 0 to 9\n    x := i\n");
        if (stmt.kind === "for-statement") {
            expect(stmt.step).toBeNull();
        }
    });

    it("rejects for ... in but continues to the next statement", () => {
        const source = "//@version=6\nindicator()\nfor i in arr\n    x := i\nplot(close)\n";
        const result = parse(source);
        expect(codes(result)).toContain("pine-converter/parse/unsupported-for-in");
        const kinds = result.script.body.map((s) => s.kind);
        expect(kinds).toContain("expression-statement");
    });

    it("recovers from a for loop missing its variable", () => {
        const result = parse("//@version=6\nindicator()\nfor = 0 to 9\n    x := i\n");
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
    });

    it("parses a switch with a subject and a default arm", () => {
        const source =
            "//@version=6\nindicator()\nswitch x\n    1 =>\n        y := 1\n    =>\n        y := 2\n";
        const [stmt] = firstBody(source);
        expect(stmt.kind).toBe("switch-statement");
        if (stmt.kind === "switch-statement") {
            expect(stmt.subject).not.toBeNull();
            expect(stmt.cases).toHaveLength(2);
            expect(stmt.cases[1].test).toBeNull();
        }
    });

    it("parses a subject-less switch with an inline arm body", () => {
        const source = "//@version=6\nindicator()\nswitch\n    cond => y := 1\n";
        const [stmt] = firstBody(source);
        if (stmt.kind === "switch-statement") {
            expect(stmt.subject).toBeNull();
            expect(stmt.cases[0].body).toHaveLength(1);
        }
    });

    it("recovers from a switch missing its indented body", () => {
        const result = parse("//@version=6\nindicator()\nswitch x\n");
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
    });

    it("parses a comma-separated assignment list as a switch arm body", () => {
        const source =
            '//@version=6\nindicator()\nswitch sel\n    "X" => a := 8, b := 21, c := 50\n';
        const result = parse(source);
        expect(result.diagnostics).toHaveLength(0);
        const stmt = result.script.body[0];
        expect(stmt.kind).toBe("switch-statement");
        if (stmt.kind === "switch-statement") {
            const arm = stmt.cases[0];
            expect(arm.body.map((s) => s.kind)).toEqual(["assignment", "assignment", "assignment"]);
        }
    });

    it("parses a multi-assignment arm in a subjectless switch", () => {
        const source = "//@version=6\nindicator()\nswitch\n    cond => a := 1, b := 2\n";
        const result = parse(source);
        expect(result.diagnostics).toHaveLength(0);
        const stmt = result.script.body[0];
        if (stmt.kind === "switch-statement") {
            expect(stmt.subject).toBeNull();
            expect(stmt.cases[0].body).toHaveLength(2);
        }
    });

    it("keeps a single-value switch arm a one-element body", () => {
        const source = "//@version=6\nindicator()\nswitch sel\n    cond => close + 1\n";
        const result = parse(source);
        expect(result.diagnostics).toHaveLength(0);
        const stmt = result.script.body[0];
        if (stmt.kind === "switch-statement") {
            expect(stmt.cases[0].body.map((s) => s.kind)).toEqual(["expression-statement"]);
        }
    });

    it("recovers from a malformed element in a switch arm assignment list", () => {
        const source = "//@version=6\nindicator()\nswitch sel\n    cond => a := 1,, b := 2\n";
        const result = parse(source);
        expect(codes(result)).toContain("pine-converter/parse/unexpected-token");
        const stmt = result.script.body[0];
        if (stmt.kind === "switch-statement") {
            // The first assignment survives; the double comma recovers to the
            // arm boundary (the trailing `b := 2` is discarded by the recover).
            expect(stmt.cases[0].body.map((s) => s.kind)).toEqual(["assignment"]);
        }
    });

    it("tolerates a blank line after the last statement-switch arm", () => {
        // A blank line right after the arms emits a stray `newline` between the
        // arm body and the block `dedent`; the arm loop must skip it instead of
        // parsing it as a malformed arm and cascading into the next statement.
        const source =
            '//@version=6\nindicator()\nswitch sel\n    "X" => a := 1\n\nb = close\nplot(b)\n';
        const result = parse(source);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.script.body.map((s) => s.kind)).toEqual([
            "switch-statement",
            "assignment",
            "expression-statement",
        ]);
    });

    it("tolerates a comment-only line after the last statement-switch arm", () => {
        const source =
            '//@version=6\nindicator()\nswitch sel\n    "X" => a := 1\n// trailing note\nb = close\nplot(b)\n';
        const result = parse(source);
        expect(result.diagnostics).toHaveLength(0);
        const stmt = result.script.body[0];
        expect(stmt.kind).toBe("switch-statement");
        if (stmt.kind === "switch-statement") {
            expect(stmt.cases).toHaveLength(1);
        }
    });

    it("parses break, continue, and return statements", () => {
        const source =
            "//@version=6\nindicator()\nfor i = 0 to 9\n    break\n    continue\nf() =>\n    return 1\n";
        const result = parse(source);
        const loop = result.script.body[0];
        expect(loop.kind).toBe("for-statement");
        if (loop.kind === "for-statement") {
            const kinds = loop.body.body.map((s) => s.kind);
            expect(kinds).toEqual(["break-statement", "continue-statement"]);
        }
    });

    it("parses a bare return with no value", () => {
        const source = "//@version=6\nindicator()\nfor i = 0 to 9\n    return\n";
        const result = parse(source);
        const loop = result.script.body[0];
        if (loop.kind === "for-statement") {
            const ret = loop.body.body[0];
            if (ret.kind === "return-statement") {
                expect(ret.value).toBeNull();
            }
        }
    });

    it("rejects while with unsupported-while and continues", () => {
        const source = "//@version=6\nindicator()\nwhile cond\n    x := 1\nplot(close)\n";
        const result = parse(source);
        expect(codes(result)).toContain("pine-converter/parse/unsupported-while");
        const kinds = result.script.body.map((s) => s.kind);
        expect(kinds).toContain("expression-statement");
    });

    it("rejects a while with no indented body without consuming the next statement", () => {
        const result = parse("//@version=6\nindicator()\nwhile cond\nplot(close)\n");
        expect(codes(result)).toContain("pine-converter/parse/unsupported-while");
        const kinds = result.script.body.map((s) => s.kind);
        expect(kinds).toContain("expression-statement");
    });

    it("discards a rejected while body with nested indentation", () => {
        const source =
            "//@version=6\nindicator()\nwhile cond\n    if a\n        x := 1\nplot(close)\n";
        const result = parse(source);
        expect(codes(result)).toEqual(["pine-converter/parse/unsupported-while"]);
        const kinds = result.script.body.map((s) => s.kind);
        expect(kinds).toEqual(["expression-statement"]);
    });

    it("rejects an unexpected leading keyword", () => {
        const result = parse("//@version=6\nindicator()\nexport foo\n");
        expect(codes(result)).toContain("pine-converter/parse/unexpected-token");
    });

    it("rejects a statement starting with a stray punctuation boundary token", () => {
        const result = parse("//@version=6\nindicator()\n)\n");
        expect(codes(result)).toContain("pine-converter/parse/unexpected-token");
    });

    it("parses a literal-led expression statement", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\n42\n");
        expect(stmt.kind).toBe("expression-statement");
    });

    it("recovers from a var declaration missing its name", () => {
        const result = parse("//@version=6\nindicator()\nvar = 1.0\n");
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
    });

    it("treats a type keyword not followed by an identifier as the variable name", () => {
        const [stmt] = firstBody("//@version=6\nindicator()\nvar float = 1.0\n");
        if (stmt.kind === "variable-declaration") {
            expect(stmt.typeAnnotation).toBeNull();
            expect(stmt.name).toBe("float");
        }
    });

    it("skips a blank line inside an indented block", () => {
        const result = parse("//@version=6\nindicator()\nif a\n    x := 1\n\n    y := 2\n");
        const stmt = result.script.body[0];
        expect(stmt.kind).toBe("if-statement");
        if (stmt.kind === "if-statement") {
            expect(stmt.thenBody.body).toHaveLength(2);
        }
    });

    it("recovers from an if whose body is not indented", () => {
        const result = parse("//@version=6\nindicator()\nif a\nx := 1\n");
        expect(codes(result)).toContain("pine-converter/parse/expected-token");
    });
});
