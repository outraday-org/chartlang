// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC_DIR = fileURLToPath(new URL(".", import.meta.url));
const PACKAGE_JSON = fileURLToPath(new URL("../package.json", import.meta.url));

// Bare (non-relative) module specifiers the MAIN entry's graph is allowed to
// reach. Deliberately empty: the root entry is zero-dependency, which is what
// makes "no `node:` at any depth" a property of the whole graph rather than of
// the files we happen to own. Adding a runtime dependency to the main entry is
// therefore a one-line decision here, not an accident.
const ALLOWED_BARE_IMPORTS: ReadonlySet<string> = new Set<string>();

// Every module specifier `file` imports/exports from, including `import type`,
// `export … from`, and dynamic `import("…")`. The TS Compiler API is used
// rather than a regex so a `node:` substring inside a string literal or a
// comment never trips the assertion.
function specifiersOf(file: string): readonly string[] {
    const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.ESNext,
        true,
    );
    const out: string[] = [];
    const visit = (node: ts.Node): void => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier !== undefined &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            out.push(node.moduleSpecifier.text);
        }
        if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] !== undefined &&
            ts.isStringLiteral(node.arguments[0])
        ) {
            out.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return out;
}

// Map a relative NodeNext specifier (`./codegen/index.js`) back to the source
// file it was authored as (`./codegen/index.ts`). Returns null when nothing on
// disk matches, which the walk reports as an unresolved specifier rather than
// silently skipping — an unresolvable edge would hide the rest of that subtree.
function resolveRelative(fromFile: string, specifier: string): string | null {
    const base = resolve(dirname(fromFile), specifier);
    const candidates = [base.replace(/\.js$/, ".ts"), base, `${base}/index.ts`];
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

type Walk = {
    readonly nodeSpecifiers: readonly string[];
    readonly bareSpecifiers: readonly string[];
    readonly unresolved: readonly string[];
    readonly visited: readonly string[];
};

// Transitively walk the import graph rooted at `entry`, following relative
// edges only (bare specifiers are recorded, not entered — a dependency's own
// graph is its package's contract, and the allowlist above keeps that set at
// zero for the main entry).
function walkGraph(entry: string): Walk {
    const nodeSpecifiers: string[] = [];
    const bareSpecifiers: string[] = [];
    const unresolved: string[] = [];
    const visited = new Set<string>();
    const queue = [entry];
    for (;;) {
        const file = queue.pop();
        if (file === undefined) break;
        if (visited.has(file)) continue;
        visited.add(file);
        for (const specifier of specifiersOf(file)) {
            if (specifier.startsWith("node:")) {
                nodeSpecifiers.push(`${file} → ${specifier}`);
                continue;
            }
            if (!specifier.startsWith(".")) {
                bareSpecifiers.push(specifier);
                continue;
            }
            const target = resolveRelative(file, specifier);
            if (target === null) {
                unresolved.push(`${file} → ${specifier}`);
                continue;
            }
            queue.push(target);
        }
    }
    return { nodeSpecifiers, bareSpecifiers, unresolved, visited: [...visited] };
}

describe("main entry is node-free (TS import-graph walk)", () => {
    const mainWalk = walkGraph(resolve(SRC_DIR, "index.ts"));

    it("resolves every relative edge it follows", () => {
        expect(mainWalk.unresolved).toEqual([]);
    });

    it("reaches the whole pipeline (the walk is not silently empty)", () => {
        // Guards the assertions below against a resolution bug that would make
        // an empty graph look like a clean one.
        expect(mainWalk.visited.length).toBeGreaterThan(10);
    });

    it("contains zero node: specifiers at any depth", () => {
        expect(mainWalk.nodeSpecifiers).toEqual([]);
    });

    it("pulls in no bare dependency outside the allowlist", () => {
        const disallowed = mainWalk.bareSpecifiers.filter(
            (specifier) => !ALLOWED_BARE_IMPORTS.has(specifier),
        );
        expect(disallowed).toEqual([]);
    });

    it("still detects node: on the /node entry (positive control)", () => {
        const nodeWalk = walkGraph(resolve(SRC_DIR, "node.ts"));
        expect(nodeWalk.nodeSpecifiers.some((entry) => entry.endsWith("node:fs/promises"))).toBe(
            true,
        );
    });
});

describe("package exports map", () => {
    const manifest: { exports: Record<string, unknown> } = JSON.parse(
        readFileSync(PACKAGE_JSON, "utf8"),
    );

    it("declares ./node with a default condition", () => {
        // The downstream consumer probe is literally
        // `require.resolve("@invinite-org/chartlang-pine-converter/node")`,
        // which resolves under the ["node", "require", "default"] condition
        // set. A {types, import}-only entry throws ERR_PACKAGE_PATH_NOT_EXPORTED.
        expect(manifest.exports["./node"]).toEqual({
            types: "./dist/node.d.ts",
            import: "./dist/node.js",
            default: "./dist/node.js",
        });
    });

    it("carries a default condition on every conditional entry", () => {
        const missing = Object.entries(manifest.exports)
            .filter(
                (entry): entry is [string, Record<string, unknown>] =>
                    typeof entry[1] === "object" && entry[1] !== null,
            )
            .filter(([, value]) => !("default" in value))
            .map(([subpath]) => subpath);
        expect(missing).toEqual([]);
    });
});
