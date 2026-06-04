// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * Virtual on-disk path the in-memory `@invinite-org/chartlang-core` ambient
 * declaration file is served from. Kept stable so the analysis passes can
 * detect callee declarations coming from core (vs. user-shadowed names).
 *
 * @since 0.1
 * @example
 *     import { CORE_MODULE_PATH } from "@invinite-org/chartlang-compiler/program";
 *     void CORE_MODULE_PATH;
 */
export const CORE_MODULE_PATH = "/__chartlang__/core.d.ts";

/**
 * Ambient `.d.ts` shim covering the exact `@invinite-org/chartlang-core`
 * surface the compiler needs for symbol resolution. Lives in-memory so the
 * compiler is deterministic and host-machine independent — no on-disk
 * resolution of `workspace:*` packages required.
 *
 * The shim mirrors the runtime types; it does NOT carry the throw-sentinel
 * bodies the real callable holes ship. That doesn't matter — the compiler
 * only does static analysis; it never executes script source.
 */
const CORE_AMBIENT_SHIM = `
declare module "@invinite-org/chartlang-core" {
    export type Time = number;
    export type Price = number;
    export type Volume = number;
    export type Color = string;
    export type LineStyle = "solid" | "dashed" | "dotted";
    export type AlertSeverity = "info" | "warning" | "critical";
    export type CapabilityId = "indicators" | "drawings" | "alerts";
    export type Bar = {
        readonly time: Time;
        readonly open: Price;
        readonly high: Price;
        readonly low: Price;
        readonly close: Price;
        readonly volume: Volume;
        readonly symbol: string;
        readonly interval: string;
    };
    export type Series<T> = {
        readonly current: T;
        readonly [n: number]: T;
        readonly length: number;
    };
    export type SmaOpts = Readonly<Record<string, never>>;
    export type EmaOpts = Readonly<Record<string, never>>;
    export type StdevOpts = Readonly<{ biased?: boolean }>;
    export type BbOpts = Readonly<{ multiplier?: number }>;
    export type RsiOpts = Readonly<Record<string, never>>;
    export type MacdOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        signalLength?: number;
    }>;
    export type AtrOpts = Readonly<Record<string, never>>;
    export type BbResult = Readonly<{
        upper: Series<number>;
        middle: Series<number>;
        lower: Series<number>;
    }>;
    export type MacdResult = Readonly<{
        macd: Series<number>;
        signal: Series<number>;
        hist: Series<number>;
    }>;
    export type TaNamespace = {
        sma(source: Series<number>, length: number, opts?: SmaOpts): Series<number>;
        ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
        stdev(source: Series<number>, length: number, opts?: StdevOpts): Series<number>;
        bb(source: Series<number>, length: number, opts?: BbOpts): BbResult;
        rsi(source: Series<number>, length: number, opts?: RsiOpts): Series<number>;
        macd(source: Series<number>, opts?: MacdOpts): MacdResult;
        atr(length: number, opts?: AtrOpts): Series<number>;
        crossover(a: Series<number>, b: Series<number> | number): Series<boolean>;
        crossunder(a: Series<number>, b: Series<number> | number): Series<boolean>;
    };
    export const ta: TaNamespace;
    export type PlotKind = "line" | "step-line" | "horizontal-line";
    export type PlotOpts = Readonly<{
        color?: Color;
        title?: string;
        lineWidth?: number;
        lineStyle?: LineStyle;
        pane?: "overlay" | "new" | string;
    }>;
    export type HLineOpts = Readonly<{
        color?: Color;
        title?: string;
        lineWidth?: number;
        lineStyle?: LineStyle;
    }>;
    export function plot(value: number | Series<number>, opts?: PlotOpts): void;
    export function hline(price: number, opts?: HLineOpts): void;
    export type JsonValue =
        | null
        | boolean
        | number
        | string
        | ReadonlyArray<JsonValue>
        | { readonly [k: string]: JsonValue };
    export type AlertOpts = Readonly<{
        severity?: AlertSeverity;
        meta?: Readonly<Record<string, JsonValue>>;
    }>;
    export function alert(message: string, opts?: AlertOpts): void;
    export type InputSchema = Readonly<Record<string, unknown>>;
    export type ScriptManifest = {
        readonly apiVersion: 1;
        readonly kind: "indicator" | "drawing" | "alert";
        readonly name: string;
        readonly inputs: InputSchema;
        readonly capabilities: ReadonlyArray<CapabilityId>;
        readonly requestedIntervals: ReadonlyArray<string>;
        readonly userPickableInterval: boolean;
        readonly seriesCapacities: Readonly<Record<string, number>>;
        readonly maxLookback: number;
    };
    export type ComputeContext = {
        readonly bar: Bar;
        readonly inputs: Readonly<Record<string, unknown>>;
        readonly ta: TaNamespace;
        readonly plot: typeof plot;
        readonly hline: typeof hline;
        readonly alert: typeof alert;
    };
    export type ComputeFn = (ctx: ComputeContext) => void;
    export type CompiledScriptObject = {
        readonly manifest: ScriptManifest;
        readonly compute: ComputeFn;
    };
    export type DefineIndicatorOpts = Readonly<{
        name: string;
        apiVersion: 1;
        overlay?: boolean;
        inputs?: InputSchema;
        compute: ComputeFn;
    }>;
    export type DefineAlertOpts = Readonly<{
        name: string;
        apiVersion: 1;
        inputs?: InputSchema;
        compute: ComputeFn;
    }>;
    export function defineIndicator(opts: DefineIndicatorOpts): CompiledScriptObject;
    export function defineAlert(opts: DefineAlertOpts): CompiledScriptObject;
    export const STATEFUL_PRIMITIVES: ReadonlySet<string>;
}
`;

