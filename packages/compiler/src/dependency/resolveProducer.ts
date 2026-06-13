// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve as resolvePath } from "node:path";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import ts from "typescript";

/**
 * Producer compiled snapshot returned by {@link ResolveCrossFileProducer}.
 * Carries the producer's manifest, every drawn export's manifest indexed
 * by `exportName`, and the producer's `rewrittenSource` — TS source with
 * top-level `import` statements stripped and every `export default <X>`
 * or `export const <name> = <X>` lowered to `const __producer_<hash>__<…> = <X>`.
 * The consumer's bundler concatenates `rewrittenSource` ahead of the
 * consumer's own transformed source so esbuild can tree-shake the
 * combined module.
 *
 * @since 0.7
 * @stable
 * @example
 *     const c: ProducerCompiled = {
 *         sourcePath: "base.chart.ts",
 *         manifest: {} as ScriptManifest,
 *         drawnByExportName: new Map(),
 *         moduleSource: "",
 *         rewrittenSource: "",
 *         hash: "",
 *     };
 *     void c;
 */
export type ProducerCompiled = Readonly<{
    readonly sourcePath: string;
    readonly manifest: ScriptManifest;
    readonly drawnByExportName: ReadonlyMap<string, ScriptManifest>;
    readonly moduleSource: string;
    readonly rewrittenSource: string;
    readonly hash: string;
    /**
     * Transitive producers this producer itself imports — keyed by hash
     * so the top-level consumer can dedup the inline-once invariant
     * across the whole project's diamond shape.
     *
     * @since 0.7
     */
    readonly transitiveProducers: ReadonlyArray<ProducerCompiled>;
}>;

/**
 * Resolve a cross-file producer reference (`import X from "./Y.chart"`)
 * to its compiled snapshot. Returns `null` when the path is not a
 * `.chart.ts` file, escapes the resolver's `rootDir`, can't be read,
 * forms a cycle, or fails to compile.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: ResolveCrossFileProducer = async () => null;
 *     void r;
 */
export type ResolveCrossFileProducer = (
    importPath: string,
    fromSourcePath: string,
) => Promise<ProducerCompiled | null>;

/**
 * Options accepted by {@link createProducerResolver}. `rootDir` is the
 * absolute base directory that constrains every cross-file walk —
 * imports resolving outside this tree return `null`.
 *
 * @since 0.7
 * @stable
 * @example
 *     const opts: CreateProducerResolverOptions = { rootDir: "/repo" };
 *     void opts;
 */
export type CreateProducerResolverOptions = Readonly<{
    readonly rootDir: string;
}>;

/**
 * Compile callback the resolver delegates the actual producer compilation
 * to. Keeps the resolver decoupled from `compile`'s import graph so the
 * resolver module can be unit-tested in isolation.
 *
 * @since 0.7
 * @stable
 * @example
 *     const c: CompileProducerCallback = async () => null;
 *     void c;
 */
export type CompileProducerCallback = (
    source: string,
    sourcePath: string,
) => Promise<CompiledProducerArtefacts | null>;

/**
 * Artefacts the {@link CompileProducerCallback} hands back for a single
 * producer file. Mirrors the public `CompileResult` shape but drops
 * sourcemaps and types (the resolver only needs the JS + manifests).
 *
 * @since 0.7
 * @stable
 * @example
 *     const a: CompiledProducerArtefacts = {
 *         moduleSource: "",
 *         transformedSource: "",
 *         manifest: {} as ScriptManifest,
 *         siblings: [],
 *     };
 *     void a;
 */
export type CompiledProducerArtefacts = Readonly<{
    readonly moduleSource: string;
    readonly transformedSource: string;
    readonly manifest: ScriptManifest;
    readonly siblings: ReadonlyArray<ScriptManifest>;
    /**
     * Transitive producers this producer pulled in via its own
     * `import X from "./Y.chart"` lines. Each entry is the
     * `ProducerCompiled` snapshot the resolver previously returned.
     *
     * @since 0.7
     */
    readonly transitiveProducers?: ReadonlyArray<ProducerCompiled>;
    /**
     * Mapping from the producer's own `.chart` import specifiers to
     * the resolved producer's hash. Used by the resolver to rewrite
     * cross-file imports inside the producer's IIFE so transitive deps
     * are read from the consumer's namespace instead of left as bare
     * `import` lines.
     *
     * @since 0.7
     */
    readonly specifierToHash?: ReadonlyMap<string, string>;
}>;

const LRU_LIMIT = 256;

/**
 * Build a Promise-cached, cycle-safe cross-file `.chart.ts` resolver. Each
 * unique absolute path is compiled at most once per resolver instance.
 * Cycles (`A` imports `B` imports `A`) surface as `null` so the calling
 * compile pass can raise `dep-cycle` at the consumer's call site.
 *
 * The resolver delegates the actual compile to a caller-supplied
 * {@link CompileProducerCallback} so this module stays free of the
 * compile pipeline's import graph — testable in isolation.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const resolve = createProducerResolver({ rootDir: cwd }, compileFn);
 *     // const producer = await resolve("./base.chart", "consumer.chart.ts");
 *     const fn: typeof createProducerResolver = createProducerResolver;
 *     void fn;
 */
