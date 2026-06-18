// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

type HoverRegistryEntry = Readonly<{
    fqn: string;
    kind: "function" | "namespace" | "property" | "type";
    title: string;
    summary: string;
    paramTable?: ReadonlyArray<{ name: string; type: string; doc: string }>;
    examples?: ReadonlyArray<string>;
    since: string;
    stability: "stable";
}>;

type GenerateHoverRegistryOptions = Readonly<{
    coreSrcDir?: string;
    outputFile?: string;
    check?: boolean;
}>;

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CORE_SRC = join(REPO_ROOT, "packages/core/src");
const DEFAULT_OUTPUT = join(REPO_ROOT, "packages/language-service/src/hoverRegistry.generated.ts");

/**
 * Generate the checked-in language-service hover registry from core JSDoc.
 *
 * @since 0.4
 * @stable
 * @example
 *     await generateHoverRegistry({ check: true });
 */
export async function generateHoverRegistry(
    opts: GenerateHoverRegistryOptions = {},
): Promise<void> {
    const coreSrcDir = opts.coreSrcDir ?? DEFAULT_CORE_SRC;
    const outputFile = opts.outputFile ?? DEFAULT_OUTPUT;
    const entries = await collectHoverRegistryEntries(coreSrcDir);
    const contents = renderRegistry(entries);

    if (opts.check === true) {
        let existing = "";
        try {
            existing = await readFile(outputFile, "utf8");
        } catch {
            throw new Error(`Hover registry is missing: ${relative(REPO_ROOT, outputFile)}`);
        }
        if (existing !== contents) {
            throw new Error(
                `Hover registry is out of date. Run pnpm gen-hover-registry and commit ${relative(
                    REPO_ROOT,
                    outputFile,
                )}.`,
            );
        }
        return;
    }

    await writeFile(outputFile, contents, "utf8");
}

/**
 * Collect hover registry entries from a core source directory.
 *
 * @since 0.4
 * @stable
 * @example
 *     const entries = await collectHoverRegistryEntries("packages/core/src");
 *     void entries;
 */
export async function collectHoverRegistryEntries(
    coreSrcDir: string,
): Promise<ReadonlyArray<HoverRegistryEntry>> {
    const files = await walkCoreFiles(coreSrcDir);
    const entries: HoverRegistryEntry[] = [];

    for (const file of files) {
        const source = await readFile(file, "utf8");
        const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
        for (const statement of sourceFile.statements) {
            entries.push(...entriesFromStatement(statement, sourceFile));
        }
    }

    return Object.freeze(
        entries
            .filter((entry) => entry.summary.length > 0 && entry.since.length > 0)
            .sort((a, b) => a.fqn.localeCompare(b.fqn)),
    );
}

function entriesFromStatement(
    statement: ts.Statement,
    sourceFile: ts.SourceFile,
): ReadonlyArray<HoverRegistryEntry> {
    if (!hasExportModifier(statement)) return [];

    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
        return [entryForFunction(statement.name.text, statement, statement, sourceFile)];
    }
    if (ts.isTypeAliasDeclaration(statement)) {
        const entries = [entryForType(statement.name.text, statement, sourceFile)];
        entries.push(...entriesFromNamespaceType(statement, sourceFile));
        return entries;
    }
    if (ts.isInterfaceDeclaration(statement)) {
        return [entryForType(statement.name.text, statement, sourceFile)];
    }
    if (ts.isVariableStatement(statement)) {
        const entries: HoverRegistryEntry[] = [];
        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name)) continue;
            entries.push(...entriesFromVariable(declaration, statement, sourceFile));
        }
        return entries;
    }
    return [];
}

function entriesFromVariable(
    declaration: ts.VariableDeclaration,
    statement: ts.VariableStatement,
    sourceFile: ts.SourceFile,
): ReadonlyArray<HoverRegistryEntry> {
    const name = declaration.name.text;
    const objectLiteral = unwrapObjectLiteral(declaration.initializer);
    if (objectLiteral === null) {
        return [entryForProperty(name, statement, sourceFile)];
    }

    const entries: HoverRegistryEntry[] = [entryForNamespace(name, statement, sourceFile)];
    for (const property of objectLiteral.properties) {
        entries.push(...entriesFromObjectProperty(name, property, sourceFile));
    }
    return entries;
}

