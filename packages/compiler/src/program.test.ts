// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { VALID_DEFINE } from "./__fixtures__/scripts";
import { COMPILER_OPTIONS, CORE_MODULE_PATH, createProgramForSource } from "./program";

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
});
