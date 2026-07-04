// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { randomBytes } from "node:crypto";
import { readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from "node:path";
import { STATEFUL_PRIMITIVES_BY_NAME } from "@invinite-org/chartlang-core";
import type {
    DependencyDeclaration,
    IntervalDescriptor,
    OutputDeclaration,
    PlotSlotDescriptor,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import ts from "typescript";

import type { DepGraph, DrawnScript } from "./analysis/extractDependencyGraph.js";
import type { ExtractedDescriptor } from "./analysis/extractInputs.js";
import {
    extractAlertConditions,
    extractCapabilities,
    extractDependencyGraph,
    extractInputs,
    extractMaxLookback,
    extractRequestAnalysis,
    extractRequiresIntervals,
    runForbiddenConstructs,
    runStateArrayCapacity,
    runStatefulCallInLoop,
    runStructuralChecks,
    validateLowerTfIntervals,
} from "./analysis/index.js";
import type { InputLoopBounds } from "./analysis/loopBounds.js";
import {
    bundleModule,
    formatCompiledDefaultRebind,
    formatDependenciesAssignment,
    formatManifestAssignment,
} from "./bundle.js";
import {
    type CompiledProducerArtefacts,
    type ProducerCompiled,
    type ResolveCrossFileProducer,
    createProducerResolver,
} from "./dependency/index.js";
import type { CompileDiagnostic } from "./diagnostics.js";
import { mapTsDiagnostic } from "./diagnostics.js";
import { buildManifest } from "./manifest.js";
import { createProgramForSource } from "./program.js";
import { injectCallsiteIds } from "./transformers/callsiteIdInjection.js";
import { rewriteDependencyAccessors } from "./transformers/rewriteDependencyAccessors.js";
import { emitTypes } from "./typesEmit.js";

/**
 * Options accepted by `transformAndAnalyse`. `sourcePath` is the
 * package-relative POSIX path baked into every callsite id; the compiler
 * does not read any other file. `declaredIntervals` is the host-supplied
 * `Capabilities.intervals` set used by the `lower-tf-not-lower` validation —
 * when omitted the lower-timeframe ordering check is skipped.
 *
 * `resolveProducer` is the sync §22.10 indicator-composition snapshot
 * lookup; `compile` builds this from the pre-resolved cross-file
 * `ProducerCompiled` snapshots before invoking the transform pass. When
 * omitted (e.g. direct unit-test calls), cross-file dep edges resolve to
 * `null` and the analysis pass treats them as unresolvable.
 *
 * @since 0.1
 * @example
 *     const opts: TransformAndAnalyseOptions = { sourcePath: "demo.chart.ts" };
 */
export type TransformAndAnalyseOptions = Readonly<{
    sourcePath: string;
    declaredIntervals?: ReadonlyArray<IntervalDescriptor>;
    /**
     * `./X.chart` import specifiers whose source is supplied in-memory (not
     * on disk). Each is served to the typecheck program as a virtual
     * `CompiledScriptObject` stub so a single-source host (the demo's
     * `/api/compile`) does not report `TS2307` for sibling imports it
     * resolves out-of-band. Empty/absent ⇒ default disk resolution.
     *
     * @since 1.1
     */
    inMemoryChartImports?: ReadonlyArray<string>;
    resolveProducer?: (
        moduleSpecifier: string,
        exportName: string,
    ) => Readonly<{
        readonly name: string;
        readonly outputs: ReadonlyArray<{ readonly title: string; readonly kind: string }>;
        readonly inputs: Readonly<Record<string, unknown>>;
    }> | null;
}>;

/**
 * Result of `transformAndAnalyse`. `transformed` is the AST after callsite
 * ids have been injected; `manifest` is the recursively-frozen
 * `ScriptManifest`; `diagnostics` is the flat list of every diagnostic
 * emitted by any pass (errors abort the rewrite, warnings flow through).
 *
 * `siblings` is populated only for §22.10 multi-export indicator-composition
 * files (files with more than one drawn `defineIndicator(...)` binding) —
 * it carries every named-export manifest in source order. Single-script
 * files omit the field entirely so existing snapshot assertions stay
 * byte-identical.
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
    siblings?: ReadonlyArray<ScriptManifest>;
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
    const chartImports = preScanChartImports(source, sourcePath);
    const { program, sourceFile, checker } = createProgramForSource(source, {
        sourcePath,
        chartImports,
        ...(opts.inMemoryChartImports === undefined
            ? {}
            : { inMemoryChartImports: opts.inMemoryChartImports }),
    });

    const structural = runStructuralChecks(sourceFile, checker, sourcePath);
    const fileInputs = extractInputs(sourceFile, checker, sourcePath);
    const fileInputLoopBounds = inputLoopBoundsFromDescriptors(fileInputs.inputs);
    const forbidden = runForbiddenConstructs(sourceFile, sourcePath, fileInputLoopBounds);
    const statefulInLoop = runStatefulCallInLoop(
        sourceFile,
        checker,
        sourcePath,
        STATEFUL_PRIMITIVES_BY_NAME,
    );
    const stateArrayCapacity = runStateArrayCapacity(sourceFile, checker, sourcePath);
    // PLAN §5.2 step 1: the pipeline starts with tsc programmatic-API
    // typechecking against `@invinite-org/chartlang-core`'s ambient
    // declarations. Surface every semantic error coming from the
    // user's source file under the stable `type-error` code. Shim
    // diagnostics are dropped — they always come from the synthetic
    // core.d.ts and would only ever signal a chartlang-side bug.
    const semanticDiagnostics: CompileDiagnostic[] = program
        .getSemanticDiagnostics(sourceFile)
        .filter((d) => d.file?.fileName === sourceFile.fileName)
        .map((d) => mapTsDiagnostic(d, sourcePath));

    const depGraph: DepGraph = extractDependencyGraph(
        sourceFile,
        checker,
        sourcePath,
        structural.bindings,
        opts.resolveProducer === undefined
            ? () => null
            : (modSpec, expName) => {
                  const snap = opts.resolveProducer?.(modSpec, expName);
                  /* v8 ignore next */
                  if (snap === undefined || snap === null) return null;
                  return Object.freeze({
                      name: snap.name,
                      outputs: Object.freeze(
                          snap.outputs.map((o) =>
                              Object.freeze({
                                  title: o.title,
                                  kind: o.kind as "series-number",
                              }),
                          ),
                      ),
                      inputs: snap.inputs,
                  });
              },
    );

    const earlyDiagnostics: CompileDiagnostic[] = [
        ...semanticDiagnostics,
        ...structural.diagnostics,
        ...forbidden,
        ...statefulInLoop,
        ...stateArrayCapacity,
        ...depGraph.diagnostics,
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

    const rewrite = rewriteDependencyAccessors(sourceFile, depGraph, sourcePath);
    const rewrittenSource = rewrite.transformed;
    const plotSlots: PlotSlotDescriptor[] = [];
    const injection = injectCallsiteIds(rewrittenSource, checker, {
        sourcePath,
        statefulByName: STATEFUL_PRIMITIVES_BY_NAME,
        plotSlots,
    });
    const alertConditions = extractAlertConditions(sourceFile, checker, sourcePath);
    const intervalDiagnostics: CompileDiagnostic[] = [];
    const lowerTfDiagnostics = validateLowerTfIntervals(
        sourceFile,
        checker,
        sourcePath,
        opts.declaredIntervals ?? [],
    );
    const { requiresIntervals: structuralRequiresIntervals, ...structuralOverrides } =
        structural.overrides;
    void structuralRequiresIntervals;

    // The structural pass guarantees a single default-export drawn
    // entry before we reach this code (errors short-circuit above);
    // we surface the default here for manifest assembly.
    const defaultDrawn = depGraph.drawn.find((d) => d.exportName === "default");
    /* v8 ignore start */
    if (defaultDrawn === undefined) {
        // The structural pass guarantees a default-export drawn entry
        // before we reach this code (errors short-circuit above).
        throw new Error("internal: depGraph.drawn missing default entry");
    }
    /* v8 ignore stop */

    const isMultiExport = depGraph.drawn.length > 1;

    // File-level extractions (single-export back-compat path) — full source
    // walk so existing single-script manifests stay byte-identical.
    const fileCapabilities = extractCapabilities(sourceFile, checker, structural.kind);
    const fileLookback = extractMaxLookback(
        sourceFile,
        checker,
        sourcePath,
        sourceFile,
        fileInputLoopBounds,
        externalSeriesInputKeysFromDescriptors(fileInputs.inputs),
    );
    const fileRequestAnalysis = extractRequestAnalysis(
        sourceFile,
        checker,
        fileInputs.inputs,
        intervalDiagnostics,
        sourcePath,
        true,
    );
    const fileRequestedIntervalsFromCalls = fileRequestAnalysis.intervals;
    const fileRequiresIntervals = extractRequiresIntervals(
        sourceFile,
        checker,
        intervalDiagnostics,
        sourcePath,
    );
    const fileRequestedIntervals = Array.from(
        new Set([...fileRequestedIntervalsFromCalls, ...fileRequiresIntervals]),
    ).sort();

    const namedManifests: ScriptManifest[] = [];
    if (isMultiExport) {
        for (const drawn of depGraph.drawn) {
            if (drawn.exportName === "default") continue;
            namedManifests.push(
                buildDrawnManifest(
                    drawn,
                    depGraph,
                    sourceFile,
                    checker,
                    sourcePath,
                    structural.kind,
                    structuralOverrides,
                    alertConditions.alertConditions,
                ),
            );
        }
    }

    const defaultDependencies = buildDependencyDeclarations(defaultDrawn, depGraph, sourcePath);
    const defaultOutputs = defaultDrawn.outputs.length === 0 ? undefined : defaultDrawn.outputs;

    const manifest = isMultiExport
        ? buildDrawnManifest(
              defaultDrawn,
              depGraph,
              sourceFile,
              checker,
              sourcePath,
              structural.kind,
              structuralOverrides,
              alertConditions.alertConditions,
              namedManifests,
              plotSlots,
          )
        : buildManifest({
              name: structural.name,
              kind: structural.kind,
              capabilities: fileCapabilities,
              requestedIntervals: fileRequestedIntervals,
              userPickableInterval: fileInputs.userPickableInterval,
              seriesCapacities: fileLookback.seriesCapacities,
              maxLookback: fileLookback.maxLookback,
              inputs: fileInputs.inputs,
              ...structuralOverrides,
              ...(fileRequiresIntervals.length === 0
                  ? {}
                  : { requiresIntervals: fileRequiresIntervals }),
              ...(alertConditions.alertConditions.length === 0
                  ? {}
                  : { alertConditions: alertConditions.alertConditions }),
              ...(defaultDependencies === undefined || defaultDependencies.length === 0
                  ? {}
                  : { dependencies: defaultDependencies }),
              ...(defaultOutputs === undefined ? {} : { outputs: defaultOutputs }),
              ...(plotSlots.length === 0 ? {} : { plots: plotSlots }),
              ...(fileRequestAnalysis.securityExpressions.length === 0
                  ? {}
                  : { securityExpressions: fileRequestAnalysis.securityExpressions }),
              ...(fileRequestAnalysis.feeds.length === 0
                  ? {}
                  : { requestedFeeds: fileRequestAnalysis.feeds }),
          });

    const allDiagnostics: CompileDiagnostic[] = [
        ...earlyDiagnostics,
        ...injection.diagnostics,
        ...rewrite.diagnostics,
        ...fileLookback.diagnostics,
        ...fileInputs.diagnostics,
        ...alertConditions.diagnostics,
        ...intervalDiagnostics,
        ...lowerTfDiagnostics,
    ];

    return Object.freeze({
        transformed: injection.transformed,
        manifest,
        diagnostics: Object.freeze(allDiagnostics.slice()),
        ...(isMultiExport ? { siblings: Object.freeze(namedManifests.slice()) } : {}),
    });
}

