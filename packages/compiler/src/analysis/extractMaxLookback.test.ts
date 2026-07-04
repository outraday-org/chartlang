// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { extractMaxLookback } from "./extractMaxLookback.js";

function run(source: string, inputLoopBounds: ReadonlyMap<string, number | null> = new Map()) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return extractMaxLookback(sourceFile, checker, "demo.chart.ts", sourceFile, inputLoopBounds);
}

function runExternal(
    source: string,
    externalKeys: ReadonlyArray<string>,
    inputLoopBounds: ReadonlyMap<string, number | null> = new Map(),
) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return extractMaxLookback(
        sourceFile,
        checker,
        "demo.chart.ts",
        sourceFile,
        inputLoopBounds,
        new Set(externalKeys),
    );
}

describe("extractMaxLookback", () => {
    it("returns 0 when no series reads are present", () => {
        const result = run(`
const x = 1;
void x;
`);
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
        expect(result.seriesCapacities).toEqual({});
    });

    it("captures the largest literal across bar.<field>[N] reads", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const a = bar.close[2];
const b = bar.high[7];
const c = bar.low[3];
void a; void b; void c;
`);
        expect(result.maxLookback).toBe(7);
    });

    it("recognises ta.X(...)[N] as a series read", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const x = ta.ema(close, 20)[5];
void x;
`);
        expect(result.maxLookback).toBe(5);
    });

    it("recognises identifier-bound series variables", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const e = ta.ema(close, 20);
const v = e[11];
void v;
`);
        expect(result.maxLookback).toBe(11);
    });

    it("emits dynamic-series-index for non-literal indices and sets dynamicFallback", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
let i = 2;
const v = bar.close[i];
void v;
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.diagnostics[0]?.severity).toBe("warning");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("sizes a bare `<` loop induction variable precisely (no warning)", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { const v = bar.close[i]; void v; }
`);
        expect(result.maxLookback).toBe(4);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a bare `<=` loop induction variable to the limit", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i <= 4; i++) { const v = bar.close[i]; void v; }
`);
        expect(result.maxLookback).toBe(4);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes an input-bound loop induction variable from input max", () => {
        const result = run(
            `
declare const bar: import("@invinite-org/chartlang-core").Bar;
declare const inputs: Record<string, unknown>;
for (let i = 0; i <= (inputs.tol as number); i++) { const v = bar.close[i]; void v; }
`,
            new Map([["tol", 20]]),
        );
        expect(result.maxLookback).toBe(20);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("falls back dynamically when an input-bound loop has no input max", () => {
        const result = run(
            `
declare const bar: import("@invinite-org/chartlang-core").Bar;
declare const inputs: Record<string, unknown>;
for (let i = 0; i <= (inputs.tol as number); i++) { const v = bar.close[i]; void v; }
`,
            new Map([["tol", null]]),
        );
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("sizes a literal element read of an inputs.<key>-bound external series", () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const bound = inputs.bound;
const v = bound[5];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(5);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a destructured external series (const { bound } = inputs)", () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const { bound } = inputs;
const v = bound[7];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(7);
        expect(result.diagnostics).toHaveLength(0);
    });

    it('sizes an external series bound through inputs["<key>"] string access', () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const bound = inputs["bound"];
const v = bound[3];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(3);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a renamed destructured external series (const { bound: b } = inputs)", () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const { bound: b } = inputs;
const v = b[6];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(6);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("skips a nested destructured binding element (non-identifier name)", () => {
        // `const { bound: { nested } } = inputs;` — the binding element's name is
        // an object pattern, not an identifier, so it is not a series binding.
        const result = runExternal(
            `
