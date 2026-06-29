// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile, writeFile } from "node:fs/promises";

import { emit, scaffoldToManifest } from "./codegen/index.js";
import { upgradeWarningsToErrors } from "./diagnostics/index.js";
import { lex } from "./lexer/index.js";
import { parseStatements } from "./parser/index.js";
import { analyze } from "./semantic/index.js";
import {
    DiagnosticCollector,
    transformCampA,
    transformCampB,
    transformCampC,
    transformDeclaration,
    transformInputs,
    transformOther,
    transformPolylineLinefill,
    transformTables,
} from "./transform/index.js";

/**
 * Package version. Mirrors `package.json`; the changeset workflow
 * drives both. Start at "0.0.0" matching every other scaffolded
 * package — the first publish minor-bump (see Changeset section)
 * lands the package at 0.1.0 in lockstep.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { PACKAGE_VERSION } from "@invinite-org/chartlang-pine-converter";
 *     console.log(PACKAGE_VERSION); // "0.0.0"
 */
export const PACKAGE_VERSION = "0.0.0";

/**
 * Severity of a converter `Diagnostic`. Codes are stable; severities map
 * one-to-one to UX treatment (error blocks, warning soft-warns, info hints).
 *
 * @since 0.1
 * @stable
 * @example
 *     const sev: DiagnosticSeverity = "warning";
 *     void sev;
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * One-based source location inside the Pine input.
 *
 * @since 0.1
 * @stable
 * @example
 *     const span: SourceSpan = {
 *         startLine: 1,
 *         startColumn: 1,
 *         endLine: 1,
 *         endColumn: 10,
 *     };
 *     void span;
 */
export type SourceSpan = Readonly<{
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
}>;

/**
 * Structured converter diagnostic. Codes are stable; messages are
 * advisory.
 *
 * @since 0.1
 * @stable
 * @example
 *     const diag: Diagnostic = {
 *         code: "pine-converter/not-ready",
 *         severity: "error",
 *         message: "lexer not implemented",
 *         span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
 *     };
 *     void diag;
 */
export type Diagnostic = Readonly<{
    code: string;
    severity: DiagnosticSeverity;
    message: string;
    span: SourceSpan;
    suggestion?: string;
}>;

/**
 * Manifest of what the converter produced. Tasks 8/9/16 populate.
 *
 * @since 0.1
 * @stable
 * @example
 *     const manifest: ConvertManifest = {
 *         kind: "drawing",
 *         name: "hello",
 *         inputs: [],
 *         drawingKindsUsed: [],
 *         requiresBarInterval: false,
 *     };
 *     void manifest;
 */
export type ConvertManifest = Readonly<{
    kind: "indicator" | "drawing";
    name: string;
    inputs: readonly string[];
    drawingKindsUsed: readonly string[];
    requiresBarInterval: boolean;
}>;

/**
 * Caller-supplied conversion options.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: ConvertOpts = {
 *         barInterval: 60_000,
 *         barIndexOrigin: null,
 *         strictMode: false,
 *         targetApiVersion: 1,
 *     };
 *     void opts;
 */
export type ConvertOpts = Readonly<{
    /** Milliseconds per bar — required when source uses `bar_index + N` future anchors. */
    barInterval?: number | null;
    /** Absolute time (ms) of `bar_index = 0` — required when source uses `bar_index[N]` historical anchors. */
    barIndexOrigin?: number | null;
    /** When true, every warning becomes an error. Default false. */
    strictMode?: boolean;
    /** Pinned to 1 in v1. */
    targetApiVersion?: 1;
}>;

/**
 * Conversion result. `output` and `manifest` are `null` until later
 * tasks land the real pipeline; `diagnostics` is always defined.
 *
 * @since 0.1
 * @stable
 * @example
 *     const result: ConvertResult = {
 *         output: null,
 *         manifest: null,
 *         diagnostics: [],
 *     };
 *     void result;
 */
