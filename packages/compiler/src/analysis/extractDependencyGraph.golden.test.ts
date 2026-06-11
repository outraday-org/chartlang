// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createProgramForSource } from "../program.js";
import { extractDependencyGraph } from "./extractDependencyGraph.js";
import { runStructuralChecks } from "./structuralChecks.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(HERE, "..", "__fixtures__");

type SerialisableDep = Readonly<{
    drawn: ReadonlyArray<
        Readonly<{
            exportName: string;
            bindingName: string;
            outputs: ReadonlyArray<{ title: string; kind: string }>;
            consumes: ReadonlyArray<{
                localId: string;
                producerRef: {
                    kind: string;
                    bindingName?: string;
                    sourcePath?: string;
                    exportName?: string;
                };
                effectiveInputs: Record<string, unknown>;
            }>;
        }>
    >;
    privateDeps: ReadonlyArray<
        Readonly<{
            localId: string;
            producerRef: {
                kind: string;
                bindingName?: string;
                sourcePath?: string;
                exportName?: string;
            };
            effectiveInputs: Record<string, unknown>;
            outputs: ReadonlyArray<{ title: string; kind: string }>;
        }>
    >;
    diagnosticCodes: ReadonlyArray<string>;
}>;

function serialise(fixture: string): SerialisableDep {
    const sourcePath = `__fixtures__/dep-graph/${fixture}.chart.ts`;
    const source = readFileSync(join(FIXTURE_ROOT, "dep-graph", `${fixture}.chart.ts`), "utf8");
    const { sourceFile, checker } = createProgramForSource(source, { sourcePath });
    const structural = runStructuralChecks(sourceFile, checker, sourcePath);
    const graph = extractDependencyGraph(
        sourceFile,
        checker,
        sourcePath,
        structural.bindings,
        () => null,
    );
    return Object.freeze({
        drawn: graph.drawn.map((d) => ({
            exportName: d.exportName,
            bindingName: d.bindingName,
            outputs: d.outputs.map((o) => ({ title: o.title, kind: o.kind })),
            consumes: d.consumes.map((c) => ({
                localId: c.localId,
                producerRef: { ...c.producerRef },
                effectiveInputs: { ...c.effectiveInputs },
            })),
        })),
        privateDeps: graph.privateDeps.map((p) => ({
            localId: p.localId,
            producerRef: { ...p.producerRef },
            effectiveInputs: { ...p.effectiveInputs },
            outputs: p.outputs.map((o) => ({ title: o.title, kind: o.kind })),
        })),
        diagnosticCodes: graph.diagnostics.map((d) => d.code),
    });
}

function assertGolden(name: string): void {
    const computed = serialise(name);
    const goldenPath = join(FIXTURE_ROOT, "golden", `${name}.json`);
    const pretty = `${JSON.stringify(computed, null, 4)}\n`;
    if (process.env.UPDATE_GOLDEN === "1") {
        writeFileSync(goldenPath, pretty, "utf8");
    }
    const expected = readFileSync(goldenPath, "utf8");
    expect(pretty).toBe(expected);
}

describe("extractDependencyGraph — golden snapshots", () => {
    it("matches single-private-dep.json", () => {
        assertGolden("single-private-dep");
    });
    it("matches multi-export.json", () => {
        assertGolden("multi-export");
    });
    it("matches diamond.json", () => {
        assertGolden("diamond");
    });
});
