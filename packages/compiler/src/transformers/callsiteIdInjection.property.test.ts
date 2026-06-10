// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { injectCallsiteIds } from "./callsiteIdInjection.js";

function buildScript(count: number): string {
    const calls = Array.from({ length: count }, (_, i) => {
        const padding = " ".repeat(i % 5);
        return `${padding}ta.ema(close, ${i + 1});`;
    });
    return `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
${calls.join("\n")}
`;
}

describe("injectCallsiteIds — property tests", () => {
    it("produces a unique slot id for every stateful call at every count from 1..32", () => {
        for (let count = 1; count <= 32; count++) {
            const source = buildScript(count);
            const { sourceFile, checker } = createProgramForSource(source, {
                sourcePath: "prop.chart.ts",
            });
            const result = injectCallsiteIds(sourceFile, checker, {
                sourcePath: "prop.chart.ts",
                statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
            });
            const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
            const text = printer.printFile(result.transformed);
            const matches = text.match(/"prop\.chart\.ts:\d+:\d+#0"/g) ?? [];
            expect(matches).toHaveLength(count);
            const unique = new Set(matches);
            expect(unique.size).toBe(count);
            expect(result.diagnostics).toHaveLength(0);
        }
    });

    it("injects a slot id for every ta.ema call but not for ta.nz, interleaved", () => {
        // pattern[i] === true → ta.ema call (slot: true)
        // pattern[i] === false → ta.nz call (slot: false)
        const patterns: ReadonlyArray<ReadonlyArray<boolean>> = [
            [true, false, true, false],
            [false, false, true],
            [true, true, true, true, false],
            [false],
            [true],
            [true, false, false, false, true, true],
        ];
        for (const pattern of patterns) {
            const calls = pattern.map((useEma, i) => {
                const padding = " ".repeat(i % 3);
                return useEma
                    ? `${padding}ta.ema(close, ${i + 1});`
                    : `${padding}ta.nz(Number.NaN, ${i});`;
            });
            const source = `
import { ta } from "@invinite-org/chartlang-core";
declare const close: import("@invinite-org/chartlang-core").Series<number>;
${calls.join("\n")}
`;
            const { sourceFile, checker } = createProgramForSource(source, {
                sourcePath: "prop.chart.ts",
            });
            const result = injectCallsiteIds(sourceFile, checker, {
                sourcePath: "prop.chart.ts",
                statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
            });
            const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
            const text = printer.printFile(result.transformed);
            const matches = text.match(/"prop\.chart\.ts:\d+:\d+#0"/g) ?? [];
            const expectedSlotIdCount = pattern.filter(Boolean).length;
            expect(matches.length).toBe(expectedSlotIdCount);
            expect(result.diagnostics).toHaveLength(0);
        }
    });
});