declare const inputs: Record<string, { nested: number }>;
const { bound: { nested } } = inputs;
void nested;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a direct inputs.<key>[N] external series read", () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const v = inputs.bound[4];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(4);
        expect(result.diagnostics).toHaveLength(0);
    });

    it('sizes a direct inputs["<key>"][N] external series read (no binding)', () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const v = inputs["bound"][8];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(8);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("falls back dynamically for a non-literal external-series index", () => {
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
const bound = inputs.bound;
let i = 2;
const v = bound[i];
void v;
`,
            ["bound"],
        );
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("does not size a non-external inputs.<key> element read", () => {
        // `length` is NOT an external-series key, so `inputs.length[5]` is not a
        // series read — the buffer stays sized to OHLCV reads only.
        const result = runExternal(
            `
declare const inputs: Record<string, ReadonlyArray<number>>;
const v = inputs.length[5];
void v;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("does not over-size when an external series is passed to a ta.* builtin", () => {
        // `ta.sma(bound, len)` reads only `bound.current` and buffers its own
        // window, so passing an external series to a dynamic-length ta.* needs
        // NO extra source capacity — no dynamicFallback, no lookback bump.
        const result = runExternal(
            `
declare const inputs: Record<string, import("@invinite-org/chartlang-core").Series<number>>;
declare const ta: { sma(id: string, src: unknown, len: number): { current: number } };
const bound = inputs.bound;
const len = 10 as number;
const s = ta.sma("s", bound, len);
void s;
`,
            ["bound"],
        );
        expect(result.maxLookback).toBe(0);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a const numeric-literal index precisely (no warning)", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const k = 3;
const v = bar.close[k];
void v;
`);
        expect(result.maxLookback).toBe(3);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("treats a negative const index as no lookback (contributes 0, no fallback)", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const k = -2;
const v = bar.close[k];
void v;
`);
        expect(result.maxLookback).toBe(0);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("falls back for a const declared after the use", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const v = bar.close[k];
void v;
const k = 3;
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back for a sibling-block const", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
declare const ok: boolean;
if (ok) { const k = 3; void k; }
const v = bar.close[k];
void v;
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back rather than leak an outer const through a non-numeric shadow", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const k = 3;
{ const k = "x"; const v = bar.close[k]; void v; void k; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back rather than leak an outer const through a `let` shadow", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const k = 3;
{ let k = 1; const v = bar.close[k]; void v; void k; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back for a non-terminating `>` loop induction variable", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i > 5; i++) { const v = bar.close[i]; void v; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back for a loop variable reassigned in the body", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { i = 100; const v = bar.close[i]; void v; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back rather than leak an outer const through a same-named reassigned loop var", () => {
        // `bar.close[i]` reads the reassigned loop variable (runtime index 100),
        // not the outer `const i = 2`; the buffer must size to the 5000-slot
        // fallback, never to the unrelated outer const (which would under-size).
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const i = 2;
for (let i = 0; i < 5; i++) { i = 100; const v = bar.close[i]; void v; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("sizes a shadowed loop variable from an inner numeric const, not the loop", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { { const i = 2; const v = bar.close[i]; void v; } }
`);
        expect(result.maxLookback).toBe(2);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("falls back for a loop variable shadowed by an inner `let`", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { { let i = 2; const v = bar.close[i]; void v; } }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back for an unknown identifier index (no const, no loop)", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
declare const j: number;
const v = bar.close[j];
void v;
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("picks the declaring loop for each variable in nested loops", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 3; j++) {
        const a = bar.close[i];
        const b = bar.close[j];
        void a; void b;
    }
}
`);
        expect(result.maxLookback).toBe(8);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes an `i + 1` affine index precisely", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { const v = bar.close[i + 1]; void v; }
`);
        expect(result.maxLookback).toBe(5);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes an `i - 1` affine index precisely", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { const v = bar.close[i - 1]; void v; }
`);
        expect(result.maxLookback).toBe(3);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a `K - i` affine index from a const and loop range", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const K = 4;
for (let i = 0; i <= 4; i++) { const v = bar.close[K - i]; void v; }
`);
        expect(result.maxLookback).toBe(4);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a `2 * i` affine index precisely", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 3; i++) { const v = bar.close[2 * i]; void v; }
`);
        expect(result.maxLookback).toBe(4);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("treats an all-negative affine interval as no lookback (no fallback)", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const K = 1;
for (let i = 2; i < 5; i++) { const v = bar.close[K - i]; void v; }
`);
        expect(result.maxLookback).toBe(0);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("falls back for an unsupported division index", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
for (let i = 0; i < 5; i++) { const v = bar.close[i / 2]; void v; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("falls back for an affine index with an unknown sub-term", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
declare const j: number;
for (let i = 0; i < 5; i++) { const v = bar.close[i + j]; void v; }
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("ignores element access on non-series shapes", () => {
        const result = run(`
const arr = [1, 2, 3];
const v = arr[1];
void v;
`);
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("scopes the walk to a single binding when `scope` is provided", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;

export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute() {
        const a = bar.close[3];
        void a;
    },
});

export default defineIndicator({
    name: "Default",
    apiVersion: 1,
    compute() {
        const b = bar.close[11];
        void b;
    },
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const defineCalls: ts.CallExpression[] = [];
        const collect = (node: ts.Node): void => {
            if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === "defineIndicator"
            ) {
                defineCalls.push(node);
            }
            ts.forEachChild(node, collect);
        };
        ts.forEachChild(sourceFile, collect);

        const siblingCall = defineCalls[0];
        const defaultCall = defineCalls[1];
        expect(siblingCall).toBeDefined();
        expect(defaultCall).toBeDefined();

        const sibling = extractMaxLookback(
            sourceFile,
            checker,
            "demo.chart.ts",
            siblingCall as ts.Node,
        );
        const def = extractMaxLookback(
            sourceFile,
            checker,
            "demo.chart.ts",
            defaultCall as ts.Node,
        );
        const file = extractMaxLookback(sourceFile, checker, "demo.chart.ts");

        expect(sibling.maxLookback).toBe(3);
        expect(def.maxLookback).toBe(11);
        expect(file.maxLookback).toBe(11);
    });

    it("ignores opts.offset on a ta.* call (display shift, not a buffer read)", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const shifted = ta.sma(close, 20, { offset: 5 });
void shifted.current;
`);
        // offset is a presentation x-shift carried to the emission, not a
        // value-read — the numeric series is unshifted, so no extra depth.
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("does not stack opts.offset with a literal index on the same series", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const shifted = ta.sma(close, 20, { offset: 5 });
const v = shifted[3];
void v;
`);
        // shifted[3] reads buf.at(3); offset is a render shift, not a read.
        expect(result.maxLookback).toBe(3);
    });

    it("does not stack opts.offset on an inline ta.* call element access", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const v = ta.sma(close, 20, { offset: 4 })[2];
void v;
`);
        expect(result.maxLookback).toBe(2);
    });

    it("ignores a negative opts.offset (display shift left needs no buffer depth)", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const shifted = ta.sma(close, 20, { offset: -5 });
void shifted.current;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("ignores a zero opts.offset and non-offset option keys", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const a = ta.sma(close, 20, { offset: 0 });
const b = ta.stdev(close, 20, { biased: true });
void a.current; void b.current;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("counts a negative bar.point literal offset as historical lookback", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const wp = bar.point(-12, bar.close);
void wp;
`);
        // bar.point(-12, …) anchors 12 bars back ⇒ time buffer must hold 12.
        expect(result.maxLookback).toBe(12);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("takes the largest negative bar.point offset across calls", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const a = bar.point(-3, bar.close);
const b = bar.point(-25, bar.high);
const c = bar.point(-7, bar.low);
void a; void b; void c;
`);
        expect(result.maxLookback).toBe(25);
    });

    it("ignores bar.point(0, …) and positive (future) offsets", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const now = bar.point(0, bar.close);
const future = bar.point(10, bar.close);
void now; void future;
`);
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("counts the converter's parenthesised negative bar.point offset", () => {
        // The Pine converter emits a historical anchor as `bar.point(-(N), …)`
        // (minus applied to a parenthesised literal), not a bare `-N`. The
        // lookback recogniser must peel the parens or the converted tracking
        // line sizes its time buffer to 0 and resolves to a NaN anchor.
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const wp = bar.point(-(20), bar.close);
void wp;
`);
        expect(result.maxLookback).toBe(20);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("ignores a non-literal / dynamic bar.point offset", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const k = 4;
const dyn = bar.point(-k, bar.close);
const expr = bar.point(-(2 + 3), bar.close);
void dyn; void expr;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("ignores a zero-argument bar.point() call", () => {
        // Defensive: a malformed `bar.point()` (no offset argument) still
        // matches the `bar.point` shape but cannot be sized, so the
        // `first === undefined` guard must contribute no extra buffer depth.
        // (The missing argument is a type error the analysis tolerates — it
        // walks the AST regardless of checker diagnostics.)
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
// @ts-expect-error -- zero-arg bar.point() exercises the undefined-offset guard
const wp = bar.point();
void wp;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("does not treat a non-bar .point call as a bar.point lookback", () => {
        const result = run(`
declare const obj: { point(n: number, p: number): unknown };
const v = obj.point(-9, 1);
void v;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("stacks bar.point depth alongside series lookback (takes the max)", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
const series = bar.close[4];
const wp = bar.point(-30, bar.close);
void series; void wp;
`);
        expect(result.maxLookback).toBe(30);
    });

    it("does not size for spread or computed-name options objects", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
declare const extra: { offset: number };
const a = ta.sma(close, 20, { ...extra });
const b = ta.sma(close, 20, { ["offset"]: 5 });
void a.current; void b.current;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("counts a literal-length ta.highestbars as `length - 1` lookback depth", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const high: import("@invinite-org/chartlang-core").Series<number>;
const hbar = ta.highestbars(high, 100);
void hbar.current;
`);
        // The deepest offset highestbars(.., 100) can return is -(100 - 1).
        expect(result.maxLookback).toBe(99);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("counts a literal-length ta.lowestbars as `length - 1` lookback depth", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const low: import("@invinite-org/chartlang-core").Series<number>;
const lbar = ta.lowestbars(low, 50);
void lbar.current;
`);
        expect(result.maxLookback).toBe(49);
    });

    it("ignores a non-literal length on ta.highestbars (cannot be sized)", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const high: import("@invinite-org/chartlang-core").Series<number>;
declare const len: number;
const hbar = ta.highestbars(high, len);
void hbar.current;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("ignores a length <= 1 on ta.highestbars (offset is always 0)", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const high: import("@invinite-org/chartlang-core").Series<number>;
const hbar = ta.highestbars(high, 1);
void hbar.current;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("takes the max of highestbars depth and a sibling series lookback", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;
const hbar = ta.highestbars(bar.high, 10);
const back = bar.close[20];
void hbar.current; void back;
`);
        expect(result.maxLookback).toBe(20);
    });

    it("sizes the secondary warmup from a ta.* length inside a request.security callback", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
import { request, ta } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 200, { offset: 12 }));
void trend;
`);
        // The secondary stream is bulk-warmed BEFORE the callback is captured, so
        // it must retain enough history to warm ta.ema(200) — the length feeds the
        // shared ring capacity. The `{ offset: 12 }` opts object is a render shift,
        // not a value-read, so it adds no depth.
        expect(result.maxLookback).toBe(200);
    });

    it("sizes secondary warmup from a function-expression request.security callback", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
import { request, ta } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, function (bar) { return ta.ema(bar.close, 123); });
void trend;
`);
        expect(result.maxLookback).toBe(123);
    });

    it("ignores non-positive and non-finite secondary warmup lengths", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
import { request, ta } from "@invinite-org/chartlang-core";
const zero = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 0));
const infinite = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 1e400));
void zero; void infinite;
`);
        expect(result.maxLookback).toBe(0);
    });

    it("caps a pathological request.security indicator length at the dynamic ceiling", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
import { request, ta } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => ta.sma(bar.close, 9999999));
void trend;
`);
        expect(result.maxLookback).toBe(5000);
    });

    it("does not size warmup from a ta.* length OUTSIDE a request.security callback", () => {
        const result = run(`
import { ta } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;
const e = ta.ema(bar.close, 200);
void e.current;
`);
        // Main-clock indicators self-warm via scalar slot state and are read at
        // `.current`, so the length is NOT a buffer-depth requirement here.
        expect(result.maxLookback).toBe(0);
    });

    it("counts a series element-access lookback inside the callback", () => {
        const result = run(`
declare const bar: import("@invinite-org/chartlang-core").Bar;
import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => bar.close[50]);
void trend;
`);
        expect(result.maxLookback).toBe(50);
    });

    it("recognises a state.series-bound variable's literal index", () => {
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;
const s = state.series(0);
s.value = bar.close;
const p = s[4];
void p;
`);
        expect(result.maxLookback).toBe(4);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("takes the deepest index across two state.series bindings", () => {
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
const a = state.series(0);
const b = state.series(0);
const x = a[2];
const y = b[5];
void x; void y;
`);
        expect(result.maxLookback).toBe(5);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("takes the global max across state.series, ta.*, and bar.* reads", () => {
        const result = run(`
import { state, ta } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;
const s = state.series(0);
const e = ta.ema(bar.close, 20);
const a = s[3];
const b = e[9];
const c = bar.close[6];
void a; void b; void c;
`);
        expect(result.maxLookback).toBe(9);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("sizes a const numeric index on a state.series binding (no warning)", () => {
        // Proves the state.series arm composes with the bounded-loop resolver,
        // not just bare literals — `const k = 4` resolves through the shared
        // `resolveIndexUpperBound` path identically to `bar.*` / `ta.*`.
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
const k = 4;
const s = state.series(0);
const p = s[k];
void p;
`);
        expect(result.maxLookback).toBe(4);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("emits dynamic-series-index for a non-literal state.series index", () => {
        // Mirror the existing bar.* non-literal construction (a `let` mutable
        // index, which `resolveIndexUpperBound` cannot resolve post-bounded-loop)
        // — NOT a `const` literal, which now resolves precisely.
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
const s = state.series(0);
let i = 2;
const p = s[i];
void p;
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.diagnostics[0]?.severity).toBe("warning");
        expect(result.seriesCapacities).toEqual({ dynamicFallback: 5000 });
    });

    it("contributes 0 for a state.series allocated but never indexed", () => {
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
declare const bar: import("@invinite-org/chartlang-core").Bar;
const s = state.series(0);
s.value = bar.close;
void s.current;
`);
        expect(result.maxLookback).toBe(0);
        expect(result.seriesCapacities).toEqual({});
        expect(result.diagnostics).toHaveLength(0);
    });

    it("does not track a state.series aliased through another variable", () => {
        // The recogniser keys on the declaration initializer, so an alias
        // (`const t = s;`) is NOT a series-shaped binding — mirrors the `ta.*`
        // arm, which does not track aliases either. `t[2]` is treated as a
        // plain array index and contributes 0 (documented limitation, not a
        // regression). Building alias analysis is explicitly out of scope.
        const result = run(`
import { state } from "@invinite-org/chartlang-core";
const s = state.series(0);
const t = s;
const p = t[2];
void p;
`);
        expect(result.maxLookback).toBe(0);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("scopes a state.series binding to its declaring defineIndicator", () => {
        const source = `
import { defineIndicator, state } from "@invinite-org/chartlang-core";

export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute() {
        const s = state.series(0);
        const a = s[3];
        void a;
    },
});

export default defineIndicator({
    name: "Default",
    apiVersion: 1,
    compute() {
        const s = state.series(0);
        const b = s[11];
        void b;
    },
});
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const defineCalls: ts.CallExpression[] = [];
        const collect = (node: ts.Node): void => {
            if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === "defineIndicator"
            ) {
                defineCalls.push(node);
            }
            ts.forEachChild(node, collect);
        };
        ts.forEachChild(sourceFile, collect);

        const siblingCall = defineCalls[0];
        const defaultCall = defineCalls[1];
        expect(siblingCall).toBeDefined();
        expect(defaultCall).toBeDefined();

        const sibling = extractMaxLookback(
            sourceFile,
            checker,
            "demo.chart.ts",
            siblingCall as ts.Node,
        );
        const def = extractMaxLookback(
            sourceFile,
            checker,
            "demo.chart.ts",
            defaultCall as ts.Node,
        );

        expect(sibling.maxLookback).toBe(3);
        expect(def.maxLookback).toBe(11);
    });
});
