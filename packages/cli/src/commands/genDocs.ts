// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve as resolvePath } from "node:path";

import ts from "typescript";

/**
 * Structured payload the renderer consumes — one per primitive. Lifted
 * to a named type so {@link generateDocsPage} can be unit-tested
 * without spinning up the TS compiler.
 *
 * @since 0.2
 * @stable
 * @example
 *     // const input: PrimitiveDocInput = {
 *     //     id: "sma", signature: "function sma(...)",
 *     //     description: "Simple moving average.",
 *     //     formula: "out = mean(window)", warmup: "length − 1",
 *     //     since: "0.1", stability: "stable",
 *     //     params: [], returns: "Series<number>",
 *     //     example: "// ta.sma(\"slot\", bar.close, 20)",
 *     //     sourceUrl: "https://example.invalid/sma.ts",
 *     // };
 *     // const md = generateDocsPage(input);
 */
export type PrimitiveDocInput = Readonly<{
    id: string;
    signature: string;
    description: string;
    formula: string;
    warmup: string;
    anchors?: string;
    since: string;
    stability: "stable" | "frozen";
    params: ReadonlyArray<
        Readonly<{ name: string; type: string; defaultValue: string; description: string }>
    >;
    returns: string;
    example: string;
    sourceUrl: string;
}>;

/**
 * Structured error the generator throws when a primitive's JSDoc is
 * missing a required tag. Carries a stable `code` so consumers can
 * branch on the failure class without parsing the message.
 *
 * @since 0.2
 * @stable
 * @example
 *     // try { parsePrimitiveSource(...); } catch (e) {
 *     //   if (e instanceof GenDocsError && e.code === "missing-formula") { ... }
 *     // }
 */
export class GenDocsError extends Error {
    readonly code: string;
    readonly file: string;
    constructor(code: string, file: string, message: string) {
        super(`[${code}] ${file}: ${message}`);
        this.code = code;
        this.file = file;
        this.name = "GenDocsError";
    }
}

const SKIP_BASENAMES = new Set(["index.ts", "persistence.ts", "registry.ts", "sourceValue.ts"]);
const SKIP_SUFFIXES = [
    ".test.ts",
    ".bench.ts",
    ".bench.test.ts",
    ".golden.test.ts",
    ".property.test.ts",
];

function isSkippableFile(filePath: string): boolean {
    const base = basename(filePath);
    if (SKIP_BASENAMES.has(base)) return true;
    for (const suffix of SKIP_SUFFIXES) {
        if (base.endsWith(suffix)) return true;
    }
    return false;
}

function commentText(comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string {
    if (typeof comment === "string") return comment.trim();
    // `ts.getTextOfJSDocComment` handles both `undefined` (returns
    // `undefined`) and `NodeArray<JSDocComment>` (returns the joined
    // text). Collapse both into the empty string when missing.
    return (ts.getTextOfJSDocComment(comment) ?? "").trim();
}

function tagText(tag: ts.JSDocTag): string {
    return commentText(tag.comment);
}

function findTag(tags: readonly ts.JSDocTag[], name: string): ts.JSDocTag | undefined {
    return tags.find((t) => t.tagName.text === name);
}

function findParamTag(tags: readonly ts.JSDocTag[], paramName: string): ts.JSDocTag | undefined {
    return tags.find(
        (t) =>
            t.tagName.text === "param" &&
            ts.isJSDocParameterTag(t) &&
            ts.isIdentifier(t.name) &&
            t.name.text === paramName,
    );
}

function stabilityOf(tags: readonly ts.JSDocTag[]): "stable" | "frozen" | null {
    if (findTag(tags, "stable")) return "stable";
    if (findTag(tags, "frozen")) return "frozen";
    return null;
}

function descriptionOf(node: ts.Node): string {
    // Callers in this file only invoke `descriptionOf` after
    // `pickPrimitive` accepted the node, which requires the JSDoc block
    // carrying `@formula` etc. — so `jsDoc[0]` is always present.
    const jsDocs = (node as ts.Node & { jsDoc?: ts.JSDoc[] }).jsDoc;
    return commentText(jsDocs?.[0]?.comment);
}

function printSignature(source: ts.SourceFile, fn: ts.FunctionDeclaration): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
    const stripped = ts.factory.updateFunctionDeclaration(
        fn,
        fn.modifiers?.filter((m) => m.kind !== ts.SyntaxKind.ExportKeyword),
        fn.asteriskToken,
        fn.name,
        fn.typeParameters,
        fn.parameters,
        fn.type,
        undefined,
    );
    return printer.printNode(ts.EmitHint.Unspecified, stripped, source);
}