function inputLoopBoundsFromDescriptors(
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): InputLoopBounds {
    const bounds = new Map<string, number | null>();
    for (const [name, descriptor] of Object.entries(inputs)) {
        if (descriptor.kind !== "int") continue;
        const max = descriptor.max;
        bounds.set(name, typeof max === "number" && Number.isFinite(max) ? max : null);
    }
    return bounds;
}

/**
 * The input KEYS declared as `input.externalSeries(...)`. `extractMaxLookback`
 * needs these to recognise `inputs.<key>[N]` (a `Series<number>` view read) as
 * a real lookback and size the runtime buffer — see the analysis'
 * `externalInputKeyOfExpr`. The descriptor's `kind` is the wire tag
 * (`"external-series"`) set by `extractInputs`.
 */
function externalSeriesInputKeysFromDescriptors(
    inputs: Readonly<Record<string, ExtractedDescriptor>>,
): ReadonlySet<string> {
    const keys = new Set<string>();
    for (const [name, descriptor] of Object.entries(inputs)) {
        if (descriptor.kind === "external-series") keys.add(name);
    }
    return keys;
}

function buildDrawnManifest(
    drawn: DrawnScript,
    depGraph: DepGraph,
    sourceFile: ts.SourceFile,
    checker: ts.TypeChecker,
    sourcePath: string,
    kind: "indicator" | "drawing" | "alert" | "alertCondition",
    structuralOverrides: Omit<
        ReturnType<typeof runStructuralChecks>["overrides"],
        "requiresIntervals"
    >,
    sharedAlertConditions: ReturnType<typeof extractAlertConditions>["alertConditions"],
    siblings?: ReadonlyArray<ScriptManifest>,
    plotSlots?: ReadonlyArray<PlotSlotDescriptor>,
): ScriptManifest {
    const intervalDiagnostics: CompileDiagnostic[] = [];
    const scope = drawn.defineCall;
    const capabilities = extractCapabilities(sourceFile, checker, kind, scope);
    const inputs = extractInputs(sourceFile, checker, sourcePath, scope);
    const inputLoopBounds = inputLoopBoundsFromDescriptors(inputs.inputs);
    const lookback = extractMaxLookback(
        sourceFile,
        checker,
        sourcePath,
        scope,
        inputLoopBounds,
        externalSeriesInputKeysFromDescriptors(inputs.inputs),
    );
    const requestAnalysis = extractRequestAnalysis(
        sourceFile,
        checker,
        inputs.inputs,
        intervalDiagnostics,
        sourcePath,
    );
    const requestedFromCalls = requestAnalysis.intervals;
    const requiresIntervalsScoped = extractRequiresIntervals(
        sourceFile,
        checker,
        intervalDiagnostics,
        sourcePath,
    );
    const requestedIntervals = Array.from(
        new Set([...requestedFromCalls, ...requiresIntervalsScoped]),
    ).sort();
    const dependencies = buildDependencyDeclarations(drawn, depGraph, sourcePath);
    const outputs = drawn.outputs.length === 0 ? undefined : drawn.outputs;
    const isDefault = drawn.exportName === "default";
    const nameForManifest = isDefault ? readDefineCallName(drawn.defineCall) : drawn.bindingName;

    return buildManifest({
        name: nameForManifest,
        kind,
        capabilities,
        requestedIntervals,
        userPickableInterval: inputs.userPickableInterval,
        seriesCapacities: lookback.seriesCapacities,
        maxLookback: lookback.maxLookback,
        inputs: inputs.inputs,
        ...structuralOverrides,
        /* v8 ignore start */
        ...(requiresIntervalsScoped.length === 0
            ? {}
            : { requiresIntervals: requiresIntervalsScoped }),
        ...(sharedAlertConditions.length === 0 ? {} : { alertConditions: sharedAlertConditions }),
        /* v8 ignore stop */
        ...(dependencies === undefined || dependencies.length === 0 ? {} : { dependencies }),
        ...(outputs === undefined ? {} : { outputs }),
        ...(plotSlots === undefined || plotSlots.length === 0 ? {} : { plots: plotSlots }),
        // Mirror `plots` scoping: the flat security-expression list and the
        // requested-feeds list attach to the default manifest only (the call
        // that also receives `plotSlots`).
        ...(plotSlots === undefined || requestAnalysis.securityExpressions.length === 0
            ? {}
            : { securityExpressions: requestAnalysis.securityExpressions }),
        ...(plotSlots === undefined || requestAnalysis.feeds.length === 0
            ? {}
            : { requestedFeeds: requestAnalysis.feeds }),
        exportName: drawn.exportName,
        isDrawn: true,
        ...(siblings !== undefined && siblings.length > 0 ? { siblings } : {}),
    });
}

