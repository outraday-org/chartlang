// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { randomBytes } from "node:crypto";
import { readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import { STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
import type { IntervalDescriptor, ScriptManifest } from "@invinite-org/chartlang-core";
import ts from "typescript";

import {
    extractAlertConditions,
    extractCapabilities,
    extractInputs,
    extractMaxLookback,
    extractRequestedIntervals,
    extractRequiresIntervals,
    runForbiddenConstructs,
    runStatefulCallInLoop,
    runStructuralChecks,
    validateLowerTfIntervals,
} from "./analysis";
import { bundleModule, formatManifestAssignment } from "./bundle";
import type { CompileDiagnostic } from "./diagnostics";
import { buildManifest } from "./manifest";
import { createProgramForSource } from "./program";
import { injectCallsiteIds } from "./transformers/callsiteIdInjection";
import { emitTypes } from "./typesEmit";

/**
 * Options accepted by `transformAndAnalyse`. `sourcePath` is the
 * package-relative POSIX path baked into every callsite id; the compiler
 * does not read any other file. `declaredIntervals` is the host-supplied
 * `Capabilities.intervals` set used by the `lower-tf-not-lower` validation —
 * when omitted the lower-timeframe ordering check is skipped.
 *
 * @since 0.1
 * @example
 *     const opts: TransformAndAnalyseOptions = { sourcePath: "demo.chart.ts" };
 */
export type TransformAndAnalyseOptions = Readonly<{
    sourcePath: string;
    declaredIntervals?: ReadonlyArray<IntervalDescriptor>;
}>;

/**
 * Result of `transformAndAnalyse`. `transformed` is the AST after callsite
 * ids have been injected; `manifest` is the recursively-frozen
 * `ScriptManifest`; `diagnostics` is the flat list of every diagnostic
 * emitted by any pass (errors abort the rewrite, warnings flow through).
 *
 * @since 0.1
 * @example
 *     // const { transformed, manifest, diagnostics } =
 *     //     transformAndAnalyse(src, { sourcePath: "demo.chart.ts" });
 *     const shape: { transformed: unknown; manifest: unknown; diagnostics: unknown } = {
 *         transformed: null,
 *         manifest: null,
 *         diagnostics: [],
 *     };
 *     void shape;
 */
export type TransformAndAnalyseResult = Readonly<{
    transformed: ts.SourceFile;
    manifest: ScriptManifest;
    diagnostics: ReadonlyArray<CompileDiagnostic>;
}>;

/**
 * Run the Phase-1 compiler pipeline against an in-memory script source.
 * Builds a TypeScript program, runs the structural / forbidden-construct /
 * stateful-call-in-loop checks, rewrites stateful calls with callsite ids,
 * and extracts the manifest's `capabilities` / `maxLookback` /
 * `seriesCapacities` / `inputs` fields.
 *
 * Error-severity diagnostics short-circuit the transform: the function
 * returns the original `sourceFile` and a placeholder manifest so callers
 * can still surface the errors uniformly. The public `compile` /
 * `compileFile` / `compileProject` wrappers above turn those error
 * diagnostics into a `CompileError` throw.
 *
 * @since 0.1
 * @example
 *     // const result = transformAndAnalyse(
 *     //     'export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });',
 *     //     { sourcePath: "demo.chart.ts" },
 *     // );
 *     const fn: typeof transformAndAnalyse = transformAndAnalyse;
 *     void fn;
 */
export function transformAndAnalyse(
    source: string,
    opts: TransformAndAnalyseOptions,
): TransformAndAnalyseResult {
    const sourcePath = opts.sourcePath;
    const { sourceFile, checker } = createProgramForSource(source, { sourcePath });

    const structural = runStructuralChecks(sourceFile, checker, sourcePath);
    const forbidden = runForbiddenConstructs(sourceFile, sourcePath);
    const statefulInLoop = runStatefulCallInLoop(
        sourceFile,
        checker,
        sourcePath,
        STATEFUL_PRIMITIVES_BY_NAME,
    );

    const earlyDiagnostics: CompileDiagnostic[] = [
        ...structural.diagnostics,
        ...forbidden,
        ...statefulInLoop,
    ];
    const hasError = earlyDiagnostics.some((d) => d.severity === "error");
    if (hasError) {
        return Object.freeze({
            transformed: sourceFile,
            manifest: buildManifest({
                name: structural.name,
                kind: structural.kind,
                capabilities: ["indicators"],
                requestedIntervals: [],
                userPickableInterval: false,
                seriesCapacities: {},
                maxLookback: 0,
                inputs: {},
                ...structural.overrides,
            }),
            diagnostics: Object.freeze(earlyDiagnostics.slice()),
        });
    }

    const injection = injectCallsiteIds(sourceFile, checker, {
        sourcePath,
        statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
    });
    const capabilities = extractCapabilities(sourceFile, checker, structural.kind);
    const lookback = extractMaxLookback(sourceFile, checker, sourcePath);
    const inputs = extractInputs(sourceFile, checker, sourcePath);
    const alertConditions = extractAlertConditions(sourceFile, checker, sourcePath);
    const intervalDiagnostics: CompileDiagnostic[] = [];
    const requestedIntervalsFromCalls = extractRequestedIntervals(
        sourceFile,
        checker,
        inputs.inputs,
        intervalDiagnostics,
        sourcePath,
    );
    const requiresIntervals = extractRequiresIntervals(
        sourceFile,
        checker,
        intervalDiagnostics,
        sourcePath,
    );
    const lowerTfDiagnostics = validateLowerTfIntervals(
        sourceFile,
        checker,
        sourcePath,
        opts.declaredIntervals ?? [],
    );
    const requestedIntervals = Array.from(
        new Set([...requestedIntervalsFromCalls, ...requiresIntervals]),
    ).sort();
    const { requiresIntervals: structuralRequiresIntervals, ...structuralOverrides } =
        structural.overrides;
    void structuralRequiresIntervals;

    const manifest = buildManifest({
        name: structural.name,
        kind: structural.kind,
        capabilities,
        requestedIntervals,
        userPickableInterval: inputs.userPickableInterval,
        seriesCapacities: lookback.seriesCapacities,
        maxLookback: lookback.maxLookback,
        inputs: inputs.inputs,
        ...structuralOverrides,
        ...(requiresIntervals.length === 0 ? {} : { requiresIntervals }),
        ...(alertConditions.alertConditions.length === 0
            ? {}
            : { alertConditions: alertConditions.alertConditions }),
    });

    const allDiagnostics: CompileDiagnostic[] = [
        ...earlyDiagnostics,
        ...injection.diagnostics,
        ...lookback.diagnostics,
        ...inputs.diagnostics,
        ...alertConditions.diagnostics,
        ...intervalDiagnostics,
        ...lowerTfDiagnostics,
    ];

    return Object.freeze({
        transformed: injection.transformed,
        manifest,
        diagnostics: Object.freeze(allDiagnostics.slice()),
    });
}

/**
 * Options accepted by `compile`. `apiVersion` is the frozen language
 * version this compiler implements. Passing `apiVersion: 1` is an explicit
 * acknowledgement of that contract; the type stays the literal `1` so a
 * future `apiVersion: 2` compiler is a type-level break. See
 * `docs/spec/versioning.md`. `sourcePath` overrides the file-system-derived
 * path used in callsite ids; `sourcemap`, `minify`, and `target` mirror the
 * bundler's flags. `declaredIntervals` is the adapter's
 * `Capabilities.intervals` set — when supplied, `request.lowerTf` literals
 * are validated against the smallest declared main interval
 * (`lower-tf-not-lower`).
 *
 * @since 0.1
 * @example
 *     const opts: CompileOptions = { apiVersion: 1, sourcePath: "demo.chart.ts" };
 *     void opts;
 */
export type CompileOptions = Readonly<{
    apiVersion: 1;
    sourcePath?: string;
    sourcemap?: boolean | "inline" | "external";
    minify?: boolean;
    target?: "es2022";
    declaredIntervals?: ReadonlyArray<IntervalDescriptor>;
}>;

/**
 * Options accepted by `compileFile`. Extends `CompileOptions` with a `write`
 * toggle that, when `false`, skips the sibling-file writes and returns the
 * triple in memory only.
 *
 * @since 0.1
 * @example
 *     const opts: CompileFileOptions = { apiVersion: 1, write: false };
 *     void opts;
 */
export type CompileFileOptions = CompileOptions &
    Readonly<{
        write?: boolean;
    }>;

/**
 * Frozen result of a single script compilation. `moduleSource` is the bundled
 * ESM string (with the `export const __manifest = …;` tail appended);
 * `sourcemap` is present when the caller asked for an external map;
 * `manifest` is the recursively-frozen `ScriptManifest`; `types` is the
 * `.d.ts` sibling source.
 *
 * @since 0.1
 * @example
 *     // const result: CompiledScript = await compile(src, { apiVersion: 1 });
 *     const shape: CompiledScript = {} as CompiledScript;
 *     void shape;
 */
export type CompiledScript = Readonly<{
    moduleSource: string;
    sourcemap?: string;
    manifest: ScriptManifest;
    types: string;
}>;

/**
 * Error thrown by `compile` / `compileFile` / `compileProject` when any
 * compilation produces an error-severity diagnostic. Carries the full
 * frozen diagnostic array on `err.diagnostics`; the message starts with the
 * first diagnostic's `code: message (file:line:column)` so console output
 * stays compact.
 *
 * @since 0.1
 * @example
 *     // try { await compile(badSrc, { apiVersion: 1 }); }
 *     // catch (err) { if (err instanceof CompileError) console.error(err.diagnostics); }
 *     const E: typeof CompileError = CompileError;
 *     void E;
 */
export class CompileError extends Error {
    readonly diagnostics: ReadonlyArray<CompileDiagnostic>;

    constructor(diagnostics: ReadonlyArray<CompileDiagnostic>) {
        const first = diagnostics[0];
        const message =
            first === undefined
                ? "Compilation failed"
                : `${first.code}: ${first.message} (${first.file}:${first.line}:${first.column})`;
        super(message);
        this.name = "CompileError";
        this.diagnostics = diagnostics;
    }
}

const PRINTER = ts.createPrinter({
    removeComments: false,
    newLine: ts.NewLineKind.LineFeed,
});

/**
 * Compile a script source into a frozen `CompiledScript` triple. Runs
 * `transformAndAnalyse`, throws `CompileError` on any error diagnostic,
 * prints the transformed AST, drives esbuild to ESM, appends the
 * `__manifest` assignment, and emits the `.d.ts` sibling.
 *
 * @since 0.1
 * @example
 *     // const result = await compile(emaCrossSource, {
 *     //     apiVersion: 1,
 *     //     sourcePath: "ema-cross.chart.ts",
 *     // });
 *     const fn: typeof compile = compile;
 *     void fn;
 */
export async function compile(source: string, opts: CompileOptions): Promise<CompiledScript> {
    const sourcePath = opts.sourcePath ?? "script.chart.ts";
    const result = transformAndAnalyse(source, {
        sourcePath,
        ...(opts.declaredIntervals === undefined
            ? {}
            : { declaredIntervals: opts.declaredIntervals }),
    });

    const errors = result.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
        throw new CompileError(Object.freeze(errors.slice()));
    }

    const transformedSource = PRINTER.printFile(result.transformed);
    const sourcemap = opts.sourcemap ?? false;
    const bundle = await bundleModule({
        transformedSource,
        sourcePath,
        sourcemap,
        minify: opts.minify ?? false,
    });

    const moduleSource = `${bundle.moduleSource}${formatManifestAssignment(result.manifest)}`;
    const types = emitTypes({ manifest: result.manifest, sourcePath });

    if (bundle.sourcemap !== undefined) {
        return Object.freeze({
            moduleSource,
            sourcemap: bundle.sourcemap,
            manifest: result.manifest,
            types,
        });
    }
    return Object.freeze({
        moduleSource,
        manifest: result.manifest,
        types,
    });
}

/**
 * Write a file atomically — render to a `<target>.tmp.<rand>` sibling first,
 * then `rename` into place. On any error during write or rename, the temp
 * file is unlinked so the caller never sees a half-written artefact.
 *
 * @since 0.1
 * @example
 *     // await writeAtomic("/tmp/foo.txt", "hello");
 *     const fn: typeof writeAtomic = writeAtomic;
 *     void fn;
 */
export async function writeAtomic(target: string, contents: string): Promise<void> {
    const suffix = randomBytes(8).toString("hex");
    const tmp = `${target}.tmp.${suffix}`;
    try {
        await writeFile(tmp, contents, "utf8");
        await rename(tmp, target);
    } catch (err) {
        try {
            await unlink(tmp);
        } catch {
            // Best-effort cleanup; the rename failure is the real error.
        }
        throw err;
    }
}

/**
 * Read a `.chart.ts` file from disk, compile it, and (when `write !== false`)
 * emit the three sibling files atomically — `<base>.chart.js`,
 * `<base>.chart.manifest.json`, `<base>.chart.d.ts`, plus
 * `<base>.chart.js.map` when `sourcemap` is external.
 *
 * @since 0.1
 * @example
 *     // const result = await compileFile("./demo.chart.ts", { apiVersion: 1 });
 *     const fn: typeof compileFile = compileFile;
 *     void fn;
 */
export async function compileFile(path: string, opts: CompileFileOptions): Promise<CompiledScript> {
    const absolute = isAbsolute(path) ? path : resolvePath(process.cwd(), path);
    const source = await readFile(absolute, "utf8");
    const sourcePath = opts.sourcePath ?? toPosixRelative(process.cwd(), absolute);

    const compileOpts: CompileOptions = stripWriteFlag({ ...opts, sourcePath });
    const result = await compile(source, compileOpts);

    if (opts.write === false) {
        return result;
    }

    const base = absolute.replace(/\.chart\.ts$/, "");
    const jsPath = `${base}.chart.js`;
    const manifestPath = `${base}.chart.manifest.json`;
    const dtsPath = `${base}.chart.d.ts`;

    await writeAtomic(jsPath, result.moduleSource);
    await writeAtomic(manifestPath, JSON.stringify(result.manifest, null, 4));
    await writeAtomic(dtsPath, result.types);
    if (
        (opts.sourcemap === true || opts.sourcemap === "external") &&
        result.sourcemap !== undefined
    ) {
        await writeAtomic(`${jsPath}.map`, result.sourcemap);
    }

    return result;
}

/**
 * Walk `rootDir` recursively and return every `*.chart.ts` file's absolute
 * path. Skips `node_modules` and `dist` subtrees. The walker is iterative to
 * stay portable across Node 20.1 → 20.x.
 *
 * @since 0.1
 * @example
 *     // const files = await walkChartFiles("./examples/scripts");
 *     const fn: typeof walkChartFiles = walkChartFiles;
 *     void fn;
 */
export async function walkChartFiles(rootDir: string): Promise<string[]> {
    const absolute = isAbsolute(rootDir) ? rootDir : resolvePath(process.cwd(), rootDir);
    const out: string[] = [];
    const queue: string[] = [absolute];

    for (;;) {
        const current = queue.shift();
        if (current === undefined) break;

        let entries: Awaited<ReturnType<typeof readDirEntries>>;
        try {
            entries = await readDirEntries(current);
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (entry.name === "node_modules" || entry.name === "dist") continue;
            const full = join(current, entry.name);
            if (entry.isDirectory) {
                queue.push(full);
                continue;
            }
            if (entry.isFile && full.endsWith(".chart.ts")) {
                out.push(full);
            }
        }
    }

    out.sort();
    return out;
}

/**
 * Discover every `*.chart.ts` under `rootDir` and compile each in parallel.
 * Results are returned in deterministic (path-sorted) order so callers can
 * snapshot the array safely. Compilation runs in memory only — the CLI
 * (Phase-1 Task 11) loops `compileFile` when it needs sibling files on disk.
 *
 * @since 0.1
 * @example
 *     // const all = await compileProject("./examples/scripts", { apiVersion: 1 });
 *     const fn: typeof compileProject = compileProject;
 *     void fn;
 */
export async function compileProject(
    rootDir: string,
    opts: CompileOptions,
): Promise<ReadonlyArray<CompiledScript>> {
    const files = await walkChartFiles(rootDir);
    const compiled = await Promise.all(
        files.map((file) =>
            compileFile(file, {
                ...opts,
                write: false,
                sourcePath: toPosixRelative(process.cwd(), file),
            }),
        ),
    );
    return Object.freeze(compiled);
}

function toPosixRelative(cwd: string, absolute: string): string {
    return relative(cwd, absolute).replace(/\\/g, "/");
}

type DirEntry = Readonly<{ name: string; isDirectory: boolean; isFile: boolean }>;

async function readDirEntries(dir: string): Promise<DirEntry[]> {
    const raw = await readdir(dir, { withFileTypes: true });
    return raw.map((entry) =>
        Object.freeze({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
        }),
    );
}

function stripWriteFlag(opts: CompileFileOptions): CompileOptions {
    const { apiVersion, sourcePath, sourcemap, minify, target, declaredIntervals } = opts;
    const out: { -readonly [K in keyof CompileOptions]: CompileOptions[K] } = { apiVersion };
    if (sourcePath !== undefined) out.sourcePath = sourcePath;
    if (sourcemap !== undefined) out.sourcemap = sourcemap;
    if (minify !== undefined) out.minify = minify;
    if (target !== undefined) out.target = target;
    if (declaredIntervals !== undefined) out.declaredIntervals = declaredIntervals;
    return out;
}