function printType(source: ts.SourceFile, typeNode: ts.TypeNode | undefined): string {
    if (typeNode === undefined) return "unknown";
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: true });
    return printer.printNode(ts.EmitHint.Unspecified, typeNode, source);
}

function paramName(p: ts.ParameterDeclaration): string {
    if (ts.isIdentifier(p.name)) return p.name.text;
    return "<binding>";
}

function paramsOf(
    source: ts.SourceFile,
    fn: ts.FunctionDeclaration,
    tags: readonly ts.JSDocTag[],
): PrimitiveDocInput["params"] {
    return fn.parameters.map((p) => {
        const name = paramName(p);
        const type = printType(source, p.type);
        const defaultValue = p.initializer
            ? ts
                  .createPrinter({ removeComments: true })
                  .printNode(ts.EmitHint.Unspecified, p.initializer, source)
            : p.questionToken !== undefined
              ? "(optional)"
              : "—";
        const tag = findParamTag(tags, name);
        const description = tag ? tagText(tag) : "—";
        return { name, type, defaultValue, description };
    });
}

function returnsOf(
    source: ts.SourceFile,
    fn: ts.FunctionDeclaration,
    tags: readonly ts.JSDocTag[],
): string {
    const ret = findTag(tags, "returns");
    if (ret) return tagText(ret);
    return printType(source, fn.type);
}

function buildSourceUrl(repoUrl: string, runtimeRelPath: string): string {
    const trimmed = repoUrl.replace(/\.git$/, "").replace(/\/+$/, "");
    return `${trimmed}/blob/main/${runtimeRelPath}`;
}

function pickPrimitive(
    source: ts.SourceFile,
    id: string,
): { node: ts.FunctionDeclaration; tags: readonly ts.JSDocTag[] } | null {
    for (const stmt of source.statements) {
        if (!ts.isFunctionDeclaration(stmt)) continue;
        if (stmt.name?.text !== id) continue;
        const hasExport = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!hasExport) continue;
        return { node: stmt, tags: ts.getJSDocTags(stmt) };
    }
    return null;
}

/**
 * Parse a primitive source file via the TypeScript compiler API. Returns
 * the structured {@link PrimitiveDocInput} on success; throws
 * {@link GenDocsError} when the file is missing a required JSDoc tag
 * (`@formula`, `@warmup`, `@since`, `@example`, stability marker) or
 * the expected `export function <id>` declaration.
 *
 * `repoUrl` is the runtime package's `repository.url` (used to build
 * the "Source on GitHub" link in the rendered page).
 * `runtimeRelPath` is the path of the source file relative to the
 * repo root (e.g. `packages/runtime/src/ta/sma.ts`).
 *
 * @since 0.2
 * @stable
 * @example
 *     // import { parsePrimitiveSource } from "@invinite-org/chartlang-cli";
 *     // const input = await parsePrimitiveSource("/abs/sma.ts", {
 *     //     repoUrl: "https://github.com/o/r.git",
 *     //     runtimeRelPath: "packages/runtime/src/ta/sma.ts",
 *     // });
 */