/**
 * The compiler options the compiler pins for every script. ES2022 target,
 * Bundler module resolution, strict mode, no DOM. Scripts that depend on
 * browser globals fail the `forbiddenConstructs` pass on the global access
 * itself; the `lib` setting keeps the typechecker from accepting them in the
 * first place.
 *
 * @since 0.1
 * @example
 *     import { COMPILER_OPTIONS } from "@invinite-org/chartlang-compiler/program";
 *     void COMPILER_OPTIONS;
 */
export const COMPILER_OPTIONS: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    lib: ["lib.es2022.d.ts"],
    skipLibCheck: true,
    esModuleInterop: true,
    isolatedModules: true,
    verbatimModuleSyntax: false,
    allowJs: false,
};

/**
 * The return shape of `createProgramForSource`. Callers use `sourceFile` for
 * AST walks, `checker` for symbol resolution, and `program` as the root
 * handle when they need diagnostics from `tsc` itself (not used in Phase 1,
 * but kept on the type so Task 3 can plug in `program.getSemanticDiagnostics`
 * without an API change).
 *
 * @since 0.1
 * @example
 *     // const { sourceFile, checker } = createProgramForSource(src, opts);
 *     const shape: { sourceFile: unknown; checker: unknown; program: unknown } = {
 *         sourceFile: null,
 *         checker: null,
 *         program: null,
 *     };
 *     void shape;
 */
export type ProgramForSource = Readonly<{
    program: ts.Program;
    sourceFile: ts.SourceFile;
    checker: ts.TypeChecker;
}>;

/**
 * Build a single-file TypeScript program for an in-memory `.chart.ts`
 * source. The synthetic file lives at `sourcePath` (POSIX, as the user
 * would write it); imports of `@invinite-org/chartlang-core` resolve
 * against the in-memory ambient shim. Returns the source file and a
 * configured type checker — the caller never sees the underlying compiler
 * host plumbing.
 *
 * @since 0.1
 * @example
 *     // const { sourceFile, checker } = createProgramForSource(
 *     //     'export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });',
 *     //     { sourcePath: "demo.chart.ts" },
 *     // );
 *     const fn: typeof createProgramForSource = createProgramForSource;
 *     void fn;
 */
export function createProgramForSource(
    source: string,
    opts: { readonly sourcePath: string },
): ProgramForSource {
    const sourcePath = normalisePath(opts.sourcePath);
    const VIRTUAL_FILE_SET: ReadonlySet<string> = new Set([sourcePath, CORE_MODULE_PATH]);
    const sourceFile = ts.createSourceFile(
        sourcePath,
        source,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );
    const shimFile = ts.createSourceFile(
        CORE_MODULE_PATH,
        CORE_AMBIENT_SHIM,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );

    const fallbackHost = ts.createCompilerHost(COMPILER_OPTIONS, true);

    const host: ts.CompilerHost = {
        ...fallbackHost,
        getSourceFile(
            fileName,
            languageVersionOrOptions,
            onError,
            shouldCreateNewSourceFile,
        ): ts.SourceFile | undefined {
            if (fileName === sourcePath) return sourceFile;
            if (fileName === CORE_MODULE_PATH) return shimFile;
            return fallbackHost.getSourceFile(
                fileName,
                languageVersionOrOptions,
                onError,
                shouldCreateNewSourceFile,
            );
        },
        fileExists(fileName) {
            return VIRTUAL_FILE_SET.has(fileName) || fallbackHost.fileExists(fileName);
        },
    };

    const program = ts.createProgram({
        rootNames: [sourcePath, CORE_MODULE_PATH],
        options: COMPILER_OPTIONS,
        host,
    });
    return Object.freeze({
        program,
        sourceFile,
        checker: program.getTypeChecker(),
    });
}

function normalisePath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\.\//, "");
}