function readDefineCallName(defineCall: ts.CallExpression): string {
    const arg = defineCall.arguments[0];
    /* v8 ignore next 3 */
    if (arg === undefined || !ts.isObjectLiteralExpression(arg)) {
        return "";
    }
    for (const property of arg.properties) {
        /* v8 ignore next */
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name;
        /* v8 ignore next */
        if (!ts.isIdentifier(name) || name.text !== "name") continue;
        const initializer = property.initializer;
        if (ts.isStringLiteral(initializer)) return initializer.text;
        /* v8 ignore next */
    }
    /* v8 ignore next 2 */
    return "";
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
    /**
     * Cross-file `.chart.ts` resolver. When undefined, `compile` builds
     * a default per-call resolver rooted at the file's directory.
     * `compileProject` shares one resolver across every file so the
     * inline-once invariant holds (a producer referenced by N consumers
     * compiles exactly once per project compile).
     *
     * @since 0.7
     */
    resolveProducer?: ResolveCrossFileProducer;
    /**
     * Absolute path the cross-file resolver should treat as the project
     * root. Defaults to the directory of `sourcePath`'s absolute
     * resolution. Imports resolving outside this tree return `null`.
     *
     * @since 0.7
     */
    rootDir?: string;
    /**
     * Bare specifier → self-contained ESM source map the bundler resolves
     * in-memory instead of from disk. Lets a host run `compile` where the
     * workspace `@invinite-org/chartlang-*` packages are not installed as
     * resolvable node_modules — e.g. a bundled serverless function, where
     * the packages were inlined into the host bundle rather than shipped
     * to the function filesystem. Each value must have no remaining bare
     * imports (pre-bundle the package before passing it).
     *
     * @since 1.1
     */
    inMemoryModules?: Readonly<Record<string, string>>;
    /**
     * Relative `./X.chart` import specifier → source map the cross-file
     * resolver satisfies in-memory instead of from disk, keyed by the
     * specifier **as written** (e.g. `"./base-trend.chart"`). Lets a host
     * that compiles a single source string (the demo's `/api/compile`
     * route) resolve sibling cross-file/composition imports it has in
     * memory but cannot read from disk. Ignored for **producer
     * resolution** when a custom `resolveProducer` is supplied (the host
     * owns resolution then); the TypeScript virtual stubs that suppress
     * `TS2307` for those specifiers are still inserted regardless.
     * Absent specifiers fall through to the normal disk read, so default
     * behaviour (no map / empty map) is byte-identical.
     *
     * @since 1.1
     */
    inMemoryChartSources?: Readonly<Record<string, string>>;
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
    const resolveProducer = opts.resolveProducer ?? createDefaultProducerResolver(sourcePath, opts);

    // Pre-scan the consumer's source for `import X from "./Y.chart"`
    // statements + resolve them in parallel. Each producer's resolved
    // snapshot feeds the sync lookup passed to `transformAndAnalyse`;
    // the same snapshots become the bundler's `inlinedProducers`.
    const preScan = preScanChartImports(source, sourcePath);
    const resolved = await Promise.all(
        preScan.map(async (specifier) => {
            const compiled = await resolveProducer(specifier, sourcePath);
            return { specifier, compiled };
        }),
    );
    const resolvedBySpecifier = new Map<string, ProducerCompiled | null>();
    for (const entry of resolved) {
        resolvedBySpecifier.set(entry.specifier, entry.compiled);
    }

    const inMemoryChartImports =
        opts.inMemoryChartSources === undefined
            ? []
            : preScan.filter((specifier) => opts.inMemoryChartSources?.[specifier] !== undefined);
    const transformOpts: TransformAndAnalyseOptions = {
        sourcePath,
        /* v8 ignore next 3 */
        ...(opts.declaredIntervals === undefined
            ? {}
            : { declaredIntervals: opts.declaredIntervals }),
        ...(inMemoryChartImports.length === 0 ? {} : { inMemoryChartImports }),
        resolveProducer: (modSpec, expName) => {
            const compiled = resolvedBySpecifier.get(modSpec);
            /* v8 ignore next 3 */
            if (compiled === undefined || compiled === null) {
                return null;
            }
            const manifest = compiled.drawnByExportName.get(expName);
            /* v8 ignore next 3 */
            if (manifest === undefined) {
                return null;
            }
            /* v8 ignore next */
            const outputs = manifest.outputs ?? [];
            return Object.freeze({
                name: manifest.name,
                outputs: Object.freeze(
                    outputs.map((o) => Object.freeze({ title: o.title, kind: o.kind })),
                ),
                inputs: Object.fromEntries(
                    Object.entries(manifest.inputs).map(([key, descriptor]) => [
                        key,
                        descriptor as unknown,
                    ]),
                ),
            });
        },
    };
    const result = transformAndAnalyse(source, transformOpts);

    const errors = result.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
        throw new CompileError(Object.freeze(errors.slice()));
    }

    const printedSource = PRINTER.printFile(result.transformed);
    const sourcemap = opts.sourcemap ?? false;
    // Walk every direct dep's transitive producer tree to build a
    // topologically-ordered list (leaves first). Dedup by hash so a
    // producer reached via two paths inlines exactly once.
    const orderedProducers: ProducerCompiled[] = [];
    const seenHashes = new Set<string>();
    const collectTransitive = (p: ProducerCompiled): void => {
        if (seenHashes.has(p.hash)) return;
        for (const nested of p.transitiveProducers) collectTransitive(nested);
        seenHashes.add(p.hash);
        orderedProducers.push(p);
    };
    for (const { compiled } of resolved) {
        /* v8 ignore next */
        if (compiled === null) continue;
        collectTransitive(compiled);
    }
    // Lower each cross-file `import <name> from "./X.chart"` line in
    // the consumer's source to `const <name> = __producer_<hash>__default;`
    // so the inlined producer's local binding feeds the rest of the
    // consumer's body. Imports of non-resolved producers stay as-is so
    // esbuild surfaces the unresolved-import error.
    const specifierToHash = new Map<string, string>();
    for (const entry of resolved) {
        /* v8 ignore next */
        if (entry.compiled === null) continue;
        specifierToHash.set(entry.specifier, entry.compiled.hash);
    }
    const consumerSourceWithRewrittenImports = rewriteConsumerChartImports(
        printedSource,
        specifierToHash,
    );
    // §22.10 indicator-composition: when the default manifest declares
    // private deps, append a hidden `export const __dependencies = [...]`
    // BEFORE handing the source to esbuild so the bundler sees every
    // alias binding referenced from the export graph. Pre-bundle inclusion
    // is load-bearing — appending after `bundleModule` would let esbuild's
    // tree-shaker drop aliases declared via `const trend = baseTrend;`
    // (cross-file aliases reduce to a bare reference after the §22.10
    // `withInputs` chain rewrite, which esbuild treats as side-effect-free
    // and DCE-eligible).
    const defaultDeps = result.manifest.dependencies ?? [];
    const depsAssignment = formatDependenciesAssignment(
        defaultDeps.map((d) => ({
            localId: d.localId,
            bindingExpression: d.localId,
            ...(Object.keys(d.effectiveInputs).length === 0
                ? {}
                : { effectiveInputs: d.effectiveInputs }),
        })),
    );
    const transformedSource = `${consumerSourceWithRewrittenImports}\n${depsAssignment}`;
    const inlinedProducers = orderedProducers.map((p) => ({
        hash: p.hash,
        rewrittenSource: p.rewrittenSource,
    }));
    const bundle = await bundleModule({
        transformedSource,
        sourcePath,
        sourcemap,
        minify: opts.minify ?? false,
        ...(inlinedProducers.length === 0 ? {} : { inlinedProducers }),
        ...(opts.inMemoryModules === undefined ? {} : { inMemoryModules: opts.inMemoryModules }),
    });

    const sidecar: ScriptManifest | ReadonlyArray<ScriptManifest> =
        result.siblings === undefined
            ? result.manifest
            : Object.freeze([result.manifest, ...result.siblings]);
    // The `__manifest` sidecar carries the compiler-derived manifest; the
    // rebind line then reassigns the esbuild default binding so `mod.default`
    // itself carries the real (primary) manifest instead of the frozen author
    // stub — feeding `mod.default` straight into the runtime Just Works.
    const moduleSource = `${bundle.moduleSource}${formatManifestAssignment(sidecar)}${formatCompiledDefaultRebind(bundle.moduleSource, result.manifest)}`;
    const types = emitTypes({ manifest: sidecar, sourcePath });

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

    const sidecar: ScriptManifest | ReadonlyArray<ScriptManifest> =
        result.manifest.siblings === undefined
            ? result.manifest
            : Object.freeze([result.manifest, ...result.manifest.siblings]);

    await writeAtomic(jsPath, result.moduleSource);
    await writeAtomic(manifestPath, JSON.stringify(sidecar, null, 4));
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
    let absoluteRoot: string;
    if (isAbsolute(rootDir)) {
        absoluteRoot = rootDir;
        /* v8 ignore next 3 */
    } else {
        absoluteRoot = resolvePath(process.cwd(), rootDir);
    }
    const sharedResolver: ResolveCrossFileProducer =
        opts.resolveProducer ??
        createProducerResolver({ rootDir: absoluteRoot }, (source, producerSourcePath) =>
            compileProducerArtefacts(source, producerSourcePath, sharedResolver),
        );
    const compiled = await Promise.all(
        files.map((file) =>
            compileFile(file, {
                ...opts,
                write: false,
                sourcePath: toPosixRelative(process.cwd(), file),
                resolveProducer: sharedResolver,
                rootDir: absoluteRoot,
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

function buildDependencyDeclarations(
    drawn: DrawnScript,
    depGraph: DepGraph,
    sourcePath: string,
): ReadonlyArray<DependencyDeclaration> {
    if (drawn.consumes.length === 0) return Object.freeze([]);
    const declarations: DependencyDeclaration[] = [];
    for (const consume of drawn.consumes) {
        declarations.push(buildOneDependencyDeclaration(consume, depGraph, sourcePath));
    }
    return Object.freeze(declarations);
}

function buildOneDependencyDeclaration(
    consume: DrawnScript["consumes"][number],
    depGraph: DepGraph,
    sourcePath: string,
): DependencyDeclaration {
    const ref = consume.producerRef;
    const outputsCopy = consume.outputs.map(
        (o): OutputDeclaration => Object.freeze({ title: o.title, kind: o.kind }),
    );
    /* v8 ignore next */
    if (ref.kind !== "same-file") return buildCrossFileDeclaration(consume, ref, outputsCopy);
    const isDrawn = depGraph.drawn.some(
        (d) => d.bindingName === ref.bindingName && d.exportName !== "default",
    );
    const exportName =
        depGraph.drawn.find((d) => d.bindingName === ref.bindingName)?.exportName ??
        ref.bindingName;
    return Object.freeze({
        localId: consume.localId,
        producerName: ref.bindingName,
        producerSourcePath: sourcePath,
        producerExportName: exportName,
        effectiveInputs: Object.freeze({ ...consume.effectiveInputs }),
        outputs: Object.freeze(outputsCopy),
        isDrawn,
    });
}

/* v8 ignore start */
function buildCrossFileDeclaration(
    consume: DrawnScript["consumes"][number],
    ref: Extract<DrawnScript["consumes"][number]["producerRef"], { kind: "cross-file" }>,
    outputsCopy: ReadonlyArray<OutputDeclaration>,
): DependencyDeclaration {
    return Object.freeze({
        localId: consume.localId,
        producerName: ref.exportName,
        producerSourcePath: ref.sourcePath,
        producerExportName: ref.exportName,
        effectiveInputs: Object.freeze({ ...consume.effectiveInputs }),
        outputs: Object.freeze(outputsCopy),
        isDrawn: false,
    });
}
/* v8 ignore stop */

function stripWriteFlag(opts: CompileFileOptions): CompileOptions {
    const {
        apiVersion,
        sourcePath,
        sourcemap,
        minify,
        target,
        declaredIntervals,
        resolveProducer,
        rootDir,
    } = opts;
    const out: { -readonly [K in keyof CompileOptions]: CompileOptions[K] } = { apiVersion };
    if (sourcePath !== undefined) out.sourcePath = sourcePath;
    if (sourcemap !== undefined) out.sourcemap = sourcemap;
    if (minify !== undefined) out.minify = minify;
    if (target !== undefined) out.target = target;
    if (declaredIntervals !== undefined) out.declaredIntervals = declaredIntervals;
    if (resolveProducer !== undefined) out.resolveProducer = resolveProducer;
    if (rootDir !== undefined) out.rootDir = rootDir;
    return out;
}

/**
 * Lower each cross-file `import <name> from "./X.chart"` line in the
 * consumer's printed TS source to `const <name> = __producer_<hash>__default;`
 * so the inlined producer's local binding wires into the consumer's body.
 * Imports of unresolved specifiers (no entry in `specifierToHash`) stay
 * as-is so esbuild surfaces the resolution failure.
 *
 * Phase 1 only supports the default-import form — named imports remain
 * untouched and will be addressed when same-file named-export composition
 * crosses file boundaries.
 *
 * @since 0.7
 */
function rewriteConsumerChartImports(
    source: string,
    specifierToHash: ReadonlyMap<string, string>,
): string {
    if (specifierToHash.size === 0) return source;
    return source.replace(
        /^\s*import\s+([A-Za-z_$][A-Za-z0-9_$]*)\s+from\s+(['"])([^'"]+)\2;\s*$/gm,
        (match, name: string, _quote: string, specifier: string) => {
            const hash = specifierToHash.get(specifier);
            /* v8 ignore next */
            if (hash === undefined) return match;
            return `const ${name} = __producer_${hash}__default;`;
        },
    );
}

/**
 * Pre-scan a `.chart.ts` source for `.chart.ts` / `.chart` import
 * specifiers using a one-pass AST walk. Returns a deduplicated array of
 * specifiers in source-declaration order. The list feeds `compile`'s
 * async resolver before `transformAndAnalyse` runs so the analysis pass
 * can resolve cross-file producer snapshots synchronously.
 *
 * @since 0.7
 */
function preScanChartImports(source: string, sourcePath: string): ReadonlyArray<string> {
    const sourceFile = ts.createSourceFile(
        sourcePath,
        source,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );
    const specifiers: string[] = [];
    const seen = new Set<string>();
    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement)) continue;
        const specifier = statement.moduleSpecifier;
        /* v8 ignore next 3 */
        if (!ts.isStringLiteral(specifier)) {
            continue;
        }
        const text = specifier.text;
        if (!text.endsWith(".chart") && !text.endsWith(".chart.ts")) continue;
        /* v8 ignore next 3 */
        if (seen.has(text)) {
            continue;
        }
        seen.add(text);
        specifiers.push(text);
    }
    return Object.freeze(specifiers);
}

/**
 * Build a per-`compile` cross-file resolver rooted at the consumer's
 * directory. `compileProject` overrides this by sharing a single
 * resolver across every file so the inline-once invariant holds.
 *
 * @since 0.7
 */
function createDefaultProducerResolver(
    sourcePath: string,
    opts: CompileOptions,
): ResolveCrossFileProducer {
    let absSourcePath: string;
    /* v8 ignore next 3 */
    if (isAbsolute(sourcePath)) {
        absSourcePath = sourcePath;
    } else {
        absSourcePath = resolvePath(process.cwd(), sourcePath);
    }
    const rootDir = opts.rootDir ?? dirname(absSourcePath);
    const resolver: ResolveCrossFileProducer = createProducerResolver(
        {
            rootDir,
            ...(opts.inMemoryChartSources === undefined
                ? {}
                : { inMemorySources: opts.inMemoryChartSources }),
        },
        (source, producerSourcePath) =>
            compileProducerArtefacts(source, producerSourcePath, resolver),
    );
    return resolver;
}

/**
 * Compile one producer file for the resolver. Pre-scans its imports,
 * resolves them recursively (so transitive producers populate the
 * cache before we hand control back), runs the producer's own
 * `compile` + `transformAndAnalyse`, and returns the artefacts the
 * resolver wraps into a {@link ProducerCompiled} snapshot.
 *
 * @since 0.7
 */
async function compileProducerArtefacts(
    source: string,
    producerSourcePath: string,
    resolver: ResolveCrossFileProducer,
): Promise<CompiledProducerArtefacts | null> {
    try {
        // Pre-resolve the producer's own cross-file deps so the
        // recursive `compile` can pull the matching snapshot from the
        // shared resolver's cache instead of compiling twice.
        const preScan = preScanChartImports(source, producerSourcePath);
        const nested = await Promise.all(
            preScan.map(async (specifier) => ({
                specifier,
                compiled: await resolver(specifier, producerSourcePath),
            })),
        );
        const result = await compile(source, {
            apiVersion: 1,
            sourcePath: producerSourcePath,
            resolveProducer: resolver,
        });
        const transformAndAnalyseResult = transformAndAnalyse(source, {
            sourcePath: producerSourcePath,
            resolveProducer: buildSyncSnapshotResolver(nested),
        });
        const transformedSource = PRINTER.printFile(transformAndAnalyseResult.transformed);
        const transitiveProducers: ProducerCompiled[] = [];
        const specifierToHash = new Map<string, string>();
        for (const { specifier, compiled } of nested) {
            /* v8 ignore next */
            if (compiled === null) continue;
            transitiveProducers.push(compiled);
            specifierToHash.set(specifier, compiled.hash);
        }
        let siblings: ReadonlyArray<ScriptManifest>;
        if (transformAndAnalyseResult.siblings === undefined) {
            siblings = Object.freeze([]);
            /* v8 ignore next 3 */
        } else {
            siblings = transformAndAnalyseResult.siblings;
        }
        return Object.freeze({
            moduleSource: result.moduleSource,
            transformedSource,
            manifest: result.manifest,
            siblings,
            transitiveProducers: Object.freeze(transitiveProducers),
            specifierToHash,
        });
        /* v8 ignore next 3 */
    } catch {
        return null;
    }
}

/**
 * Build a sync snapshot resolver from a pre-resolved list of cross-file
 * producers. Returns the producer manifest's `ProducerSnapshot` shape
 * `transformAndAnalyse` calls when walking consumer-side
 * `<binding>.output("title")` references.
 */
function buildSyncSnapshotResolver(
    nested: ReadonlyArray<{ specifier: string; compiled: ProducerCompiled | null }>,
): NonNullable<TransformAndAnalyseOptions["resolveProducer"]> {
    const bySpecifier = new Map<string, ProducerCompiled>();
    for (const entry of nested) {
        if (entry.compiled !== null) bySpecifier.set(entry.specifier, entry.compiled);
    }
    return (modSpec, expName) => {
        const compiled = bySpecifier.get(modSpec);
        /* v8 ignore next 3 */
        if (compiled === undefined) {
            return null;
        }
        const manifest = compiled.drawnByExportName.get(expName);
        /* v8 ignore next 3 */
        if (manifest === undefined) {
            return null;
        }
        /* v8 ignore next */
        const outputs = manifest.outputs ?? [];
        return Object.freeze({
            name: manifest.name,
            outputs: Object.freeze(
                outputs.map((o) => Object.freeze({ title: o.title, kind: o.kind })),
            ),
            inputs: Object.fromEntries(
                Object.entries(manifest.inputs).map(([key, descriptor]) => [
                    key,
                    descriptor as unknown,
                ]),
            ),
        });
    };
}