export async function parsePrimitiveSource(
    filePath: string,
    opts: Readonly<{ repoUrl: string; runtimeRelPath: string }>,
): Promise<PrimitiveDocInput> {
    const text = await readFile(filePath, "utf8");
    const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2022, true);
    const id = basename(filePath).replace(/\.ts$/, "");

    const picked = pickPrimitive(source, id);
    if (picked === null) {
        throw new GenDocsError(
            "missing-export",
            filePath,
            `no exported function declaration named "${id}" found`,
        );
    }
    const { node, tags } = picked;

    const formula = findTag(tags, "formula");
    if (!formula) throw new GenDocsError("missing-formula", filePath, "missing @formula tag");
    const warmup = findTag(tags, "warmup");
    if (!warmup) throw new GenDocsError("missing-warmup", filePath, "missing @warmup tag");
    const since = findTag(tags, "since");
    if (!since) throw new GenDocsError("missing-since", filePath, "missing @since tag");
    const example = findTag(tags, "example");
    if (!example) throw new GenDocsError("missing-example", filePath, "missing @example tag");
    const stability = stabilityOf(tags);
    if (stability === null) {
        throw new GenDocsError("missing-stability", filePath, "missing @stable / @frozen tag");
    }

    const anchorsTag = findTag(tags, "anchors");

    return {
        id,
        signature: printSignature(source, node),
        description: descriptionOf(node),
        formula: tagText(formula),
        warmup: tagText(warmup),
        ...(anchorsTag ? { anchors: tagText(anchorsTag) } : {}),
        since: tagText(since),
        stability,
        params: paramsOf(source, node, tags),
        returns: returnsOf(source, node, tags),
        example: tagText(example),
        sourceUrl: buildSourceUrl(opts.repoUrl, opts.runtimeRelPath),
    };
}

function renderParamsTable(params: PrimitiveDocInput["params"]): string {
    if (params.length === 0) return "_(no parameters)_\n";
    const rows = params.map(
        (p) =>
            `| \`${p.name}\` | \`${p.type.replace(/\|/g, "\\|")}\` | ${p.defaultValue} | ${p.description} |`,
    );
    return ["| Name | Type | Default | Description |", "|---|---|---|---|", ...rows, ""].join("\n");
}

/**
 * Render a {@link PrimitiveDocInput} into the §17.2 markdown template.
 * Pure function — no IO, no global state — so the template's branch
 * matrix (anchors present vs. absent, empty params, etc.) is fully
 * exercised by unit tests.
 *
 * @since 0.2
 * @stable
 * @example
 *     // import { generateDocsPage } from "@invinite-org/chartlang-cli";
 *     // const md = generateDocsPage(input);
 *     // assert(md.startsWith("# `ta."));
 */
export function generateDocsPage(input: PrimitiveDocInput): string {
    const lines: string[] = [];
    lines.push(`# \`ta.${input.id}\``);
    lines.push("");
    lines.push(`> **Stability:** ${input.stability}`);
    lines.push(`> **Since:** ${input.since}`);
    lines.push("");
    if (input.description.length > 0) {
        lines.push(input.description);
        lines.push("");
    }
    lines.push("## Formula");
    lines.push("");
    lines.push(input.formula);
    lines.push("");
    lines.push("## Warmup");
    lines.push("");
    lines.push(input.warmup);
    lines.push("");
    if (input.anchors !== undefined && input.anchors.length > 0) {
        lines.push("## Anchors");
        lines.push("");
        lines.push(input.anchors);
        lines.push("");
    }
    lines.push("## Signature");
    lines.push("");
    lines.push("```ts");
    lines.push(input.signature);
    lines.push("```");
    lines.push("");
    lines.push(
        "_The leading `slotId: string` parameter is injected by the chartlang compiler at every callsite — script authors call `ta.<id>(...)` without it._",
    );
    lines.push("");
    lines.push("## Parameters");
    lines.push("");
    lines.push(renderParamsTable(input.params));
    lines.push("## Returns");
    lines.push("");
    lines.push(`\`${input.returns}\``);
    lines.push("");
    lines.push("## Example");
    lines.push("");
    lines.push("```ts");
    lines.push(input.example);
    lines.push("```");
    lines.push("");
    lines.push("## See also");
    lines.push("");
    lines.push(`- [Source on GitHub](${input.sourceUrl})`);
    lines.push("");
    return lines.join("\n");
}

async function readSourceFilenames(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const e of entries) {
        // Subdirectories are never descended into — the generator only
        // walks the leaf primitive sources at `<sourceDir>/*.ts`. The
        // `lib/` / `_lib/` / `__fixtures__/` folders carry helpers and
        // fixtures, not primitives; any future namespace directory
        // would mirror that convention.
        if (!e.isFile()) continue;
        if (!e.name.endsWith(".ts")) continue;
        const full = join(dir, e.name);
        if (isSkippableFile(full)) continue;
        out.push(full);
    }
    return out.sort();
}