export type ConvertResult = Readonly<{
    output: string | null;
    manifest: ConvertManifest | null;
    diagnostics: readonly Diagnostic[];
}>;

/**
 * Static description of the converter's current capabilities. Useful
 * for downstream tooling that inspects what's supported before passing
 * a script in.
 *
 * @since 0.1
 * @stable
 * @example
 *     const caps: ConverterCapabilities = {
 *         pineVersion: 6,
 *         convertibleDrawingKinds: [],
 *         convertibleInputs: [],
 *         convertibleCampModes: [],
 *     };
 *     void caps;
 */
export type ConverterCapabilities = Readonly<{
    pineVersion: 6;
    convertibleDrawingKinds: readonly string[];
    convertibleInputs: readonly string[];
    convertibleCampModes: readonly ("camp-a" | "camp-b" | "camp-c-heuristic")[];
}>;

/**
 * Thrown when `convert` is called before the implementation lands.
 * Tasks 2–16 progressively remove the throw sites.
 *
 * @since 0.1
 * @stable
 * @example
 *     try {
 *         throw new ConverterNotReadyError("lexer");
 *     } catch (err) {
 *         if (err instanceof ConverterNotReadyError) void err.missingLayer;
 *     }
 */
export class ConverterNotReadyError extends Error {
    public readonly missingLayer: string;
    public constructor(missingLayer: string) {
        super(`Pine converter not ready: layer "${missingLayer}" not yet implemented.`);
        this.name = "ConverterNotReadyError";
        this.missingLayer = missingLayer;
    }
}

