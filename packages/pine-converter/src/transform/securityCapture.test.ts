// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { ExpressionNode } from "../ast/index.js";
import { type SourceSpan, convert } from "../index.js";
import { lex } from "../lexer/index.js";
import { parseStatements } from "../parser/index.js";
import { analyze } from "../semantic/index.js";
import type { EmitContext } from "./emitContext.js";
import { type CaptureReEmit, collectCaptureHoist } from "./securityCapture.js";

const SPAN: SourceSpan = { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 };

// Build a real analysis from a small Pine script and pull out the `probe = …`
// initializer expression as the callback "body" whose captures are hoisted.
function setup(
    lines: string,
    probeExpr: string,
): { analysis: ReturnType<typeof analyze>; body: ExpressionNode } {
    const src = `//@version=6\nindicator("X")\n${lines}\nprobe = ${probeExpr}\nplot(close)\n`;
    const script = parseStatements(lex(src).tokens).script;
    const analysis = analyze(script);
    for (const stmt of script.body) {
        if (stmt.kind === "assignment" && stmt.name === "probe") {
            return { analysis, body: stmt.value };
        }
        if (stmt.kind === "variable-declaration" && stmt.name === "probe") {
            return { analysis, body: stmt.initializer };
        }
    }
    throw new Error("no probe statement");
}

function ctx(extra?: Partial<EmitContext>): EmitContext {
    return {
        annotations: new Map(),
        inputNames: new Set(),
        localNames: new Set(),
        stateSlots: new Map(),
        ...extra,
    };
}

// A reEmit stub that labels each hoisted statement by its target name (or
// `switch`) and records the `localNames` it was handed.
function recordingReEmit(): {
    reEmit: CaptureReEmit;
    localNamesSeen: string[][];
} {
    const localNamesSeen: string[][] = [];
    const reEmit: CaptureReEmit = (stmt, localNames) => {
        localNamesSeen.push([...localNames].sort());
        const label = stmt.kind === "switch-statement" ? "switch" : stmt.name;
        return [label];
    };
    return { reEmit, localNamesSeen };
}