type WriteFn = (path: string, content: string) => Promise<void>;

/**
 * Options accepted by {@link runGenDocs}. `sourceDir` is the directory
 * the generator walks (defaults to `packages/runtime/src/ta` in the
 * CLI subcommand). `outDir` is where rendered pages land. `repoRoot`
 * is used to build the per-page "Source on GitHub" link. `writeFile`
 * is an injectable seam — defaults to `node:fs/promises.writeFile` —
 * so tests can capture writes without touching disk.
 *
 * @since 0.2
 * @stable
 * @example
 *     // const opts: RunGenDocsOptions = {
 *     //     sourceDir: "/abs/runtime/src/ta",
 *     //     outDir: "/abs/docs/primitives/ta",
 *     //     repoRoot: "/abs/repo",
 *     // };
 */
export type RunGenDocsOptions = Readonly<{
    sourceDir: string;
    outDir: string;
    repoRoot: string;
    writeFile?: WriteFn;
}>;

async function loadRepoUrl(repoRoot: string): Promise<string> {
    const pkgPath = join(repoRoot, "packages", "cli", "package.json");
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { repository?: { url?: string } };
    return pkg.repository?.url ?? "https://github.com/outraday-org/chartlang.git";
}

/**
 * Walk `opts.sourceDir`, parse every primitive source, and write one
 * rendered markdown page per primitive into `opts.outDir`. Returns the
 * absolute paths that were written (sorted) plus the absolute paths of
 * source files that were skipped (helpers, tests, benches, the
 * registry, the barrel, `sourceValue.ts`).
 *
 * The injected `writeFile` defaults to `node:fs/promises.writeFile`;
 * tests pass an in-memory capture to avoid touching disk.
 *
 * @since 0.2
 * @stable
 * @example
 *     // import { runGenDocs } from "@invinite-org/chartlang-cli";
 *     // const { written, skipped } = await runGenDocs({
 *     //     sourceDir: "packages/runtime/src/ta",
 *     //     outDir: "docs/primitives/ta",
 *     //     repoRoot: process.cwd(),
 *     // });
 */
export async function runGenDocs(opts: RunGenDocsOptions): Promise<{
    readonly written: ReadonlyArray<string>;
    readonly skipped: ReadonlyArray<string>;
}> {
    const write: WriteFn = opts.writeFile ?? writeFile;
    const repoUrl = await loadRepoUrl(opts.repoRoot);

    const files = await readSourceFilenames(opts.sourceDir);
    const written: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
        const id = basename(file).replace(/\.ts$/, "");
        const runtimeRelPath = file.startsWith(`${opts.repoRoot}/`)
            ? file.slice(opts.repoRoot.length + 1)
            : file;
        const input = await parsePrimitiveSource(file, {
            repoUrl,
            runtimeRelPath,
        });
        const page = generateDocsPage(input);
        const outPath = resolvePath(opts.outDir, `${id}.md`);
        await write(outPath, page);
        written.push(outPath);
    }

    // Surface what we deliberately skipped so callers (and tests) can
    // assert the skip rules without grepping the impl.
    const allEntries = await readdir(opts.sourceDir, { withFileTypes: true });
    for (const e of allEntries) {
        const full = join(opts.sourceDir, e.name);
        if (e.isFile() && e.name.endsWith(".ts") && isSkippableFile(full)) skipped.push(full);
    }

    return { written: written.sort(), skipped: skipped.sort() };
}

/**
 * Find the repo root by walking upward from `start` until a directory
 * containing `pnpm-workspace.yaml` is found. Falls back to `start` if
 * no such directory exists.
 *
 * @since 0.2
 * @stable
 * @example
 *     // const root = await findRepoRoot(process.cwd());
 */
export async function findRepoRoot(start: string): Promise<string> {
    let current = start;
    while (true) {
        try {
            await stat(join(current, "pnpm-workspace.yaml"));
            return current;
        } catch {
            const parent = resolvePath(current, "..");
            if (parent === current) return start;
            current = parent;
        }
    }
}