function functionDeclarationsNamed(
    sourceFile: ts.SourceFile,
    name: string,
): ReadonlyArray<ts.FunctionDeclaration> {
    return sourceFile.statements.filter(
        (statement): statement is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(statement) && statement.name?.text === name,
    );
}

function entriesFromObjectProperty(
    namespace: string,
    property: ts.ObjectLiteralElementLike,
    sourceFile: ts.SourceFile,
): ReadonlyArray<HoverRegistryEntry> {
    // `Object.freeze({ security, lowerTf })` shorthands reference a top-level
    // `function security(...)` whose overload signatures carry the JSDoc on the
    // first declaration and the parameters on the implementation. Prefer the
    // documented declaration so the hover summary / `@since` resolve, but read
    // the printed signature from the same node (the first overload).
    if (ts.isShorthandPropertyAssignment(property)) {
        const fqn = `${namespace}.${property.name.text}`;
        const decls = functionDeclarationsNamed(sourceFile, property.name.text);
        const documented = decls.find((decl) => readJsDoc(decl).summary.length > 0);
        const target = documented ?? decls[0];
        if (target === undefined) return [];
        return [entryForFunction(fqn, target, target, sourceFile)];
    }
    if (
        (ts.isMethodDeclaration(property) || ts.isPropertyAssignment(property)) &&
        property.name !== undefined
    ) {
        const name = propertyNameText(property.name);
        if (name === null) return [];
        const fqn = `${namespace}.${name}`;
        if (ts.isMethodDeclaration(property)) {
            return [entryForFunction(fqn, property, property, sourceFile)];
        }
        const nested = unwrapObjectLiteral(property.initializer);
        if (nested !== null) {
            const out: HoverRegistryEntry[] = [entryForNamespace(fqn, property, sourceFile)];
            for (const child of nested.properties) {
                out.push(...entriesFromObjectProperty(fqn, child, sourceFile));
            }
            return out;
        }
        return [entryForProperty(fqn, property, sourceFile)];
    }
    return [];
}

function entryForFunction(
    fqn: string,
    node: ts.SignatureDeclarationBase,
    docsNode: ts.Node,
    sourceFile: ts.SourceFile,
): HoverRegistryEntry {
    const docs = readJsDoc(docsNode);
    const paramTable = node.parameters.map((param) => {
        const name = param.name.getText(sourceFile);
        return Object.freeze({
            name,
            type: param.type?.getText(sourceFile) ?? "unknown",
            doc: docs.params.get(name) ?? "",
        });
    });
    return freezeEntry({
        fqn,
        kind: "function",
        title: `${fqn}(${node.parameters.map(formatParameter).join(", ")})`,
        summary: docs.summary,
        ...(paramTable.length === 0 ? {} : { paramTable: Object.freeze(paramTable) }),
        ...(docs.examples.length === 0 ? {} : { examples: Object.freeze(docs.examples) }),
        since: docs.since,
        stability: docs.stability,
    });
}

function entriesFromNamespaceType(
    node: ts.TypeAliasDeclaration,
    sourceFile: ts.SourceFile,
): ReadonlyArray<HoverRegistryEntry> {
    if (!node.name.text.endsWith("Namespace")) return [];
    if (!ts.isTypeLiteralNode(node.type)) return [];
    const namespace = namespaceNameFromType(node.name.text);
    const parentDocs = readJsDoc(node);
    const entries: HoverRegistryEntry[] = [];
    for (const member of node.type.members) {
        if (!ts.isMethodSignature(member)) continue;
        const name = propertyNameText(member.name);
        if (name === null) continue;
        const fqn = `${namespace}.${name}`;
        const docs = readJsDoc(member);
        const summary =
            docs.summary.length === 0 ? `${parentDocs.summary} Method: ${fqn}.` : docs.summary;
        const since = docs.since.length === 0 ? parentDocs.since : docs.since;
        const stability = docs.stability ?? parentDocs.stability;
        const paramTable = member.parameters.map((param) =>
            Object.freeze({
                name: param.name.getText(sourceFile),
                type: param.type?.getText(sourceFile) ?? "unknown",
                doc: "",
            }),
        );
        entries.push(
            freezeEntry({
                fqn,
                kind: "function",
                title: `${fqn}(${member.parameters.map(formatParameter).join(", ")})`,
                summary,
                ...(paramTable.length === 0 ? {} : { paramTable: Object.freeze(paramTable) }),
                since,
                stability,
            }),
        );
    }
    return entries;
}

