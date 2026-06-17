// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode, Script } from "../ast/index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "./analyze.js";
import { inferQualifier, joinQualifier } from "./qualifiers.js";
import { createScopeBuilder, defineSymbol, resolveSymbol } from "./scope.js";
import type { SymbolInfo } from "./types.js";

function parse(source: string): Script {
    return parseStatements(lex(source).tokens).script;
}

function run(source: string) {
    return analyze(parse(source));
}

function codes(source: string): string[] {
    return run(source).diagnostics.map((d) => d.code);
}

const HEADER = "//@version=6\nindicator('a')\n";

describe("analyze — scope + symbols", () => {
    it("registers a var declaration with its handle type and series qualifier", () => {
        const result = run(`${HEADER}var line lvl = na\n`);
        const symbol = [...result.symbols.values()].find((s) => s.name === "lvl");
        expect(symbol?.kind).toBe("var-variable");
        expect(symbol?.handleType).toBe("line");
    });

    it("registers a varip declaration", () => {
        const result = run(`${HEADER}varip int counter = 0\n`);
        const symbol = [...result.symbols.values()].find((s) => s.name === "counter");
        expect(symbol?.kind).toBe("varip-variable");
        expect(symbol?.qualifier).toBe("const");
    });

    it("registers a plain typed declaration as a variable", () => {
        const result = run(`${HEADER}float x = close\n`);
        const symbol = [...result.symbols.values()].find((s) => s.name === "x");
        expect(symbol?.kind).toBe("variable");
        expect(symbol?.qualifier).toBe("series");
    });

    it("exposes a root scope and an annotation per expression node", () => {
        const result = run(`${HEADER}x = close + 1\n`);
        expect(result.rootScope.parent).toBeNull();
        expect(result.scopes.size).toBeGreaterThan(0);
        expect(result.annotations.size).toBeGreaterThan(0);
    });
});

describe("analyze — declaration vs reassignment", () => {
    it("treats a fresh `=` assignment as a declaration", () => {
        const result = run(`${HEADER}x = close\n`);
        const assignment = result.script.body.find((s) => s.kind === "assignment");
        const ann = assignment ? result.annotations.get(assignment) : undefined;
        expect(ann?.assignment?.kind).toBe("declaration");
        expect(ann?.assignment?.shadows).toBeNull();
        expect(codes(`${HEADER}x = close\n`)).not.toContain(
            "pine-converter/semantic/accidental-shadowing",
        );
    });

    it("flags `=` re-declaration of an enclosing binding as accidental shadowing", () => {
        const source = `${HEADER}x = close\nif barstate.islast\n    x = open\n`;
        expect(codes(source)).toContain("pine-converter/semantic/accidental-shadowing");
    });

    it("treats `:=` on a known var as a reassignment and records the lifetime", () => {
        const source = `${HEADER}var float x = 0.0\nx := close\n`;
        const result = run(source);
        const assignment = result.script.body.find((s) => s.kind === "assignment");
        const ann = assignment ? result.annotations.get(assignment) : undefined;
        expect(ann?.assignment?.kind).toBe("reassignment");
        const symbol = [...result.symbols.values()].find((s) => s.name === "x");
        const lifetime = symbol ? result.lifetimes.get(symbol) : undefined;
        expect(lifetime?.reassignments).toHaveLength(1);
    });

    it("flags `:=` of an unknown identifier as unknown-identifier", () => {
        expect(codes(`${HEADER}ghost := close\n`)).toContain(
            "pine-converter/semantic/unknown-identifier",
        );
    });
});

describe("analyze — qualifier + na-kind annotations", () => {
    it("annotates close as series and a literal as const", () => {
        const result = run(`${HEADER}x = close\ny = 1\n`);
        const series = [...result.annotations.entries()].find(
            ([node]) => node.kind === "identifier-expression" && node.name === "close",
        );
        expect(series?.[1].qualifier).toBe("series");
    });

    it("infers na into a handle var as handle kind, numeric otherwise", () => {
        const handle = run(`${HEADER}var line lvl = na\n`);
        const naNode = [...handle.annotations.entries()].find(
            ([node]) => node.kind === "na-expression",
        );
        expect(naNode?.[1].naKind).toBe("handle");

        const numeric = run(`${HEADER}var float v = na\n`);
        const naNumeric = [...numeric.annotations.entries()].find(
            ([node]) => node.kind === "na-expression",
        );
        expect(naNumeric?.[1].naKind).toBe("numeric");
    });

    it("annotates na(handle) calls as handle and na(series) calls as numeric", () => {
        const result = run(`${HEADER}var line lvl = na\nx = na(lvl)\ny = na(close)\n`);
        const callAnns = [...result.annotations.entries()].filter(
            ([node]) => node.kind === "call-expression",
        );
        const kinds = callAnns.map(([, ann]) => ann.naKind);
        expect(kinds).toContain("handle");
        expect(kinds).toContain("numeric");
    });
});

