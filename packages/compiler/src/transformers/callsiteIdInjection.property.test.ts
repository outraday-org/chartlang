// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program";
import { injectCallsiteIds } from "./callsiteIdInjection";

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
                statefulSet: STATEFUL_PRIMITIVES,
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
});
