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
});
