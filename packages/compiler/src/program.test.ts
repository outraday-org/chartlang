// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { VALID_DEFINE } from "./__fixtures__/scripts.js";
import { COMPILER_OPTIONS, CORE_MODULE_PATH, createProgramForSource } from "./program.js";

describe("createProgramForSource", () => {
    it("loads the synthetic source file at the supplied path", () => {
        const { sourceFile } = createProgramForSource(VALID_DEFINE, {
            sourcePath: "demo.chart.ts",
        });
        expect(sourceFile.fileName).toBe("demo.chart.ts");
        expect(sourceFile.text).toContain("defineIndicator");
    });

    it("normalises Windows-style separators and leading ./ in the path", () => {
        const { sourceFile } = createProgramForSource(VALID_DEFINE, {
            sourcePath: "./nested\\demo.chart.ts",
        });
        expect(sourceFile.fileName).toBe("nested/demo.chart.ts");
    });

    it("resolves imports of @invinite-org/chartlang-core via the ambient shim", () => {
        const source = `
import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });
`;
        const { sourceFile, checker } = createProgramForSource(source, {
            sourcePath: "demo.chart.ts",
        });
        // Walk to the defineIndicator identifier reference inside the
        // ExportAssignment and confirm the checker resolves its symbol to
        // a declaration from the shim.
        let resolvedFromCore = false;
        const visit = (node: ts.Node): void => {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
                if (node.expression.text === "defineIndicator") {
                    const symbol = checker.getSymbolAtLocation(node.expression);
                    let resolved = symbol;
                    if (resolved && resolved.flags & ts.SymbolFlags.Alias) {
                        resolved = checker.getAliasedSymbol(resolved);
                    }
                    const declarations = resolved?.getDeclarations() ?? [];
                    for (const declaration of declarations) {
                        if (declaration.getSourceFile().fileName === CORE_MODULE_PATH) {
                            resolvedFromCore = true;
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        ts.forEachChild(sourceFile, visit);
        expect(resolvedFromCore).toBe(true);
    });

    it("exposes pinned compiler options (ES2022, no DOM)", () => {
        expect(COMPILER_OPTIONS.target).toBe(ts.ScriptTarget.ES2022);
        expect(COMPILER_OPTIONS.lib).toEqual(["lib.es2022.d.ts"]);
        expect(COMPILER_OPTIONS.strict).toBe(true);
    });

    it("resolves the Phase 4 ambient core surface without semantic errors", () => {
        const source = `
import {
    barstate,
    defineIndicator,
    input,
    request,
    state,
    syminfo,
    timeframe,
} from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "phase4",
    apiVersion: 1,
    inputs: {
        len: input.int(14),
        tf: input.interval("chart"),
    },
    compute: ({ state, barstate, syminfo, timeframe, request }) => {
        const slot = state.float(0);
        const daily = request.security({ interval: "1D" });
        void slot.value;
        void daily.close.current;
        void barstate.isfirst;
        void syminfo.mintick;
        void timeframe.isdaily;
    },
});

void barstate.isfirst;
void input.int(0);
void request.security({ interval: "1D" });
void state.float(0);
void syminfo.mintick;
void timeframe.isdaily;
`;
        const { program, sourceFile } = createProgramForSource(source, {
            sourcePath: "phase4.chart.ts",
        });
        const diagnostics = program.getSemanticDiagnostics(sourceFile);
        expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);
    });

    it("resolves the Phase 5 snapshot ambient types without semantic errors", () => {
        const source = `
import type {
    StateSnapshot,
    StateStoreKey,
    StreamSnapshot,
} from "@invinite-org/chartlang-core";

const stream: StreamSnapshot = {
    interval: "1D",
    headIndex: 0,
    filled: 1,
    buffers: {
        time: [1700000000000],
        open: [100],
        high: [101],
        low: [99],
        close: [100.5],
        volume: [10],
    },
};

const snapshot: StateSnapshot = {
    lastBarTime: 1700000000000,
    streams: { main: stream },
    savedAt: 1700000060000,
    snapshotVersion: 1,
    primary: { slots: { "demo.chart.ts:1:1#0": { current: 100.5 } } },
};

const key: StateStoreKey = {
    scriptHash: "abc",
    compilerVersion: "0.5.0",
    apiVersion: 1,
    capabilitiesHash: "def",
    symbol: "BTCUSD",
    mainInterval: "1m",
    requestedIntervals: ["1D"],
};

void snapshot;
void key;
`;
        const { program, sourceFile } = createProgramForSource(source, {
            sourcePath: "snapshot.chart.ts",
        });
        const diagnostics = program.getSemanticDiagnostics(sourceFile);
        expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);
    });

    it("keeps the runtime stateful primitive registry at the Phase 6 lower timeframe cardinality", () => {
        expect(STATEFUL_PRIMITIVES.size).toBe(172);
    });

    it("resolves the stateful primitive registry exports from the ambient shim", () => {
        const source = `
import { STATEFUL_PRIMITIVES, STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
void STATEFUL_PRIMITIVES;
void STATEFUL_PRIMITIVES_BY_NAME;
`;
        const { program, sourceFile } = createProgramForSource(source, {
            sourcePath: "registry.chart.ts",
        });
        const diagnostics = program.getSemanticDiagnostics(sourceFile);
        expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);
    });

    it("resolves the Phase 7 indicator-composition surface without semantic errors", () => {
        const source = `
import type {
    CompiledScriptBundle,
    CompiledScriptObject,
    DependencyDeclaration,
    OutputDeclaration,
    ScriptManifest,
    Series,
} from "@invinite-org/chartlang-core";
import { defineIndicator, isCompiledScriptBundle, ta } from "@invinite-org/chartlang-core";

const baseTrend = defineIndicator({
    name: "Base Trend",
    apiVersion: 1,
    compute: ({ bar, plot }) => {
        plot(ta.ema(bar.close, 50), { title: "line" });
    },
});

const fastTrend = baseTrend.withInputs({ length: 20 });

export default defineIndicator({
    name: "Trend Confirmation",
    apiVersion: 1,
    compute: ({ plot }) => {
        const fast: Series<number> = fastTrend.output("line");
        plot(fast);
    },
});

declare const dep: DependencyDeclaration;
declare const out: OutputDeclaration;
declare const manifest: ScriptManifest;
declare const bundle: CompiledScriptBundle | CompiledScriptObject;
void dep;
void out;
void manifest.dependencies;
void manifest.outputs;
void manifest.exportName;
void manifest.siblings;
void manifest.isDrawn;
if (isCompiledScriptBundle(bundle)) {
    void bundle.primary;
}
`;
        const { program, sourceFile } = createProgramForSource(source, {
            sourcePath: "composition.chart.ts",
        });
        const diagnostics = program.getSemanticDiagnostics(sourceFile);
        expect(diagnostics.map((diagnostic) => diagnostic.messageText)).toEqual([]);
    });
});
