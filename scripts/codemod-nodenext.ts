#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Codemod: rewrite relative import/export/dynamic-import specifiers in chartlang
 * source files to NodeNext-style explicit `.js` extensions.
 *
 * Why: tsc emits relative specifiers verbatim. With `moduleResolution: "Bundler"`
 * TypeScript accepts `from "./foo"`, but Node's ESM loader (which consumers of
 * the published `dist/` use) requires an explicit `.js`. Without this rewrite,
 * every published package's `dist/index.js` fails to import under Node.
 *
 * Strategy: use the TypeScript compiler API to find each relative specifier,
 * resolve the on-disk target (file vs directory/index), and append the right
 * suffix. We never rewrite bare specifiers or already-suffixed ones.
 *
 * Scope (per the bug fix spec):
 *   - packages/<name>/src/**\/*.{ts,tsx}        (incl. tests + __fixtures__)
 *   - packages/<name>/scripts/**\/*.ts          (host-quickjs, host-worker)
 *   - examples/canvas2d-adapter/src/**\/*.{ts,tsx}
 *
 * Out of scope: node_modules, dist, coverage, examples/scripts/*.chart.js (compiled
 * artifacts), examples/react-demo (Vite app — keeps bundler resolution),
 * root scripts/ (tooling). The scratch harnesses (parity-smoke.mts and
 * examples/canvas2d-adapter/e2e-smoke.ts) are left alone unless NodeNext breaks
 * them.
 */

import { existsSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import ts from "typescript";

type RewriteSite = Readonly<{
    start: number;
    end: number;
    quote: string;
    oldSpecifier: string;
    newSpecifier: string;
}>;

type FileResult = Readonly<{
    file: string;
    rewrites: number;
}>;

const REPO_ROOT = resolvePath(import.meta.dirname, "..");

// File globs we walk. Concrete dir prefixes + a per-file filter keep this
// dependency-free; no glob lib needed.
const PACKAGE_DIRS: ReadonlyArray<string> = [
    "packages/adapter-kit",
    "packages/cli",
    "packages/compiler",
    "packages/conformance",
    "packages/core",
    "packages/editor",
    "packages/host-quickjs",
    "packages/host-worker",
    "packages/language-service",
    "packages/runtime",
];

const EXAMPLES_DIRS: ReadonlyArray<string> = ["examples/canvas2d-adapter/src"];

/**
 * Recursively collect .ts / .tsx files under `dir` that match the codemod
 * scope. We skip dist/, coverage/, node_modules/, and the auto-generated
 * compiled examples (`*.chart.js`, `*.chart.d.ts`).
 */
async function collectSourceFiles(dir: string): Promise<ReadonlyArray<string>> {
    const out: string[] = [];
    const { readdir } = await import("node:fs/promises");
    async function walk(current: string): Promise<void> {
        let entries: ReadonlyArray<{ name: string; isDirectory: () => boolean }>;
        try {
            entries = await readdir(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) {
                if (
                    entry.name === "node_modules" ||
                    entry.name === "dist" ||
                    entry.name === "coverage"
                ) {
                    continue;
                }
                await walk(full);
                continue;
            }
            if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
                if (entry.name.endsWith(".d.ts")) continue;
                out.push(full);
            }
        }
    }
    await walk(dir);
    return out;
}

/**
 * Decide what suffix to append to a relative specifier so Node's ESM loader
 * can resolve it. Returns `null` when the specifier already carries an explicit
 * extension we should not touch, or when no on-disk target is found (handle
 * these by leaving the specifier alone — the compiler will surface a real
 * error rather than us silently mangling intent).
 */
function rewriteSpecifier(fromFile: string, specifier: string): string | null {
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;

    const explicitExts = [".js", ".mjs", ".cjs", ".jsx", ".json", ".css", ".svg", ".wasm"];
    if (explicitExts.some((ext) => specifier.endsWith(ext))) return null;

    const basedir = dirname(fromFile);
    const target = resolvePath(basedir, specifier);

    // Direct file match: <target>.ts | <target>.tsx
    if (existsSync(`${target}.ts`)) return `${specifier}.js`;
    if (existsSync(`${target}.tsx`)) return `${specifier}.js`;

    // Directory match: <target>/index.ts | <target>/index.tsx
    if (existsSync(target) && statSync(target).isDirectory()) {
        if (existsSync(join(target, "index.ts"))) return `${specifier}/index.js`;
        if (existsSync(join(target, "index.tsx"))) return `${specifier}/index.js`;
    }
    return null;
}

