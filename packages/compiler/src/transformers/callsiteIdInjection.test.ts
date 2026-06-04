// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { injectCallsiteIds } from "./callsiteIdInjection";

function printSourceFile(file: ts.SourceFile): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(file);
}

describe("injectCallsiteIds", () => {
    it("rewrites ta.ema to inject the slot id as the first argument", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const e = ta.ema(close, 20);
void e;
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\.ema\("demo\.chart\.ts:4:11#0", close, 20\)/);
        expect(result.diagnostics).toHaveLength(0);
    });

    it("does not rewrite non-stateful core calls (defineIndicator)", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        const text = printSourceFile(result.transformed);
        expect(text).not.toMatch(/defineIndicator\("/);
    });

    it("does not rewrite user-shadowed identifiers", () => {
        const source = `
const plot = (_: number) => {};
plot(1);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        const text = printSourceFile(result.transformed);
        expect(text).not.toMatch(/plot\("/);
    });

    it("rewrites every primitive in STATEFUL_PRIMITIVES", () => {
        const source = `
import { ta, plot, hline, alert } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.sma(close, 14);
ta.ema(close, 14);
ta.stdev(close, 14);
ta.bb(close, 14);
ta.rsi(close, 14);
ta.macd(close);
ta.atr(14);
ta.crossover(close, 0);
ta.crossunder(close, 0);
plot(1);
hline(1);
alert("msg");
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        const text = printSourceFile(result.transformed);
        const slotMatches = text.match(/"demo\.chart\.ts:\d+:\d+#0"/g) ?? [];
        expect(slotMatches.length).toBe(STATEFUL_PRIMITIVES.size);
    });

    it("does not mutate the input source file (different node identity)", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const beforeText = printSourceFile(sourceFile);
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        const afterInputText = printSourceFile(sourceFile);
        expect(afterInputText).toBe(beforeText);
        expect(result.transformed).not.toBe(sourceFile);
    });

    it("yields byte-identical transformed output across two runs", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
const a = ta.ema(close, 12);
const b = ta.sma(close, 26);
void a; void b;
`;
        const first = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
        const a = injectCallsiteIds(first.sourceFile, first.checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        const second = createProgramForSource(source, { sourcePath: "demo.chart.ts" });
        const b = injectCallsiteIds(second.sourceFile, second.checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        expect(printSourceFile(a.transformed)).toBe(printSourceFile(b.transformed));
    });

    it("falls back to the input source file when the transformer drops the result", () => {
        // ts.transform always populates `transformed[0]` for a non-empty
        // input, so we exercise the fallback indirectly: passing an empty
        // stateful set means no rewrites; the printer output equals the
        // input.
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: new Set<string>(),
        });
        expect(printSourceFile(result.transformed)).toBe(printSourceFile(sourceFile));
    });

    it("emits stateful-call-element-access on `ta[\"ema\"](...)` and does not inject a slot id", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta["ema"](close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        expect(result.diagnostics).toHaveLength(1);
        const diagnostic = result.diagnostics[0];
        if (!diagnostic) throw new Error("expected diagnostic");
        expect(diagnostic.code).toBe("stateful-call-element-access");
        expect(diagnostic.message).toContain("`ta`");
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\["ema"\]\(close, 20\)/);
    });

    it("does not flag element-access calls on non-core objects", () => {
        const source = `
const tools = { ema: (_: number, __: number) => 0 };
tools["ema"](1, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
        });
        expect(result.diagnostics).toEqual([]);
    });

    it("emits callsite-id-conflict when a slot id has already been issued", () => {
        const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
ta.ema(close, 20);
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        const seededSlotId = "demo.chart.ts:4:1#0";
        const preexisting: ts.CallExpression = ts.factory.createCallExpression(
            ts.factory.createIdentifier("noop"),
            undefined,
            [],
        );
        const slotsSeen = new Map<string, ts.CallExpression>([[seededSlotId, preexisting]]);
        const result = injectCallsiteIds(sourceFile, checker, {
            sourcePath: "demo.chart.ts",
            statefulSet: STATEFUL_PRIMITIVES,
            slotsSeen,
        });
        expect(result.diagnostics).toHaveLength(1);
        const diagnostic = result.diagnostics[0];
        if (!diagnostic) throw new Error("expected diagnostic");
        expect(diagnostic.code).toBe("callsite-id-conflict");
        // The colliding call is skipped — its slot is not re-injected, so
        // the printed output retains the original two-argument shape.
        const text = printSourceFile(result.transformed);
        expect(text).toMatch(/ta\.ema\(close, 20\)/);
    });
});