export function createProducerResolver(
    opts: CreateProducerResolverOptions,
    compileProducer: CompileProducerCallback,
): ResolveCrossFileProducer {
    const rootAbsolute = isAbsolute(opts.rootDir)
        ? opts.rootDir
        : resolvePath(process.cwd(), opts.rootDir);
    const cache = new Map<string, Promise<ProducerCompiled | null>>();
    const insertionOrder: string[] = [];
    // Track per-resolve-chain ancestry. Each compileProducer for file X
    // adds X to its descendants' chains via a per-promise registry so a
    // genuine cycle (X → Y → X) is detected without false-positiving on
    // concurrent sibling compiles (X → Y and X → Z, sharing producer Y).
    const ancestryByAbsolute = new Map<string, ReadonlySet<string>>();

    function resolveCrossFileProducer(
        importPath: string,
        fromSourcePath: string,
    ): Promise<ProducerCompiled | null> {
        const absolute = resolveImportPath(importPath, fromSourcePath, rootAbsolute);
        if (absolute === null) return Promise.resolve(null);

        // Cycle: the file we'd compile is already an ancestor of the
        // file currently driving the resolve. Returns null so the
        // caller surfaces `dep-cycle` at the call site.
        const fromAbsolute = isAbsolute(fromSourcePath)
            ? fromSourcePath
            : resolvePath(rootAbsolute, fromSourcePath);
        const ancestors = ancestryByAbsolute.get(fromAbsolute);
        if (ancestors !== undefined && (ancestors.has(absolute) || fromAbsolute === absolute)) {
            return Promise.resolve(null);
        }

        const cached = cache.get(absolute);
        if (cached !== undefined) return cached;

        const childAncestry = new Set<string>(ancestors ?? []);
        childAncestry.add(fromAbsolute);
        ancestryByAbsolute.set(absolute, childAncestry);

        const pending = (async (): Promise<ProducerCompiled | null> => {
            try {
                let source: string;
                try {
                    source = await readFile(absolute, "utf8");
                } catch {
                    return null;
                }
                // Hand the absolute path to `compileProducer` so the
                // recursive `compile` invocation can resolve nested
                // cross-file imports from the producer's real location
                // without going through the (process-cwd-dependent)
                // posix-relative form. The compiler's callsite-id slot
                // ids still derive from this path verbatim.
                const artefacts = await compileProducer(source, absolute);
                if (artefacts === null) return null;
                const hash = hashSourcePath(absolute);
                const rewrittenSource = rewriteProducerSource(
                    artefacts.transformedSource,
                    hash,
                    artefacts.specifierToHash ?? new Map(),
                );
                const drawnByExportName = new Map<string, ScriptManifest>();
                drawnByExportName.set("default", artefacts.manifest);
                for (const sibling of artefacts.siblings) {
                    if (sibling.exportName !== undefined) {
                        drawnByExportName.set(sibling.exportName, sibling);
                    }
                }
                return Object.freeze({
                    sourcePath: absolute,
                    manifest: artefacts.manifest,
                    drawnByExportName,
                    moduleSource: artefacts.moduleSource,
                    rewrittenSource,
                    hash,
                    transitiveProducers: Object.freeze(
                        (artefacts.transitiveProducers ?? []).slice(),
                    ),
                });
            } finally {
                ancestryByAbsolute.delete(absolute);
            }
        })();

        cache.set(absolute, pending);
        insertionOrder.push(absolute);
        while (insertionOrder.length > LRU_LIMIT) {
            const oldest = insertionOrder.shift();
            if (oldest !== undefined && oldest !== absolute) {
                cache.delete(oldest);
            }
        }
        return pending;
    }

    return resolveCrossFileProducer;
}

/**
 * Compute the stable 12-hex-char identifier the bundler uses to namespace
 * each inlined producer's locals (`__producer_<hash>__default`,
 * `__producer_<hash>__<name>`). Driven off the producer's absolute path
 * so two consumers in the same project share the same identifier for
 * the same producer — esbuild's tree-shake then dedups the inline.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const id = hashSourcePath("/repo/src/base.chart.ts");
 *     // id === "a1b2c3d4e5f6"
 *     const fn: typeof hashSourcePath = hashSourcePath;
 *     void fn;
 */
export function hashSourcePath(absolutePath: string): string {
    const normalised = absolutePath.replace(/\\/g, "/");
    return createHash("sha256").update(normalised).digest("hex").slice(0, 12);
}

/**
 * Rewrite a producer's printed TS source into a self-contained IIFE
 * block that exposes one `__producer_<hash>__default` const. Strips
 * `@invinite-org/chartlang-core` imports (the consumer already pulled
 * the symbols in), lowers cross-file `.chart` imports to
 * `const <name> = __producer_<nestedhash>__default;` so the inlined
 * dep is read from the consumer's already-inlined namespace, replaces
 * `export default <X>` with `return <X>;`, and wraps everything in an
 * IIFE so private same-file consts stay scoped — preventing name
 * collisions across producers that happen to share local identifiers.
 *
 * `specifierToHash` maps the producer's own cross-file import
 * specifiers to the nested producers' stable hashes. Empty when the
 * producer has no cross-file imports.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const src = rewriteProducerSource(
 *     //     'export default defineIndicator({});',
 *     //     'a1b2c3',
 *     //     new Map(),
 *     // );
 *     // src includes "const __producer_a1b2c3__default = (() => { ... })();"
 *     const fn: typeof rewriteProducerSource = rewriteProducerSource;
 *     void fn;
 */