/**
 * Walk a SourceFile and collect every rewrite site (offsets + replacement
 * string). We only edit specifier text; the surrounding statement is left
 * untouched. Returns sites sorted DESC by start so the caller can splice
 * without offset shifting.
 */
function collectRewrites(sourceFile: ts.SourceFile, filePath: string): ReadonlyArray<RewriteSite> {
    const sites: RewriteSite[] = [];
    const text = sourceFile.text;

    function record(stringLit: ts.StringLiteralLike): void {
        const oldSpec = stringLit.text;
        const newSpec = rewriteSpecifier(filePath, oldSpec);
        if (newSpec === null || newSpec === oldSpec) return;
        // stringLit positions include the quote characters
        const start = stringLit.getStart(sourceFile);
        const end = stringLit.getEnd();
        const quote = text.charAt(start);
        sites.push({
            start,
            end,
            quote,
            oldSpecifier: oldSpec,
            newSpecifier: newSpec,
        });
    }

    function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            record(node.moduleSpecifier);
        } else if (
            ts.isExportDeclaration(node) &&
            node.moduleSpecifier !== undefined &&
            ts.isStringLiteral(node.moduleSpecifier)
        ) {
            record(node.moduleSpecifier);
        } else if (ts.isImportEqualsDeclaration(node)) {
            // Rarely used; skip — these compile to require() in CJS only.
        } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length >= 1 &&
            ts.isStringLiteralLike(node.arguments[0])
        ) {
            record(node.arguments[0]);
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            // `typeof import("./foo").x` — type-position dynamic imports
            // still resolve through NodeNext rules.
            record(node.argument.literal);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    sites.sort((a, b) => b.start - a.start);
    return sites;
}

/**
 * Apply the collected rewrites to the file. We splice on character offsets
 * (descending order) so each edit doesn't disturb the others. The new
 * specifier is wrapped in the original quote character so we don't flip
 * single-quote to double-quote (Biome wouldn't care, but the diff stays
 * minimal).
 */
function applyRewrites(text: string, sites: ReadonlyArray<RewriteSite>): string {
    let result = text;
    for (const site of sites) {
        const before = result.slice(0, site.start);
        const after = result.slice(site.end);
        result = `${before}${site.quote}${site.newSpecifier}${site.quote}${after}`;
    }
    return result;
}

async function processFile(filePath: string): Promise<FileResult> {
    const text = await readFile(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.ES2022,
        /*setParentNodes*/ true,
        filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const sites = collectRewrites(sourceFile, filePath);
    if (sites.length === 0) return { file: filePath, rewrites: 0 };
    const next = applyRewrites(text, sites);
    await writeFile(filePath, next, "utf8");
    return { file: filePath, rewrites: sites.length };
}

async function main(): Promise<void> {
    const allFiles: string[] = [];
    for (const pkg of PACKAGE_DIRS) {
        const srcDir = resolvePath(REPO_ROOT, pkg, "src");
        if (existsSync(srcDir)) {
            allFiles.push(...(await collectSourceFiles(srcDir)));
        }
        const scriptsDir = resolvePath(REPO_ROOT, pkg, "scripts");
        if (existsSync(scriptsDir)) {
            allFiles.push(...(await collectSourceFiles(scriptsDir)));
        }
    }
    for (const dir of EXAMPLES_DIRS) {
        const target = resolvePath(REPO_ROOT, dir);
        if (existsSync(target)) {
            allFiles.push(...(await collectSourceFiles(target)));
        }
    }

    let totalRewrites = 0;
    let touchedFiles = 0;
    for (const file of allFiles) {
        const res = await processFile(file);
        if (res.rewrites > 0) {
            touchedFiles += 1;
            totalRewrites += res.rewrites;
            console.log(`  ${relative(REPO_ROOT, file)}: ${res.rewrites}`);
        }
    }
    console.log("");
    console.log(`Scanned ${allFiles.length} files.`);
    console.log(`Rewrote ${totalRewrites} specifiers across ${touchedFiles} files.`);
}

await main();