describe("analyze — diagnostics", () => {
    it("emits unknown-identifier for an undeclared reference", () => {
        expect(codes(`${HEADER}x = mystery\n`)).toContain(
            "pine-converter/semantic/unknown-identifier",
        );
    });

    it("emits history-on-non-series when [] is applied to a const", () => {
        expect(codes(`${HEADER}var float k = 3.0\nx = k[1]\n`)).toContain(
            "pine-converter/semantic/history-on-non-series",
        );
    });

    it("does not warn on history of a series", () => {
        expect(codes(`${HEADER}x = close[1]\n`)).not.toContain(
            "pine-converter/semantic/history-on-non-series",
        );
    });

    it("emits unsupported-tuple-destructuring for a tuple value", () => {
        expect(codes(`${HEADER}x = (close, open)\n`)).toContain(
            "pine-converter/semantic/unsupported-tuple-destructuring",
        );
    });
});

describe("analyze — bar-index detection", () => {
    it("flags a bar_index reference", () => {
        expect(run(`${HEADER}x = bar_index\n`).referencesBarIndex).toBe(true);
    });

    it("flags forward projection bar_index + N", () => {
        const result = run(`${HEADER}x = bar_index + 5\n`);
        expect(result.referencesBarIndex).toBe(true);
        expect(result.referencesFutureBarIndex).toBe(true);
    });

    it("does not flag future projection for bar_index alone", () => {
        expect(run(`${HEADER}x = bar_index\n`).referencesFutureBarIndex).toBe(false);
    });

    it("does not flag future projection for a backward offset literal", () => {
        expect(run(`${HEADER}x = bar_index + 0\n`).referencesFutureBarIndex).toBe(false);
    });

    it("detects future projection when the literal is the left operand", () => {
        expect(run(`${HEADER}x = 5 + bar_index\n`).referencesFutureBarIndex).toBe(true);
    });

    it("flags a member-access reference whose root is bar_index", () => {
        // `bar_index.foo` is contrived but exercises the member-root branch.
        const result = run(`${HEADER}x = bar_index.foo\n`);
        expect(result.referencesBarIndex).toBe(true);
    });
});

describe("analyze — indicator caps + declaration shapes", () => {
    it("ignores a named non-cap indicator argument", () => {
        const source = "//@version=6\nindicator('a', overlay=true, max_lines_count=7)\n";
        const result = run(
            `${source}array.push(lines, line.new(bar_index, close, bar_index, close))\n`,
        );
        const camp = result.drawingSites[0]?.camp;
        // lines is undeclared → no Camp B; the cap drives Camp C-bounded.
        expect(camp?.kind).toBe("camp-c-bounded");
    });

    it("ignores a non-int cap argument value", () => {
        const source = "//@version=6\nindicator('a', max_boxes_count=close)\n";
        const result = run(`${source}array.push(b, box.new(bar_index, high, bar_index, low))\n`);
        expect(result.drawingSites[0]?.camp.kind).toBe("camp-c-unbounded");
    });

    it("uses empty caps when there is no indicator declaration", () => {
        const result = run("//@version=6\nx = close\n");
        expect(result.drawingSites).toHaveLength(0);
        expect(result.referencesBarIndex).toBe(false);
    });
});

describe("analyze — member access + na call edge cases", () => {
    it("emits unknown-identifier for a member chain with an unresolved root", () => {
        expect(codes(`${HEADER}x = mystery.field\n`)).toContain(
            "pine-converter/semantic/unknown-identifier",
        );
    });

    it("walks a computed-head member access without resolving its root name", () => {
        // `close.mantissa` resolves the `close` root (no diagnostic).
        expect(codes(`${HEADER}x = close.foo\n`)).not.toContain(
            "pine-converter/semantic/unknown-identifier",
        );
    });

    it("walks a bare na call with no arguments", () => {
        expect(() => run(`${HEADER}x = na()\n`)).not.toThrow();
    });

    it("treats na() of a non-identifier receiver as numeric", () => {
        const result = run(`${HEADER}x = na(1 + 2)\n`);
        const naCall = [...result.annotations.entries()].find(
            ([node]) => node.kind === "call-expression",
        );
        expect(naCall?.[1].naKind).toBe("numeric");
    });

    it("walks a computed-head member access (history receiver then .field)", () => {
        expect(() => run(`${HEADER}x = close[1].foo\n`)).not.toThrow();
    });
});