function entryForType(fqn: string, node: ts.Node, sourceFile: ts.SourceFile): HoverRegistryEntry {
    const docs = readJsDoc(node);
    return freezeEntry({
        fqn,
        kind: "type",
        title: fqn,
        summary: docs.summary,
        ...(docs.examples.length === 0 ? {} : { examples: Object.freeze(docs.examples) }),
        since: docs.since,
        stability: docs.stability,
    });
}

function entryForNamespace(
    fqn: string,
    node: ts.Node,
    sourceFile: ts.SourceFile,
): HoverRegistryEntry {
    const docs = readJsDoc(node);
    return freezeEntry({
        fqn,
        kind: "namespace",
        title: fqn,
        summary: docs.summary,
        ...(docs.examples.length === 0 ? {} : { examples: Object.freeze(docs.examples) }),
        since: docs.since,
        stability: docs.stability,
    });
}

function entryForProperty(
    fqn: string,
    node: ts.Node,
    sourceFile: ts.SourceFile,
): HoverRegistryEntry {
    const docs = readJsDoc(node);
    return freezeEntry({
        fqn,
        kind: "property",
        title: fqn,
        summary: docs.summary,
        ...(docs.examples.length === 0 ? {} : { examples: Object.freeze(docs.examples) }),
        since: docs.since,
        stability: docs.stability,
    });
}

function freezeEntry(entry: HoverRegistryEntry): HoverRegistryEntry {
    return Object.freeze(entry);
}

function readJsDoc(node: ts.Node): {
    summary: string;
    params: ReadonlyMap<string, string>;
    examples: ReadonlyArray<string>;
    since: string;
    stability: "stable";
} {
    const jsDocs = getJsDocs(node);
    const last = jsDocs[jsDocs.length - 1];
    if (last === undefined) {
        return {
            summary: "",
            params: new Map(),
            examples: [],
            since: "",
            stability: "stable",
        };
    }

    const params = new Map<string, string>();
    const examples: string[] = [];
    let since = "";
    let stability = "stable" as const;

    for (const tag of last.tags ?? []) {
        const tagName = tag.tagName.text;
        if (tagName === "param" && ts.isJSDocParameterTag(tag)) {
            params.set(tag.name.getText(), commentToText(tag.comment));
        } else if (tagName === "example") {
            examples.push(commentToText(tag.comment));
        } else if (tagName === "since") {
            since = commentToText(tag.comment);
        } else if (tagName === "stable") {
            stability = "stable";
        }
    }

    return {
        summary: firstParagraph(commentToText(last.comment)),
        params,
        examples,
        since,
        stability,
    };
}

function getJsDocs(node: ts.Node): readonly ts.JSDoc[] {
    const withDocs = node as ts.Node & { readonly jsDoc?: readonly ts.JSDoc[] };
    return withDocs.jsDoc ?? [];
}

function commentToText(comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string {
    if (comment === undefined) return "";
    if (typeof comment === "string") return normalizeWhitespace(comment);
    return normalizeWhitespace(comment.map((part) => part.getText()).join(" "));
}

function firstParagraph(comment: string): string {
    const paragraphs = comment
        .split(/\n\s*\n/u)
        .map((part) => normalizeWhitespace(part))
        .filter((part) => part.length > 0);
    return paragraphs[0] ?? "";
}

function normalizeWhitespace(value: string): string {
    return value
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.replace(/^\s*\*\s?/u, "").trim())
        .join("\n")
        .trim();
}

