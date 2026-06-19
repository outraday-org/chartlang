// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { extractMaxLookback } from "./extractMaxLookback.js";

function run(source: string) {
    const { sourceFile, checker } = createProgramForSource(source, {
        sourcePath: "demo.chart.ts",
    });
    return extractMaxLookback(sourceFile, checker, "demo.chart.ts");
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
const i: number = 2;
const v = bar.close[i];
void v;
`);
        expect(result.diagnostics[0]?.code).toBe("dynamic-series-index");
        expect(result.diagnostics[0]?.severity).toBe("warning");
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

    it("ignores a ta.* offset inside a request.security expression callback", () => {
        const result = run(`
import { request, ta } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => ta.ema(bar.close, 200, { offset: 12 }));
void trend;
`);
        // offset is a render shift, not a value-read — no extra buffer depth.
        expect(result.maxLookback).toBe(0);
    });

    it("counts a series element-access lookback inside the callback", () => {
        const result = run(`
import { request } from "@invinite-org/chartlang-core";
const trend = request.security({ interval: "1W" }, (bar) => bar.close[50]);
void trend;
`);
        expect(result.maxLookback).toBe(50);
    });
});
