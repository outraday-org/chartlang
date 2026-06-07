// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve as resolvePath } from "node:path";

import { KIND_BUCKET, KIND_KEBABCASE } from "@invinite-org/chartlang-core";
import type { DrawingBucket, DrawingKind } from "@invinite-org/chartlang-core";
import ts from "typescript";

import { AUTO_GENERATED_HEADER, GenDocsError } from "./genDocs.js";

/**
 * Structured payload the renderer consumes — one per `draw.*` kind.
 * Mirrors {@link import("./genDocs.js").PrimitiveDocInput} but carries
 * the drawing-specific tags (`@anchors`, `@anchorCount`, `@bucket`)
 * instead of the indicator-specific tags (`@formula`, `@warmup`).
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const input: DrawingDocInput = {
 *     //     camelKind: "line",
 *     //     kebabKind: "line",
 *     //     signature: "function line(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle",
 *     //     description: "Draw a straight line between two world anchors.",
 *     //     anchors: "`a`, `b` — two `WorldPoint`s",
 *     //     anchorCount: 2,
 *     //     bucket: "lines",
 *     //     since: "0.3",
 *     //     stability: "experimental",
 *     //     example: "// draw.line(...);",
 *     //     sourceUrl: "https://example.invalid/line.ts",
 *     // };
 *     // const md = generateDrawingDocsPage(input);
 */
export type DrawingDocInput = Readonly<{
    camelKind: string;
    kebabKind: DrawingKind;
    signature: string;
    description: string;
    anchors: string;
    anchorCount: string;
    bucket: DrawingBucket;
    since: string;
    stability: "stable" | "experimental" | "frozen";
    example: string;
    sourceUrl: string;
}>;

const SKIP_BASENAMES = new Set([
    "index.ts",
    "namespace.ts",
    "handle.ts",
    "pushDrawing.ts",
    "subIdAllocator.ts",
]);
const SKIP_SUFFIXES = [
    ".test.ts",
    ".bench.ts",
    ".bench.test.ts",
    ".golden.test.ts",
    ".property.test.ts",
    ".types.test.ts",
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
    return (ts.getTextOfJSDocComment(comment) ?? "").trim();
}

function tagText(tag: ts.JSDocTag): string {
    return commentText(tag.comment);
}

function findTag(tags: readonly ts.JSDocTag[], name: string): ts.JSDocTag | undefined {
    return tags.find((t) => t.tagName.text === name);
}

function stabilityOf(tags: readonly ts.JSDocTag[]): "stable" | "experimental" | "frozen" | null {
    if (findTag(tags, "stable")) return "stable";
    if (findTag(tags, "experimental")) return "experimental";
    if (findTag(tags, "frozen")) return "frozen";
    return null;
}

function descriptionOf(node: ts.Node): string {
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

function buildSourceUrl(repoUrl: string, runtimeRelPath: string): string {
    const trimmed = repoUrl.replace(/\.git$/, "").replace(/\/+$/, "");
    return `${trimmed}/blob/main/${runtimeRelPath}`;
}

/**
 * Pick the script-facing overload of a `draw.<camelKind>` runtime file.
 *
 * Each runtime emit file (e.g. `lines/line.ts`) carries three function
 * declarations sharing the same name: (1) the script-facing overload
 * with the rich JSDoc (`@anchors`, `@anchorCount`, `@bucket`,
 * `@example`, stability marker), (2) the compiler-injected overload
 * with `slotId: string` prepended, (3) the implementation signature.
 * The script-facing one is what users invoke and what the docs site
 * documents — it's the one carrying every required tag and is the
 * first declaration in source order. Pick the first overload whose
 * JSDoc carries `@anchors`.
 */
function pickDrawingOverload(
    source: ts.SourceFile,
    camelKind: string,
): {
    node: ts.FunctionDeclaration;
    tags: readonly ts.JSDocTag[];
    anchors: ts.JSDocTag;
} | null {
    for (const stmt of source.statements) {
        if (!ts.isFunctionDeclaration(stmt)) continue;
        if (stmt.name?.text !== camelKind) continue;
        const hasExport = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!hasExport) continue;
        const tags = ts.getJSDocTags(stmt);
        const anchors = findTag(tags, "anchors");
        if (anchors) {
            return { node: stmt, tags, anchors };
        }
    }
    return null;
}

/**
 * Parse a runtime drawing-emit source file via the TypeScript compiler
 * API. Returns the structured {@link DrawingDocInput} on success;
 * throws {@link GenDocsError} when the file is missing a required
 * JSDoc tag or carries a `@bucket` value that does not match the
 * canonical `KIND_BUCKET` table in `@invinite-org/chartlang-core`.
 *
 * `repoUrl` is the runtime package's `repository.url` (used to build
 * the "Source on GitHub" link in the rendered page).
 * `runtimeRelPath` is the path of the source file relative to the
 * repo root (e.g. `packages/runtime/src/emit/draw/lines/line.ts`).
 *
 * @since 0.3
 * @experimental
 * @example
 *     // import { parseDrawingSource } from "@invinite-org/chartlang-cli";
 *     // const input = await parseDrawingSource("/abs/line.ts", {
 *     //     repoUrl: "https://github.com/o/r.git",
 *     //     runtimeRelPath: "packages/runtime/src/emit/draw/lines/line.ts",
 *     // });
 */