export function rewriteProducerSource(
    source: string,
    hash: string,
    specifierToHash: ReadonlyMap<string, string> = new Map(),
): string {
    const sourceFile = ts.createSourceFile(
        "producer.ts",
        source,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );
    const printer = ts.createPrinter({
        removeComments: false,
        newLine: ts.NewLineKind.LineFeed,
    });

    // Imports of `@invinite-org/chartlang-core` (and other host-supplied
    // bare specifiers) are hoisted to the top of the rewritten output as
    // top-level `import` statements so esbuild dedupes them against the
    // consumer's own imports. Without hoisting, the producer's body
    // references (`input.int(...)`, `ta.ema(...)`, etc.) would be unbound
    // when the consumer omits those symbols from its own import line —
    // a real bug surfaced by the dep-cross-file conformance scenario.
    // Producer-side `.chart` imports stay lowered inside the IIFE body
    // as `const <name> = __producer_<nestedHash>__default;` so the
    // top-level inlined producer is read from the consumer's namespace.
    const hoistedImports: string[] = [];
    const bodyLines: string[] = [];
    let defaultExpr: string | null = null;
    const fullText = sourceFile.text;
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier;
            /* v8 ignore next */
            if (!ts.isStringLiteral(specifier)) continue;
            const text = specifier.text;
            const nestedHash = specifierToHash.get(text);
            if (nestedHash !== undefined) {
                const clause = statement.importClause;
                const defaultName = clause?.name?.text;
                if (defaultName !== undefined) {
                    bodyLines.push(`const ${defaultName} = __producer_${nestedHash}__default;`);
                }
                continue;
            }
            // Non-chart import (e.g. `@invinite-org/chartlang-core`): hoist
            // verbatim so esbuild dedupes against the consumer's imports.
            hoistedImports.push(fullText.slice(statement.getStart(sourceFile), statement.getEnd()));
            continue;
        }
        if (ts.isExportDeclaration(statement)) continue;
        if (ts.isExportAssignment(statement)) {
            defaultExpr = printer.printNode(
                ts.EmitHint.Expression,
                statement.expression,
                sourceFile,
            );
            continue;
        }
        if (ts.isVariableStatement(statement)) {
            const isExported = statement.modifiers?.some(
                (mod) => mod.kind === ts.SyntaxKind.ExportKeyword,
            );
            if (isExported === true) {
                bodyLines.push(rewriteVariableStatement(statement, hash, sourceFile, printer));
                continue;
            }
        }
        bodyLines.push(fullText.slice(statement.getStart(sourceFile), statement.getEnd()));
    }

    const returnLine = defaultExpr === null ? "return undefined;" : `return ${defaultExpr};`;
    const iife = `const __producer_${hash}__default = (() => {\n${bodyLines.join("\n")}\n${returnLine}\n})();`;
    return hoistedImports.length === 0 ? iife : `${hoistedImports.join("\n")}\n${iife}`;
}

function rewriteVariableStatement(
    statement: ts.VariableStatement,
    hash: string,
    sourceFile: ts.SourceFile,
    printer: ts.Printer,
): string {
    const declarations = statement.declarationList.declarations
        .map((decl) => {
            const nameNode = decl.name;
            if (!ts.isIdentifier(nameNode)) return null;
            const initializer = decl.initializer;
            if (initializer === undefined) return null;
            const initText = printer.printNode(ts.EmitHint.Expression, initializer, sourceFile);
            return `const __producer_${hash}__${nameNode.text} = ${initText};`;
        })
        .filter((line): line is string => line !== null);
    return declarations.join("\n");
}

function resolveImportPath(
    importPath: string,
    fromSourcePath: string,
    rootAbsolute: string,
): string | null {
    let normalised: string;
    if (importPath.endsWith(".chart.ts")) {
        normalised = importPath;
    } else if (importPath.endsWith(".chart")) {
        normalised = `${importPath}.ts`;
    } else {
        return null;
    }
    // `fromSourcePath` may be absolute (driven by `compileFile`'s
    // absolute resolution) or relative to the process cwd (driven by
    // `compileProject` passing posix-relative paths). Resolve against
    // cwd so both forms work.
    const fromAbsolute = isAbsolute(fromSourcePath)
        ? fromSourcePath
        : resolvePath(process.cwd(), fromSourcePath);
    const fromDir = dirname(fromAbsolute);
    const absolute = isAbsolute(normalised) ? normalised : resolvePath(fromDir, normalised);
    const rel = relative(rootAbsolute, absolute);
    if (rel.startsWith("..") || isAbsolute(rel)) return null;
    return absolute;
}