describe("collectCaptureHoist", () => {
    it("hoists an invariant expression chain and shadows the captured names", () => {
        const { analysis, body } = setup(
            "base = input.int(10)\nlen2 = math.round(base * 1.5)",
            "ta.atr(len2)",
        );
        const { reEmit, localNamesSeen } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["base"]) }),
            analysis,
            reEmit,
        );
        expect(hoist.prelude).toEqual(["len2"]);
        expect([...hoist.localNames]).toEqual(["len2"]);
        expect(hoist.rejects).toEqual([]);
        // The body emit shadows the full hoisted set.
        expect(localNamesSeen).toEqual([["len2"]]);
    });

    it("follows a transitive chain, stopping at inputs", () => {
        const { analysis, body } = setup("a = input.int(5)\nb = a + 1\nc = b + 2", "ta.atr(c)");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["a"]) }),
            analysis,
            reEmit,
        );
        // Source order: b before c.
        expect(hoist.prelude).toEqual(["b", "c"]);
        expect([...hoist.localNames].sort()).toEqual(["b", "c"]);
    });

    it("hoists a switch-fed length through its seed declaration and switch", () => {
        const { analysis, body } = setup(
            [
                'sel = input.string("Fast")',
                "var int plen = na",
                "switch sel",
                '    "Fast" => plen := 8',
                '    "Slow" => int tmp = 21',
                "    => plen := 99",
                "len3 = plen + 1",
            ].join("\n"),
            "ta.atr(len3)",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["sel"]) }),
            analysis,
            reEmit,
        );
        // Source order: var seed, switch, then the derived length.
        expect(hoist.prelude).toEqual(["plen", "switch", "len3"]);
        expect([...hoist.localNames].sort()).toEqual(["len3", "plen"]);
        expect(hoist.rejects).toEqual([]);
    });

    it("hoists across a subject-less switch", () => {
        const { analysis, body } = setup(
            [
                "cond = input.bool(true)",
                "var int plen = na",
                "switch",
                "    cond => plen := 8",
                "len = plen",
            ].join("\n"),
            "ta.atr(len)",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["cond"]) }),
            analysis,
            reEmit,
        );
        expect(hoist.prelude).toEqual(["plen", "switch", "len"]);
        expect(hoist.rejects).toEqual([]);
    });

    it("rejects a bar-varying (series) capture", () => {
        const { analysis, body } = setup("ser = ta.sma(close, 14)", "ser + 1");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist([body], ctx(), analysis, reEmit);
        expect(hoist.prelude).toEqual([]);
        expect(hoist.rejects.map((r) => r.name)).toEqual(["ser"]);
    });

    it("rejects a switch whose subject is series", () => {
        const { analysis, body } = setup(
            [
                "ser = ta.sma(close, 5)",
                "var int plen = na",
                "switch ser",
                "    100.0 => plen := 8",
            ].join("\n"),
            "ta.atr(plen)",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist([body], ctx(), analysis, reEmit);
        expect(hoist.prelude).toEqual([]);
        expect(hoist.rejects.map((r) => r.name)).toEqual(["plen"]);
    });

    it("rejects a switch arm value that is series", () => {
        const { analysis, body } = setup(
            [
                'sel = input.string("a")',
                "var float pv = na",
                "switch sel",
                '    "a" => pv := ta.sma(close, 5)',
            ].join("\n"),
            "ta.atr(pv)",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["sel"]) }),
            analysis,
            reEmit,
        );
        expect(hoist.rejects.map((r) => r.name)).toEqual(["pv"]);
    });

    it("rejects a switch with a non-assignment arm body", () => {
        const { analysis, body } = setup(
            [
                'sel = input.string("a")',
                "var int plen = na",
                "switch sel",
                '    "a" => plen := 8',
                '    "b" => plot(close)',
            ].join("\n"),
            "ta.atr(plen)",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["sel"]) }),
            analysis,
            reEmit,
        );
        expect(hoist.rejects.map((r) => r.name)).toEqual(["plen"]);
    });

    it("rejects a capture backed by a state slot", () => {
        const { analysis, body } = setup("var float cnt = 0.0", "cnt + 1");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ stateSlots: new Map([["cnt", "cntSlot"]]) }),
            analysis,
            reEmit,
        );
        expect(hoist.prelude).toEqual([]);
        expect(hoist.rejects.map((r) => r.name)).toEqual(["cnt"]);
    });

    it("rejects a capture backed by a series slot", () => {
        const { analysis, body } = setup("var float cnt = 0.0", "cnt + 1");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ seriesSlots: new Set(["cnt"]) }),
            analysis,
            reEmit,
        );
        expect(hoist.rejects.map((r) => r.name)).toEqual(["cnt"]);
    });

    it("rejects a capture with no plain defining statement (tuple target)", () => {
        const { analysis, body } = setup("[macdLine, sig, hist] = ta.macd(close)", "macdLine + 1");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist([body], ctx(), analysis, reEmit);
        expect(hoist.prelude).toEqual([]);
        expect(hoist.rejects.map((r) => r.name)).toEqual(["macdLine"]);
    });

    it("skips inputs, locals, builtins, namespace roots, `bar`, and unknowns", () => {
        const { analysis, body } = setup(
            "base = input.int(1)\nfoo = base + 1",
            "base + foo + close + math + bar + undeclared_xyz",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["base"]), localNames: new Set(["foo"]) }),
            analysis,
            reEmit,
        );
        // `foo` is shadowed (localNames), `base` is an input, the rest are
        // builtins / namespace roots / `bar` / undeclared — nothing hoists.
        expect(hoist.prelude).toEqual([]);
        expect(hoist.rejects).toEqual([]);
    });

    it("dedups a repeated capture and a shared defining statement", () => {
        const { analysis, body } = setup(
            "base = input.int(2)\nlen2 = math.round(base * 1.5)",
            "ta.atr(len2) + ta.sma(close, len2)",
        );
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(
            [body],
            ctx({ inputNames: new Set(["base"]) }),
            analysis,
            reEmit,
        );
        // `len2` appears twice in the body but is hoisted once.
        expect(hoist.prelude).toEqual(["len2"]);
    });

    it("collects captures across multiple bodies (source + expanded)", () => {
        const a = setup("x = input.int(1)\nu = x + 1", "ta.atr(u)");
        const second = setup("x = input.int(1)\nv = x + 2", "ta.atr(v)");
        const { reEmit } = recordingReEmit();
        // Reuse the first analysis but pass both probe bodies — the second body
        // references `u`-free names that resolve in the first analysis only for
        // `u`; `v` is unknown there and is skipped, proving the union walk.
        const hoist = collectCaptureHoist(
            [a.body, second.body],
            ctx({ inputNames: new Set(["x"]) }),
            a.analysis,
            reEmit,
        );
        expect(hoist.prelude).toEqual(["u"]);
    });

    it("walks every expression node kind when collecting free reads", () => {
        // Each probe exercises a distinct `collectExpressionReads` arm; none of
        // the names resolve to a top-level binding, so nothing hoists — the walk
        // itself is the subject.
        const exprs = [
            "q[1]", // history-access
            "-q", // unary
            "q ? r : s", // ternary
            "f(q)", // call
            "q[0].field", // member-access with a computed head
            "(q)", // paren
            "[q, r]", // array literal
            "(z) => z + q", // lambda
            "na", // na (shares the literal/unknown arm)
            "1.5", // literal
        ];
        const bodies: ExpressionNode[] = exprs.map((e) => setup("", e).body);
        // A value-position tuple-expression shares the array-literal walk arm but
        // does not arise from a parsed expression, so inject it directly.
        bodies.push({
            kind: "tuple-expression",
            elements: [{ kind: "identifier-expression", name: "q", span: SPAN }],
            span: SPAN,
        });
        const { analysis } = setup("", "1");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist(bodies, ctx(), analysis, reEmit);
        expect(hoist.prelude).toEqual([]);
        expect(hoist.rejects).toEqual([]);
    });

    it("walks a value-position switch expression when collecting free reads", () => {
        const { body } = setup("", 'switch q\n    "a" => 1\n    => 2');
        const { analysis } = setup("", "1");
        const { reEmit } = recordingReEmit();
        const hoist = collectCaptureHoist([body], ctx(), analysis, reEmit);
        expect(hoist.prelude).toEqual([]);
    });
});