export async function parseDrawingSource(
    filePath: string,
    opts: Readonly<{ repoUrl: string; runtimeRelPath: string }>,
): Promise<DrawingDocInput> {
    const text = await readFile(filePath, "utf8");
    const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2022, true);
    const camelKind = basename(filePath).replace(/\.ts$/, "");

    const kebabKind = KIND_KEBABCASE.get(camelKind);
    if (kebabKind === undefined) {
        throw new GenDocsError(
            "unknown-camel-kind",
            filePath,
            `basename "${camelKind}" is not a known draw.* camelCase kind`,
        );
    }

    const picked = pickDrawingOverload(source, camelKind);
    if (picked === null) {
        throw new GenDocsError(
            "missing-export",
            filePath,
            `no exported function declaration named "${camelKind}" with @anchors found`,
        );
    }
    const { node, tags, anchors } = picked;

    const anchorCount = findTag(tags, "anchorCount");
    if (!anchorCount)
        throw new GenDocsError("missing-anchor-count", filePath, "missing @anchorCount tag");
    const bucket = findTag(tags, "bucket");
    if (!bucket) throw new GenDocsError("missing-bucket", filePath, "missing @bucket tag");
    const since = findTag(tags, "since");
    if (!since) throw new GenDocsError("missing-since", filePath, "missing @since tag");
    const example = findTag(tags, "example");
    if (!example) throw new GenDocsError("missing-example", filePath, "missing @example tag");
    const stability = stabilityOf(tags);
    if (stability === null) {
        throw new GenDocsError(
            "missing-stability",
            filePath,
            "missing @stable / @experimental / @frozen tag",
        );
    }

    const anchorCountRaw = tagText(anchorCount);
    if (anchorCountRaw.length === 0) {
        throw new GenDocsError("missing-anchor-count", filePath, "empty @anchorCount tag");
    }

    const bucketRaw = tagText(bucket);
    // Every `DrawingKind` has a `KIND_BUCKET` entry — the
    // exhaustiveness test in `packages/core/src/draw/buckets.test.ts`
    // asserts this. The non-null assertion is safe because
    // `kebabKind` came out of `KIND_KEBABCASE` (a verified
    // `DrawingKind`).
    const canonicalBucket = KIND_BUCKET.get(kebabKind) as DrawingBucket;
    if (bucketRaw !== canonicalBucket) {
        throw new GenDocsError(
            "bucket-mismatch",
            filePath,
            `@bucket "${bucketRaw}" does not match canonical KIND_BUCKET "${canonicalBucket}" for "${kebabKind}"`,
        );
    }

    return {
        camelKind,
        kebabKind,
        signature: printSignature(source, node),
        description: descriptionOf(node),
        anchors: tagText(anchors),
        anchorCount: anchorCountRaw,
        bucket: canonicalBucket,
        since: tagText(since),
        stability,
        example: tagText(example),
        sourceUrl: buildSourceUrl(opts.repoUrl, opts.runtimeRelPath),
    };
}

/**
 * Render a {@link DrawingDocInput} into the per-kind markdown
 * template. Pure function — no IO, no global state — so the
 * template's branch matrix is fully exercised by unit tests.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // import { generateDrawingDocsPage } from "@invinite-org/chartlang-cli";
 *     // const md = generateDrawingDocsPage(input);
 *     // assert(md.startsWith("<!-- AUTO-GENERATED"));
 */
export function generateDrawingDocsPage(input: DrawingDocInput): string {
    const lines: string[] = [];
    lines.push(AUTO_GENERATED_HEADER);
    lines.push("");
    lines.push(`# \`draw.${input.camelKind}\``);
    lines.push("");
    lines.push(`> **Stability:** ${input.stability}`);
    lines.push(`> **Since:** ${input.since}`);
    lines.push(`> **Bucket:** \`${input.bucket}\``);
    lines.push(`> **Wire kind:** \`${input.kebabKind}\``);
    lines.push("");
    if (input.description.length > 0) {
        lines.push(input.description);
        lines.push("");
    }
    lines.push("## Anchors");
    lines.push("");
    lines.push(input.anchors);
    lines.push("");
    lines.push(`Anchor count: ${input.anchorCount}.`);
    lines.push("");
    lines.push("## Signature");
    lines.push("");
    lines.push("```ts");
    lines.push(input.signature);
    lines.push("```");
    lines.push("");
    lines.push(
        `_The leading \`slotId: string\` parameter is injected by the chartlang compiler at every callsite — script authors call \`draw.${input.camelKind}(...)\` without it._`,
    );
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
    lines.push("- [`draw.*` namespace index](./index.md)");
    lines.push("- [PLAN §10 — Drawing primitives](../../../PLAN.md#10-drawing-primitives)");
    lines.push("");
    return lines.join("\n");
}

