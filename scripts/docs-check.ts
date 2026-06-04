#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
/**
 * Enforces §17.6 + §17.2: every exported symbol in every workspace
 * package's `src/**\/*.ts` has a JSDoc block with `@since` and
 * `@example`, and (for `src/ta/` or `src/draw/` namespaces)
 * `@formula` + `@anchors` and one of `@stable` / `@experimental`.
 *
 * Bootstrap opt-out: `PACKAGE_VERSION` is exempt (see EXEMPT_EXPORTS).
 *
 * Exits 0 on a clean tree, 1 on any violation. Prints every violation
 * so a contributor sees the full punch-list per run.
 */
import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import ts from "typescript";

import { executeExampleBlock } from "./docs-check.executor";

// EXEMPT_EXPORTS: kept for any future bootstrap exemption. Emptied after
// the Phase-1 compiler API landed and every placeholder gained a JSDoc
// shim.
const EXEMPT_EXPORTS = new Set<string>();

const ROOT = process.cwd();

type Violation = { file: string; line: number; name: string; reason: string };

const violations: Violation[] = [];

function record(file: string, line: number, name: string, reason: string): void {
    violations.push({ file: relative(ROOT, file), line, name, reason });
}

async function collectSourceFiles(dir: string, out: string[]): Promise<void> {
    if (!existsSync(dir)) return;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "__fixtures__" || entry.name === "node_modules") continue;
            await collectSourceFiles(full, out);
            continue;
        }
        if (!entry.isFile()) continue;
        if (!full.endsWith(".ts")) continue;
        if (full.endsWith(".test.ts") || full.endsWith(".bench.test.ts")) continue;
        if (full.endsWith(".d.ts")) continue;
        out.push(full);
    }
}

async function listSourceFiles(): Promise<string[]> {
    const out: string[] = [];
    const packagesDir = join(ROOT, "packages");
    if (existsSync(packagesDir)) {
        const entries = await readdir(packagesDir);
        for (const entry of entries) {
            const pkgDir = join(packagesDir, entry);
            const s = await stat(pkgDir);
            if (s.isDirectory()) await collectSourceFiles(join(pkgDir, "src"), out);
        }
    }
    await collectSourceFiles(join(ROOT, "examples/canvas2d-adapter/src"), out);
    return out;
}

function isExported(node: ts.Node): boolean {
    const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!mods) return false;
    return mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function getJsDocTagsFor(node: ts.Node): readonly ts.JSDocTag[] {
    return ts.getJSDocTags(node);
}

function hasJsDocBlock(node: ts.Node): boolean {
    const jsDocs = (node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc;
    return Array.isArray(jsDocs) && jsDocs.length > 0;
}

function exampleHasCodeBlock(tag: ts.JSDocTag): boolean {
    const comment = tag.comment;
    const text = typeof comment === "string" ? comment : ts.getTextOfJSDocComment(comment);
    if (!text) return false;
    if (text.includes("```")) return true;
    return text.split("\n").some((line) => /^\s{4,}\S/.test(line));
}

function exportedNamesFor(node: ts.Node): { name: string; lineNode: ts.Node }[] {
    if (ts.isVariableStatement(node)) {
        return node.declarationList.declarations.flatMap((decl) => {
            if (ts.isIdentifier(decl.name)) {
                return [{ name: decl.name.text, lineNode: decl }];
            }
            return [];
        });
    }
    if (
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)
    ) {
        if (node.name) return [{ name: node.name.text, lineNode: node }];
        return [{ name: "default", lineNode: node }];
    }
    if (ts.isExportAssignment(node)) {
        return [{ name: "default", lineNode: node }];
    }
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        return node.exportClause.elements.map((el) => ({
            name: el.name.text,
            lineNode: el,
        }));
    }
    return [];
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
    return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function isTaOrDrawSource(filePath: string): boolean {
    const rel = relative(ROOT, filePath).replace(/\\/g, "/");
    return /\/src\/ta\//.test(rel) || /\/src\/draw\//.test(rel);
}

async function checkExport(source: ts.SourceFile, node: ts.Node, filePath: string): Promise<void> {
    const exports = exportedNamesFor(node);
    if (exports.length === 0) return;

    const tags = getJsDocTagsFor(node);
    const hasBlock = hasJsDocBlock(node);
    const requireTaDraw = isTaOrDrawSource(filePath);

    const executions: Promise<void>[] = [];
    for (const { name, lineNode } of exports) {
        if (EXEMPT_EXPORTS.has(name)) continue;
        const line = lineOf(source, lineNode);

        if (!hasBlock) {
            record(filePath, line, name, "missing JSDoc block");
            continue;
        }

        const hasSince = tags.some((t) => t.tagName.text === "since");
        if (!hasSince) record(filePath, line, name, "missing @since");

        const exampleTag = tags.find((t) => t.tagName.text === "example");
        if (!exampleTag) {
            record(filePath, line, name, "missing @example");
        } else if (!exampleHasCodeBlock(exampleTag)) {
            record(filePath, line, name, "@example missing code block (fenced or indented)");
        } else {
            const commentText =
                typeof exampleTag.comment === "string"
                    ? exampleTag.comment
                    : (ts.getTextOfJSDocComment(exampleTag.comment) ?? "");
            executions.push(
                executeExampleBlock({
                    source: commentText,
                    file: filePath,
                    line,
                    name,
                    record,
                }),
            );
        }

        if (requireTaDraw) {
            const hasFormula = tags.some((t) => t.tagName.text === "formula");
            const hasStability = tags.some(
                (t) => t.tagName.text === "stable" || t.tagName.text === "experimental",
            );
            const rel = relative(ROOT, filePath).replace(/\\/g, "/");
            if (/\/src\/ta\//.test(rel)) {
                if (!hasFormula) record(filePath, line, name, "missing @formula (ta namespace)");
                if (!hasStability) {
                    record(filePath, line, name, "missing @stable or @experimental (ta namespace)");
                }
            } else {
                const hasAnchors = tags.some((t) => t.tagName.text === "anchors");
                if (!hasFormula) record(filePath, line, name, "missing @formula (draw namespace)");
                if (!hasAnchors) record(filePath, line, name, "missing @anchors (draw namespace)");
                if (!hasStability) {
                    record(
                        filePath,
                        line,
                        name,
                        "missing @stable or @experimental (draw namespace)",
                    );
                }
            }
        }
    }

    await Promise.all(executions);
}

async function checkFile(filePath: string): Promise<number> {
    const text = await readFile(filePath, "utf8");
    const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2022, true);
    let count = 0;
    for (const statement of source.statements) {
        // Skip re-export declarations (`export { x } from "./y"` and
        // `export * from "./y"`). The original declaration carries the
        // JSDoc; the barrel only forwards names.
        if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined) {
            continue;
        }
        if (
            ts.isExportDeclaration(statement) ||
            ts.isExportAssignment(statement) ||
            isExported(statement)
        ) {
            const exports = exportedNamesFor(statement);
            count += exports.length;
            await checkExport(source, statement, filePath);
        }
    }
    return count;
}

async function main(): Promise<void> {
    const files = await listSourceFiles();
    let total = 0;
    for (const file of files) {
        total += await checkFile(file);
    }
    for (const v of violations) {
        console.error(`${v.file}:${v.line}: ${v.name} ${v.reason}`);
    }
    console.log(
        `\n${total} exported symbols checked across ${files.length} files, ${violations.length} violations.`,
    );
    process.exit(violations.length > 0 ? 1 : 0);
}

await main();