const OPTS = { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 } as const;

describe("request.security capture hoisting (end-to-end)", () => {
    it("reconstructs a bar-invariant capture inside a stateful-UDF tuple security source", () => {
        // The expression element `cf(atr_len)` inline-expands the stateful UDF
        // (covering the source/expanded union) AND captures the invariant length.
        const src = [
            "//@version=6",
            'indicator("X")',
            "base = input.int(10)",
            "atr_len = math.round(base * 1.5)",
            "cf(len) => ta.atr(len)",
            '[a, b] = request.security(syminfo.tickerid, "D", [close, cf(atr_len)])',
            "plot(a)",
            "plot(b)",
            "",
        ].join("\n");
        const result = convert(src, OPTS);
        expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
        // The captured length is rebuilt as a callback-local `let` (block form,
        // since the stateful inline produces a prelude).
        expect(result.output).toContain("let atr_len = Math.round");
        expect(result.output).toContain("(bar) => {");
    });

    it("reports a bar-varying capture as request-security-expr-captures-series", () => {
        const src = [
            "//@version=6",
            'indicator("X")',
            "ser = ta.sma(close, 20)",
            'htf = request.security(syminfo.tickerid, "D", ser + ta.atr(14))',
            "plot(htf)",
            "",
        ].join("\n");
        const result = convert(src, OPTS);
        const codes = result.diagnostics.map((d) => d.code);
        expect(codes).toContain("pine-converter/transform/request-security-expr-captures-series");
    });
});
