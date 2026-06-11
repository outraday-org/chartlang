// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { rewriteDependencyAccessors } from "../transformers/rewriteDependencyAccessors.js";
import { extractDependencyGraph } from "./extractDependencyGraph.js";
import { runStructuralChecks } from "./structuralChecks.js";

const PINNED_SEED = 1_700_000_000;

function buildAcyclicSource(adjacency: ReadonlyArray<ReadonlyArray<number>>): string {
    // Build N producers (B_0 … B_{N-1}). Each producer B_i emits a
    // plot titled `out_i`. Each producer B_i consumes from every
    // producer in `adjacency[i]` (must be a strictly-lower index to
    // keep the graph acyclic). The default export consumes from
    // producer B_0 so untitled-plot diagnostics never fire.
    const N = adjacency.length;
    const lines: string[] = [
        `import { defineIndicator, plot } from "@invinite-org/chartlang-core";`,
    ];
    for (let i = 0; i < N; i += 1) {
        const consumes = (adjacency[i] ?? []).filter((target) => target < i);
        const consumeLines = consumes
            .map((target) => `        void B_${target}.output("out_${target}");`)
            .join("\n");
        lines.push(`const B_${i} = defineIndicator({
    name: "B${i}",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "out_${i}" });
${consumeLines}
    },
});`);
    }
    lines.push(`export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void B_0.output("out_0"); },
});`);
    return lines.join("\n");
}

function buildCyclicSource(): string {
    return `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
const X = defineIndicator({
    name: "X",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "x" }); void Y.output("y"); },
});
const Y = defineIndicator({
    name: "Y",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { title: "y" }); void X.output("x"); },
});
export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => { void X.output("x"); },
});
`;
}

function runGraph(source: string) {
    const sourcePath = "property.chart.ts";
    const { sourceFile, checker } = createProgramForSource(source, { sourcePath });
    const structural = runStructuralChecks(sourceFile, checker, sourcePath);
    const graph = extractDependencyGraph(
        sourceFile,
        checker,
        sourcePath,
        structural.bindings,
        () => null,
    );
    return { graph, sourceFile, sourcePath };
}

describe("extractDependencyGraph — properties", () => {
    it("produces zero dep-cycle diagnostics on acyclic adjacency lists", () => {
        fc.assert(
            fc.property(
                fc.array(fc.array(fc.nat({ max: 3 }), { maxLength: 3 }), {
                    minLength: 1,
                    maxLength: 4,
                }),
                (adjacency) => {
                    const source = buildAcyclicSource(adjacency);
                    const { graph } = runGraph(source);
                    const cycleDiagnostics = graph.diagnostics.filter(
                        (d) => d.code === "dep-cycle",
                    );
                    expect(cycleDiagnostics).toEqual([]);
                },
            ),
            { numRuns: 40, seed: PINNED_SEED },
        );
    });

    it("always raises dep-cycle for the simplest direct-cycle source", () => {
        const { graph } = runGraph(buildCyclicSource());
        const codes = graph.diagnostics.map((d) => d.code);
        expect(codes).toContain("dep-cycle");
    });

    it("rewriteDependencyAccessors is deterministic across re-runs", () => {
        fc.assert(
            fc.property(
                fc.array(fc.array(fc.nat({ max: 3 }), { maxLength: 3 }), {
                    minLength: 1,
                    maxLength: 4,
                }),
                (adjacency) => {
                    const source = buildAcyclicSource(adjacency);
                    const { graph, sourceFile, sourcePath } = runGraph(source);
                    const printer = ts.createPrinter({
                        newLine: ts.NewLineKind.LineFeed,
                    });
                    const first = printer.printFile(
                        rewriteDependencyAccessors(sourceFile, graph, sourcePath).transformed,
                    );
                    const second = printer.printFile(
                        rewriteDependencyAccessors(sourceFile, graph, sourcePath).transformed,
                    );
                    expect(first).toBe(second);
                },
            ),
            { numRuns: 25, seed: PINNED_SEED },
        );
    });
});