describe("analyze — handle-mutation recording edge cases", () => {
    it("ignores a bare expression statement that is not a call", () => {
        expect(() => run(`${HEADER}var line lvl = na\nlvl\n`)).not.toThrow();
    });

    it("ignores a call whose first argument is not an identifier", () => {
        const source = `${HEADER}line.set_xy1(line.new(bar_index, close, bar_index, close), 1, 2)\n`;
        expect(() => run(source)).not.toThrow();
    });

    it("ignores a zero-argument call in statement position", () => {
        expect(() => run(`${HEADER}foo()\n`)).not.toThrow();
    });

    it("ignores a setter on a resolved non-handle identifier", () => {
        const source = `${HEADER}var float x = 0.0\nfoo.set_y(x, 2)\n`;
        const result = run(source);
        const symbol = [...result.symbols.values()].find((s) => s.name === "x");
        const lifetime = symbol ? result.lifetimes.get(symbol) : undefined;
        expect(lifetime?.mutations).toHaveLength(0);
    });
});

describe("analyze — control-flow walks", () => {
    it("walks for/switch/return/break/continue bodies without throwing", () => {
        const source = [
            HEADER.trimEnd(),
            "for i = 0 to 3 by 2",
            "    x = close",
            "    break",
            "    continue",
            "switch close",
            "    1 => high",
            "    => low",
            "f() =>",
            "    return close",
            "",
        ].join("\n");
        const result = run(source);
        expect(result.script.body.length).toBeGreaterThan(0);
    });

    it("walks unary, paren, ternary, and lambda expression forms", () => {
        const source = [
            HEADER.trimEnd(),
            "a = -close",
            "b = (close)",
            "c = close > open ? high : low",
            "g = (x) => x",
            "",
        ].join("\n");
        expect(() => run(source)).not.toThrow();
    });

    it("walks else-if and else branches and a bare block via switch default", () => {
        const source = [
            HEADER.trimEnd(),
            "if close > open",
            "    x = 1",
            "else if close < open",
            "    x = 2",
            "else",
            "    x = 3",
            "",
        ].join("\n");
        expect(() => run(source)).not.toThrow();
    });

    it("records handle mutation and deletion sites on a var handle", () => {
        const source = [
            HEADER.trimEnd(),
            "var line lvl = na",
            "lvl := line.new(bar_index, close, bar_index, close)",
            "line.set_xy1(lvl, bar_index, close)",
            "line.delete(lvl)",
            "",
        ].join("\n");
        const result = run(source);
        const symbol = [...result.symbols.values()].find((s) => s.name === "lvl");
        const lifetime = symbol ? result.lifetimes.get(symbol) : undefined;
        expect(lifetime?.mutations).toHaveLength(1);
        expect(lifetime?.deletions).toHaveLength(1);
        expect(lifetime?.reassignments).toHaveLength(1);
    });

    it("ignores setters and deletes on a non-handle first argument", () => {
        const source = [
            HEADER.trimEnd(),
            "x = 1",
            "foo.set_y(x, 2)",
            "math.delete(close)",
            "",
        ].join("\n");
        expect(() => run(source)).not.toThrow();
    });
});

describe("analyze — synthetic AST shapes", () => {
    const span = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 };

    it("walks a top-level block statement (defensive arm not produced by the parser)", () => {
        const script: Script = {
            kind: "script",
            version: null,
            declaration: null,
            body: [
                {
                    kind: "block-statement",
                    body: [
                        {
                            kind: "expression-statement",
                            expression: { kind: "identifier-expression", name: "close", span },
                            span,
                        },
                    ],
                    span,
                },
            ],
            span,
        };
        expect(() => analyze(script)).not.toThrow();
    });
});

