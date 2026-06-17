// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Package version. Mirrors `package.json`; the changeset workflow
 * drives both. Start at "0.0.0" matching every other scaffolded
 * package — the first publish minor-bump (see Changeset section)
 * lands the package at 0.1.0 in lockstep.
 *
 * @since 0.1
 * @experimental
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
 * @experimental
 * @example
 *     const sev: DiagnosticSeverity = "warning";
 *     void sev;
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * One-based source location inside the Pine input.
 *
 * @since 0.1
 * @experimental
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
 * @experimental
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
 * @experimental
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
 * @experimental
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
 * @experimental
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
 * @experimental
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
 * @experimental
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

/**
 * Convert a Pine v6 source string into a chartlang `.chart.ts` source
 * string with structured diagnostics. Throws `ConverterNotReadyError`
 * in this task; later tasks replace the throw with the real pipeline.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const result = convert("//@version=6\nindicator('hello')");
 *     void result;
 */
export function convert(source: string, opts?: ConvertOpts): ConvertResult {
    void source;
    void opts;
    throw new ConverterNotReadyError("lexer");
}