function formatParameter(param: ts.ParameterDeclaration): string {
    const name = param.name.getText();
    return param.questionToken === undefined ? name : `${name}?`;
}

function propertyNameText(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
        return name.text;
    return null;
}

function namespaceNameFromType(typeName: string): string {
    const base = typeName.slice(0, -"Namespace".length);
    return `${base.slice(0, 1).toLowerCase()}${base.slice(1)}`;
}

function unwrapObjectLiteral(node: ts.Expression | undefined): ts.ObjectLiteralExpression | null {
    if (node === undefined) return null;
    if (ts.isObjectLiteralExpression(node)) return node;
    if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText() === "Object" &&
        node.expression.name.text === "freeze"
    ) {
        const first = node.arguments[0];
        return first !== undefined && ts.isObjectLiteralExpression(first) ? first : null;
    }
    return null;
}

function hasExportModifier(node: ts.Node): boolean {
    return (
        ts.canHaveModifiers(node) &&
        (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    );
}

async function walkCoreFiles(root: string): Promise<string[]> {
    const out: string[] = [];
    const queue = [root];
    for (;;) {
        const current = queue.shift();
        if (current === undefined) break;
        const entries = await readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const full = join(current, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === "__fixtures__") continue;
                queue.push(full);
                continue;
            }
            if (!entry.isFile()) continue;
            if (!entry.name.endsWith(".ts")) continue;
            if (entry.name.endsWith(".test.ts") || entry.name === "index.ts") continue;
            out.push(full);
        }
    }
    return out.sort();
}

function renderRegistry(entries: ReadonlyArray<HoverRegistryEntry>): string {
    const lines = [
        "// Copyright (c) 2026 Invinite. Licensed under the MIT License.",
        "// See the LICENSE file in the repo root for full license text.",
        "",
        "// Generated by scripts/gen-hover-registry.ts. Do not edit by hand.",
        "",
        "/**",
        " * Generated hover-registry entry extracted from core JSDoc.",
        " *",
        " * @since 0.4",
        " * @stable",
        " * @example",
        ' *     const entry: HoverRegistryEntry = HOVER_REGISTRY["ta.ema"];',
        " *     void entry;",
        " */",
        "export type HoverRegistryEntry = Readonly<{",
        "    fqn: string;",
        '    kind: "function" | "namespace" | "property" | "type";',
        "    title: string;",
        "    summary: string;",
        "    paramTable?: ReadonlyArray<{ name: string; type: string; doc: string }>;",
        "    examples?: ReadonlyArray<string>;",
        "    since: string;",
        '    stability: "stable";',
        "}>;",
        "",
        "/**",
        " * Generated map of fully-qualified core symbols to hover docs.",
        " *",
        " * @since 0.4",
        " * @stable",
        " * @example",
        ' *     const hover = HOVER_REGISTRY["ta.ema"];',
        " *     void hover;",
        " */",
        "// biome-ignore format: generated registry is emitted deterministically.",
        "export const HOVER_REGISTRY: Readonly<Record<string, HoverRegistryEntry>> = Object.freeze(",
        `${JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.fqn, entry])), null, 4)} as const,`,
        ");",
        "",
    ];
    return lines.join("\n");
}

function parseArgs(argv: ReadonlyArray<string>): GenerateHoverRegistryOptions {
    const opts: { coreSrcDir?: string; outputFile?: string; check?: boolean } = {};
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "--") continue;
        if (arg === "--check") {
            opts.check = true;
            continue;
        }
        if (arg === "--core-src-dir") {
            const value = argv[i + 1];
            if (value === undefined) throw new Error("--core-src-dir requires a value");
            opts.coreSrcDir = resolve(value);
            i += 1;
            continue;
        }
        if (arg === "--output") {
            const value = argv[i + 1];
            if (value === undefined) throw new Error("--output requires a value");
            opts.outputFile = resolve(value);
            i += 1;
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
    return opts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    generateHoverRegistry(parseArgs(process.argv.slice(2))).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error(message);
        process.exitCode = 1;
    });
}