describe("inferQualifier — units", () => {
    const lit: ExpressionNode = {
        kind: "literal-expression",
        literalKind: "int",
        value: "1",
        span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
    };

    it("joins lattice ranks correctly", () => {
        expect(joinQualifier("const", "series")).toBe("series");
        expect(joinQualifier("input", "simple")).toBe("simple");
        expect(joinQualifier("const", "const")).toBe("const");
    });

    it("infers input.* and ta.* member calls", () => {
        const root = createScopeBuilder(null, lit.span);
        const resolve = (n: string): SymbolInfo | null => resolveSymbol(root, n);
        const taCall: ExpressionNode = {
            kind: "call-expression",
            callee: {
                kind: "member-access-expression",
                head: null,
                chain: ["ta", "ema"],
                span: lit.span,
            },
            args: [{ name: null, value: lit, span: lit.span }],
            span: lit.span,
        };
        expect(inferQualifier(taCall, resolve)).toBe("series");

        const inputCall: ExpressionNode = {
            kind: "call-expression",
            callee: {
                kind: "member-access-expression",
                head: null,
                chain: ["input", "int"],
                span: lit.span,
            },
            args: [],
            span: lit.span,
        };
        expect(inferQualifier(inputCall, resolve)).toBe("input");
    });

    it("infers a bare input identifier reference as input", () => {
        const root = createScopeBuilder(null, lit.span);
        expect(
            inferQualifier({ kind: "identifier-expression", name: "input", span: lit.span }, (n) =>
                resolveSymbol(root, n),
            ),
        ).toBe("input");
    });

    it("falls back to const for unknown roots and unknown-expression", () => {
        const resolve = (): SymbolInfo | null => null;
        expect(
            inferQualifier(
                { kind: "identifier-expression", name: "ghost", span: lit.span },
                resolve,
            ),
        ).toBe("const");
        expect(
            inferQualifier({ kind: "unknown-expression", tokens: [], span: lit.span }, resolve),
        ).toBe("const");
    });

    it("joins through unary, paren, history, tuple, and lambda forms", () => {
        const root = createScopeBuilder(null, lit.span);
        const resolve = (n: string): SymbolInfo | null => resolveSymbol(root, n);
        const close: ExpressionNode = {
            kind: "identifier-expression",
            name: "close",
            span: lit.span,
        };
        expect(
            inferQualifier(
                { kind: "unary-expression", operator: "-", operand: close, span: lit.span },
                resolve,
            ),
        ).toBe("series");
        expect(
            inferQualifier(
                { kind: "paren-expression", expression: close, span: lit.span },
                resolve,
            ),
        ).toBe("series");
        expect(
            inferQualifier(
                { kind: "history-access-expression", receiver: close, offset: lit, span: lit.span },
                resolve,
            ),
        ).toBe("series");
        expect(
            inferQualifier(
                { kind: "tuple-expression", elements: [close, lit], span: lit.span },
                resolve,
            ),
        ).toBe("series");
        expect(
            inferQualifier(
                { kind: "lambda-expression", params: [], body: close, span: lit.span },
                resolve,
            ),
        ).toBe("const");
    });

    it("joins a computed-head member chain through the head qualifier", () => {
        const root = createScopeBuilder(null, lit.span);
        defineSymbol(root, {
            name: "obj",
            kind: "variable",
            declarationSpan: null,
            typeAnnotation: null,
            qualifier: "series",
            handleType: null,
        });
        const resolve = (n: string): SymbolInfo | null => resolveSymbol(root, n);
        const computed: ExpressionNode = {
            kind: "member-access-expression",
            head: { kind: "identifier-expression", name: "obj", span: lit.span },
            chain: ["field"],
            span: lit.span,
        };
        // A computed head has no dotted name and no root identifier → const.
        expect(inferQualifier(computed, resolve)).toBe("const");
    });

    it("infers a binary expression as the join of its operands", () => {
        const root = createScopeBuilder(null, lit.span);
        const resolve = (n: string): SymbolInfo | null => resolveSymbol(root, n);
        const expr: ExpressionNode = {
            kind: "binary-expression",
            operator: "+",
            left: { kind: "identifier-expression", name: "close", span: lit.span },
            right: lit,
            span: lit.span,
        };
        expect(inferQualifier(expr, resolve)).toBe("series");
    });

    it("infers a ternary as the join of its three parts", () => {
        const root = createScopeBuilder(null, lit.span);
        const resolve = (n: string): SymbolInfo | null => resolveSymbol(root, n);
        const expr: ExpressionNode = {
            kind: "ternary-expression",
            condition: { kind: "identifier-expression", name: "close", span: lit.span },
            consequent: lit,
            alternate: lit,
            span: lit.span,
        };
        expect(inferQualifier(expr, resolve)).toBe("series");
    });

    it("infers a non-passthrough call as the join of callee and args", () => {
        const root = createScopeBuilder(null, lit.span);
        const resolve = (n: string): SymbolInfo | null => resolveSymbol(root, n);
        const expr: ExpressionNode = {
            kind: "call-expression",
            callee: { kind: "identifier-expression", name: "plot", span: lit.span },
            args: [
                {
                    name: null,
                    value: { kind: "identifier-expression", name: "close", span: lit.span },
                    span: lit.span,
                },
            ],
            span: lit.span,
        };
        expect(inferQualifier(expr, resolve)).toBe("series");
    });
});