// Whether a diagnostic list carries any error-severity entry — a fatal stop
// for the early lex/parse stages (no AST worth transforming).
function anyError(diagnostics: readonly Diagnostic[]): boolean {
    return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

/**
 * Convert a Pine v6 source string into a chartlang `.chart.ts` source string
 * with structured diagnostics. Runs the full pipeline — lex → parse →
 * semantic analysis → the transform passes (declaration, inputs, the Camp
 * A/B/C drawing lowerings, tables, polyline/linefill, control-flow) → codegen
 * — and returns `{ output, manifest, diagnostics }`. `convert` is synchronous
 * and does NOT round-trip the output through the chartlang compiler; callers
 * who want compile-verification call `compile(result.output, …)` themselves
 * (or the async `convertFile`). Lex/parse error-severity diagnostics short-
 * circuit with a `null` output.
 *
 * @since 0.1
 * @stable
 * @example
 *     const result = convert("//@version=6\nindicator('hello')");
 *     result.output?.startsWith("// Auto-generated"); // true
 */
export function convert(source: string, opts?: ConvertOpts): ConvertResult {
    // `strictMode` upgrades every warning to an error in the returned
    // diagnostics (the code STRINGS and `output` are unchanged — callers
    // detect failure by inspecting diagnostics for any error severity).
    const applyStrict = (diagnostics: readonly Diagnostic[]): readonly Diagnostic[] =>
        opts?.strictMode === true ? upgradeWarningsToErrors(diagnostics) : diagnostics;

    const lexResult = lex(source);
    if (anyError(lexResult.diagnostics)) {
        return { output: null, manifest: null, diagnostics: applyStrict(lexResult.diagnostics) };
    }
    const parseResult = parseStatements(lexResult.tokens);
    const parseDiagnostics = [...lexResult.diagnostics, ...parseResult.diagnostics];
    const declaration = parseResult.script.declaration;
    if (
        declaration === null ||
        (declaration.kind !== "indicator-declaration" &&
            declaration.kind !== "strategy-declaration")
    ) {
        return { output: null, manifest: null, diagnostics: applyStrict(parseDiagnostics) };
    }

    const analysis = analyze(parseResult.script);
    const diagnostics = new DiagnosticCollector();
    const scaffold = transformDeclaration(declaration, analysis, diagnostics);
    const promotedInline = transformInputs(analysis, scaffold, diagnostics);
    // `transformOther` runs BEFORE the drawing transforms so the non-drawing
    // scalar declarations it emits (`let ph = ta.pivotsHighLow.high(...)`)
    // precede the drawing pushes/updates that reference them. Pine declares a
    // pivot/level scalar at the top, then pushes it into a collection inside a
    // guard; emitting the push first would reference `ph` before its `let`
    // (a `used-before-declaration` compile error). `transformOther` reads only
    // `analysis` + `scaffold.inputs`, never the drawing transforms' output, so
    // running it first is order-safe.
    transformOther(analysis, scaffold, diagnostics, promotedInline);
    for (const site of analysis.drawingSites) {
        // `table.new` and `polyline.new` are owned by their dedicated
        // transforms (`transformTables` / `transformPolylineLinefill`), not the
        // Camp A/B/C dispatch — a `polyline` is not a `ChartlangDrawKind` the
        // camp synthesiser can render, so routing it through Camp A would emit
        // a broken `draw.undefined(...)`.
        if (site.constructor === "table.new" || site.constructor === "polyline.new") {
            continue;
        }
        if (site.camp.kind === "camp-a") {
            transformCampA(site, analysis, scaffold, diagnostics);
        } else if (site.camp.kind === "camp-b") {
            transformCampB(site, analysis, scaffold, diagnostics);
        } else {
            transformCampC(site, analysis, scaffold, diagnostics);
        }
    }
    transformTables(analysis, scaffold, diagnostics);
    transformPolylineLinefill(analysis, scaffold, diagnostics);

    const output = emit(scaffold);
    const manifest = scaffoldToManifest(scaffold, analysis);
    return {
        output,
        manifest,
        diagnostics: applyStrict([
            ...parseDiagnostics,
            ...analysis.diagnostics,
            ...diagnostics.toArray(),
        ]),
    };
}

/**
 * Caller-supplied options for {@link convertFile}. Extends {@link ConvertOpts}
 * with an optional `outPath`; when set and the conversion produces a non-null
 * `output`, the converted `.chart.ts` source is written there.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: ConvertFileOpts = { outPath: "out/hello.chart.ts", strictMode: true };
 *     void opts;
 */
export type ConvertFileOpts = ConvertOpts & Readonly<{ outPath?: string }>;

/**
 * Async file-system wrapper around {@link convert}: reads `path` as UTF-8,
 * converts it, and — when `opts.outPath` is set AND the conversion yields a
 * non-null `output` — writes that output to `opts.outPath`. Returns the same
 * `ConvertResult` as `convert`. File I/O failures (missing input, permission
 * denied) REJECT the promise: they are host-environment errors, NOT converter
 * diagnostics, and must be distinguishable from a clean conversion that merely
 * emitted error-severity diagnostics.
 *
 * @since 0.1
 * @stable
 * @example
 *     const result = await convertFile("hello.pine", { outPath: "hello.chart.ts" });
 *     result.output !== null; // true when the conversion succeeded
 */
export async function convertFile(path: string, opts?: ConvertFileOpts): Promise<ConvertResult> {
    const source = await readFile(path, "utf-8");
    const convertOpts = stripOutPath(opts);
    const result = convertOpts === undefined ? convert(source) : convert(source, convertOpts);
    if (opts?.outPath !== undefined && result.output !== null) {
        await writeFile(opts.outPath, result.output, "utf-8");
    }
    return result;
}

// Project a `ConvertFileOpts` down to the `ConvertOpts` `convert` accepts by
// dropping the `outPath` field. Returns `undefined` when no convert-relevant
// option survives so the caller forwards nothing (preserving the
// `exactOptionalPropertyTypes` contract — no explicit `undefined` fields).
function stripOutPath(opts: ConvertFileOpts | undefined): ConvertOpts | undefined {
    if (opts === undefined) {
        return undefined;
    }
    const { outPath: _outPath, ...rest } = opts;
    return rest;
}