async function listDrawingSources(rootDir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await readdir(rootDir, { withFileTypes: true });
    for (const e of entries) {
        const full = join(rootDir, e.name);
        if (e.isDirectory()) {
            // One level of descent — the 13 category subdirs
            // (`lines/`, `boxes/`, `fibA/`, etc.). Within each, pick
            // every per-kind `.ts` file matching a known camelKind.
            const subEntries = await readdir(full, { withFileTypes: true });
            for (const sub of subEntries) {
                if (!sub.isFile()) continue;
                if (!sub.name.endsWith(".ts")) continue;
                const subFull = join(full, sub.name);
                if (isSkippableFile(subFull)) continue;
                out.push(subFull);
            }
            continue;
        }
        if (!e.name.endsWith(".ts")) continue;
        if (isSkippableFile(full)) continue;
        // Top-level per-kind file — none today, but the walker
        // tolerates them so future refactors don't require updating
        // the generator.
        out.push(full);
    }
    return out.sort();
}

type WriteFn = (path: string, content: string) => Promise<void>;

/**
 * Options accepted by {@link runGenDrawingDocs}. `sourceDir` is the
 * directory the generator walks (defaults to
 * `packages/runtime/src/emit/draw` in the CLI subcommand). `outDir`
 * is where rendered pages land. `repoRoot` is used to build the
 * per-page "Source on GitHub" link. `writeFile` is an injectable
 * seam — defaults to `node:fs/promises.writeFile` — so tests can
 * capture writes without touching disk.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // const opts: RunGenDrawingDocsOptions = {
 *     //     sourceDir: "/abs/runtime/src/emit/draw",
 *     //     outDir: "/abs/docs/primitives/draw",
 *     //     repoRoot: "/abs/repo",
 *     // };
 */
export type RunGenDrawingDocsOptions = Readonly<{
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
 * Walk `opts.sourceDir`, parse every per-kind drawing-emit source,
 * and write one rendered markdown page per kind into `opts.outDir`
 * named after the kebab-case wire kind (e.g. `horizontal-line.md`).
 * Returns the absolute paths that were written (sorted) plus the
 * absolute paths of source files that were skipped (infra files,
 * tests, benches, the barrel).
 *
 * The injected `writeFile` defaults to `node:fs/promises.writeFile`;
 * tests pass an in-memory capture to avoid touching disk.
 *
 * @since 0.3
 * @experimental
 * @example
 *     // import { runGenDrawingDocs } from "@invinite-org/chartlang-cli";
 *     // const { written, skipped } = await runGenDrawingDocs({
 *     //     sourceDir: "packages/runtime/src/emit/draw",
 *     //     outDir: "docs/primitives/draw",
 *     //     repoRoot: process.cwd(),
 *     // });
 */
export async function runGenDrawingDocs(opts: RunGenDrawingDocsOptions): Promise<{
    readonly written: ReadonlyArray<string>;
    readonly skipped: ReadonlyArray<string>;
}> {
    const write: WriteFn = opts.writeFile ?? writeFile;
    const repoUrl = await loadRepoUrl(opts.repoRoot);

    const files = await listDrawingSources(opts.sourceDir);
    const written: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
        const runtimeRelPath = file.startsWith(`${opts.repoRoot}/`)
            ? file.slice(opts.repoRoot.length + 1)
            : file;
        const input = await parseDrawingSource(file, {
            repoUrl,
            runtimeRelPath,
        });
        const page = generateDrawingDocsPage(input);
        const outPath = resolvePath(opts.outDir, `${input.kebabKind}.md`);
        await write(outPath, page);
        written.push(outPath);
    }

    // Surface the skip set so callers (and tests) can assert the skip
    // rules without grepping the impl.
    const entries = await readdir(opts.sourceDir, { withFileTypes: true });
    for (const e of entries) {
        const full = join(opts.sourceDir, e.name);
        if (e.isFile() && e.name.endsWith(".ts") && isSkippableFile(full)) {
            skipped.push(full);
            continue;
        }
        if (!e.isDirectory()) continue;
        const subEntries = await readdir(full, { withFileTypes: true });
        for (const sub of subEntries) {
            const subFull = join(full, sub.name);
            if (sub.isFile() && sub.name.endsWith(".ts") && isSkippableFile(subFull)) {
                skipped.push(subFull);
            }
        }
    }

    return { written: written.sort(), skipped: skipped.sort() };
}
