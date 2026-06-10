// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
    Adapter,
    AlertConditionEmission,
    AlertEmission,
    Capabilities,
    DiagnosticCode,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { compile as defaultCompile, type CompiledScript } from "@invinite-org/chartlang-compiler";
import type { Bar, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { createScriptRunner } from "@invinite-org/chartlang-runtime";

import { GOLDEN_BARS_PATH, type GoldenBars } from "./fixtures/generateGoldenBars.js";

/**
 * A single conformance scenario. The script source comes from
 * exactly one of `scriptPath` (a repo-root-relative path to a
 * curated `.chart.ts` file — Phase-1 default) or `inlineSource`
 * (a string of TypeScript that the runner writes to the existing
 * `.cache/` tmp file and compiles + imports). Phase-2 ports use
 * `inlineSource` so `examples/scripts/` stays a curated demo set
 * rather than ballooning to 80+ micro-scripts.
 *
 * Mutual-exclusion: defining both fields is a runner-time error,
 * as is defining neither.
 *
 * `capabilitiesOverride` is merged over the adapter capability bag for
 * this scenario only. `candleLimit` and `eventStream` keep specialised
 * scenarios small without changing the suite-wide candle fixture.
 *
 * When `inlineSource` is used, the runner passes `sourcePath:
 * "<inline:${id}>.chart.ts"` to the compiler so callsite-id
 * injection produces a stable, pinnable slot-id prefix.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { Scenario } from "@invinite-org/chartlang-conformance";
 *     declare const sourceText: string; // user-authored .chart.ts source
 *     const inline: Scenario = {
 *         id: "demo-inline",
 *         title: "Inline demo",
 *         inlineSource: sourceText,
 *         intervalCount: 1,
 *         assertions: [],
 *         capabilitiesOverride: { multiTimeframe: false },
 *     };
 *     void inline;
 */
export type Scenario = {
    readonly id: string;
    readonly title: string;
    /**
     * Repo-root-relative path to a curated `.chart.ts` file. Mutually
     * exclusive with {@link Scenario.inlineSource}.
     */
    readonly scriptPath?: string;
    /**
     * Inline TypeScript source. Mutually exclusive with
     * {@link Scenario.scriptPath}. `@since 0.2`.
     */
    readonly inlineSource?: string;
    readonly intervalCount: number;
    readonly capabilitiesOverride?: Partial<Capabilities>;
    readonly candleLimit?: number;
    readonly secondaryCandles?: Readonly<Record<string, ReadonlyArray<Bar>>>;
    readonly eventStream?: ScenarioEventStream;
    readonly assertions: ReadonlyArray<ScenarioAssertion>;
};

/**
 * Event stream mode for a scenario. Omitted means every candle is driven
 * through `onBarClose`. `initial-close-then-ticks` closes the first candle
 * to initialise the stream, then drives the remaining candles as ticks.
 *
 * @since 0.4
 * @stable
 * @example
 *     import type { ScenarioEventStream } from "@invinite-org/chartlang-conformance";
 *     const stream: ScenarioEventStream = { kind: "initial-close-then-ticks" };
 *     void stream;
 */
export type ScenarioEventStream =
    | { readonly kind: "close" }
    | { readonly kind: "initial-close-then-ticks" };

/**
 * Assertion the runner evaluates against a scenario's buffered
 * emissions. The six variants cover plot-series hashing, alert
 * counting, alert-message substring search, diagnostic absence,
 * diagnostic presence, and (Phase 3) drawing-series hashing.
 *
 * The `drawing-hash` variant pins SHA-256 over JSON-stringified
 * `{ handleId, kind, op, state, bar }` tuples in emission order
 * (filtered by `handleId` if supplied). Re-pinning workflow
 * mirrors `plot-hash`: copy the `actual` hash from the failure
 * message into the scenario's pinned value.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { ScenarioAssertion } from "@invinite-org/chartlang-conformance";
 *     const a: ScenarioAssertion = { kind: "alert-count", count: 0 };
 *     // Phase-3: drawing-hash assertion
 *     const d: ScenarioAssertion = {
 *         kind: "drawing-hash",
 *         handleId: "demo.chart.ts:5:13#0#0",
 *         sha256: "deadbeef".repeat(8),
 *     };
 *     void a;
 *     void d;
 */
export type ScenarioAssertion =
    | { readonly kind: "plot-hash"; readonly slotId?: string; readonly sha256: string }
    | { readonly kind: "alert-count"; readonly count: number }
    | { readonly kind: "alert-message-contains"; readonly pattern: string; readonly min: number }
    | { readonly kind: "log-emission-count"; readonly expected: number }
    | { readonly kind: "diagnostic-code-absent"; readonly code: DiagnosticCode }
    | { readonly kind: "diagnostic-code-present"; readonly code: DiagnosticCode }
    | {
          readonly kind: "alert-condition-fired-at-bar";
          readonly expected: ReadonlyArray<{
              readonly conditionId: string;
              readonly fired: boolean;
              readonly bar: number;
          }>;
      }
    | {
          readonly kind: "drawing-hash";
          readonly handleId?: string;
          readonly sha256: string;
      };

/**
 * A single conformance failure entry. `message` carries enough
 * context for the developer to re-pin assertion values without
 * re-running the suite — it always contains both `expected` and
 * `actual` for hash and count comparisons.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { ConformanceFailure } from "@invinite-org/chartlang-conformance";
 *     const f: ConformanceFailure = {
 *         scenarioId: "ema-cross",
 *         assertionKind: "alert-count",
 *         message: "alert-count: expected 42, actual 41",
 *     };
 *     void f;
 */
export type ConformanceFailure = {
    readonly scenarioId: string;
    readonly assertionKind: ScenarioAssertion["kind"];
    readonly message: string;
};

/**
 * Per-scenario outcome retained by {@link ConformanceReport}. A
 * scenario passes only when every assertion succeeds; `failures`
 * contains that scenario's assertion failures and is empty for a
 * passing scenario.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { ScenarioResult } from "@invinite-org/chartlang-conformance";
 *     const result: ScenarioResult = {
 *         id: "ema-cross",
 *         title: "EMA cross",
 *         status: "pass",
 *         failures: [],
 *     };
 *     void result;
 */
export type ScenarioResult = {
    readonly id: string;
    readonly title: string;
    readonly status: "pass" | "fail";
    readonly failures: ReadonlyArray<ConformanceFailure>;
};

/**
 * Aggregated outcome of one `runConformanceSuite` call. `passed`
 * counts scenarios in which every assertion succeeded; `failed`
 * counts scenarios with at least one failure; `failures` carries one
 * entry per failed assertion across all scenarios. `scenarios`
 * retains the per-scenario pass/fail row data used by public reports.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { ConformanceReport } from "@invinite-org/chartlang-conformance";
 *     const r: ConformanceReport = {
 *         passed: 3,
 *         failed: 0,
 *         failures: [],
 *         scenarios: [
 *             { id: "ema-cross", title: "EMA cross", status: "pass", failures: [] },
 *         ],
 *     };
 *     void r;
 */
export type ConformanceReport = {
    readonly passed: number;
    readonly failed: number;
    readonly failures: ReadonlyArray<ConformanceFailure>;
    readonly scenarios: ReadonlyArray<ScenarioResult>;
};

/**
 * Optional injection seams for {@link runConformanceSuite}. `scenarios`
 * overrides the bundled Phase-1 set; `candles` overrides the bundled
 * golden bars (useful for fast unit tests); `compile` overrides the
 * default `compile` so tests can short-circuit esbuild.
 *
 * @since 0.1
 * @stable
 * @example
 *     import type { RunConformanceSuiteOpts } from "@invinite-org/chartlang-conformance";
 *     const o: RunConformanceSuiteOpts = { scenarios: [], candles: [] };
 *     void o;
 */
export type RunConformanceSuiteOpts = {
    readonly scenarios?: ReadonlyArray<Scenario>;
    readonly candles?: ReadonlyArray<Bar>;
    readonly compile?: typeof defaultCompile;
};

type AssertionResult = ConformanceFailure | null;

type BufferedRun = {
    readonly plots: ReadonlyArray<PlotEmission>;
    readonly drawings: ReadonlyArray<DrawingEmission>;
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly alertConditions: ReadonlyArray<AlertConditionEmission>;
    readonly logs: ReadonlyArray<LogEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
};

type RunnerWithPush = ReturnType<typeof createScriptRunner>;

function mergeCapabilities(
    base: Capabilities,
    override: Partial<Capabilities> | undefined,
): Capabilities {
    return override === undefined ? base : Object.freeze({ ...base, ...override });
}

const PACKAGE_DIR = resolvePath(fileURLToPath(import.meta.url), "../..");
const REPO_ROOT = resolvePath(PACKAGE_DIR, "../..");
const CACHE_DIR = resolvePath(PACKAGE_DIR, ".cache");

function resolveScriptPath(scriptPath: string): string {
    return isAbsolute(scriptPath) ? scriptPath : resolvePath(REPO_ROOT, scriptPath);
}

function hashPlotSeries(
    plots: ReadonlyArray<PlotEmission>,
    slotId: string | undefined,
): { readonly hash: string; readonly count: number } {
    const filtered = slotId === undefined ? plots : plots.filter((p) => p.slotId === slotId);
    const tuples = filtered.map((p) => ({ bar: p.bar, value: p.value }));
    const hash = createHash("sha256").update(JSON.stringify(tuples)).digest("hex");
    return { hash, count: tuples.length };
}

function hashDrawingSeries(
    drawings: ReadonlyArray<DrawingEmission>,
    handleId: string | undefined,
): { readonly hash: string; readonly count: number } {
    const filtered =
        handleId === undefined ? drawings : drawings.filter((d) => d.handleId === handleId);
    const tuples = filtered.map((d) => ({
        handleId: d.handleId,
        kind: d.drawingKind,
        op: d.op,
        state: d.state,
        bar: d.bar,
    }));
    const hash = createHash("sha256").update(JSON.stringify(tuples)).digest("hex");
    return { hash, count: tuples.length };
}

function evalAssertion(
    scenarioId: string,
    run: BufferedRun,
    assertion: ScenarioAssertion,
): AssertionResult {
    switch (assertion.kind) {
        case "plot-hash": {
            const { hash, count } = hashPlotSeries(run.plots, assertion.slotId);
            if (hash === assertion.sha256) return null;
            const slotLabel = assertion.slotId ?? "<all>";
            return {
                scenarioId,
                assertionKind: "plot-hash",
                message: `plot-hash[${slotLabel}]: expected ${assertion.sha256}, actual ${hash} (${count} points)`,
            };
        }
        case "alert-count": {
            const actual = run.alerts.length;
            if (actual === assertion.count) return null;
            return {
                scenarioId,
                assertionKind: "alert-count",
                message: `alert-count: expected ${assertion.count}, actual ${actual}`,
            };
        }
        case "alert-message-contains": {
            const actual = run.alerts.filter((a) => a.message.includes(assertion.pattern)).length;
            if (actual >= assertion.min) return null;
            return {
                scenarioId,
                assertionKind: "alert-message-contains",
                message: `alert-message-contains[${assertion.pattern}]: expected ≥${assertion.min}, actual ${actual}`,
            };
        }
        case "log-emission-count": {
            const actual = run.logs.length;
            if (actual === assertion.expected) return null;
            return {
                scenarioId,
                assertionKind: "log-emission-count",
                message: `log-emission-count: expected ${assertion.expected}, actual ${actual}`,
            };
        }
        case "diagnostic-code-absent": {
            const hit = run.diagnostics.find((d) => d.code === assertion.code);
            if (hit === undefined) return null;
            // Phase-1 runtime pushes diagnostics with a numeric `bar`;
            // the `null` fallback is a type-level allowance for future
            // off-step diagnostics (e.g. Phase 5 load failures).
            /* v8 ignore next */
            const barLabel = hit.bar ?? "<n/a>";
            return {
                scenarioId,
                assertionKind: "diagnostic-code-absent",
                message: `diagnostic-code-absent[${assertion.code}]: found at bar ${barLabel} — "${hit.message}"`,
            };
        }
        case "diagnostic-code-present": {
            const hit = run.diagnostics.find((d) => d.code === assertion.code);
            if (hit !== undefined) return null;
            return {
                scenarioId,
                assertionKind: "diagnostic-code-present",
                message: `diagnostic-code-present[${assertion.code}]: no diagnostic with that code was emitted`,
            };
        }
        case "alert-condition-fired-at-bar": {
            const actual = run.alertConditions.map((condition) => ({
                conditionId: condition.conditionId,
                fired: condition.fired,
                bar: condition.bar,
            }));
            if (JSON.stringify(actual) === JSON.stringify(assertion.expected)) return null;
            return {
                scenarioId,
                assertionKind: "alert-condition-fired-at-bar",
                message: `alert-condition-fired-at-bar: expected ${JSON.stringify(assertion.expected)}, actual ${JSON.stringify(actual)}`,
            };
        }
        case "drawing-hash": {
            const { hash, count } = hashDrawingSeries(run.drawings, assertion.handleId);
            if (hash === assertion.sha256) return null;
            const label = assertion.handleId ?? "<all>";
            return {
                scenarioId,
                assertionKind: "drawing-hash",
                message: `drawing-hash[${label}]: expected ${assertion.sha256}, actual ${hash} (${count} emissions)`,
            };
        }
    }
}

async function pushRunnerEvent(
    runner: RunnerWithPush,
    event:
        | { readonly kind: "close"; readonly bar: Bar; readonly streamKey?: string }
        | { readonly kind: "tick"; readonly bar: Bar; readonly streamKey?: string },
): Promise<void> {
    await runner.push(event);
}

async function loadCompiledModule(
    compiled: CompiledScript,
    scenarioId: string,
): Promise<CompiledScriptObject> {
    await mkdir(CACHE_DIR, { recursive: true });
    const suffix = randomBytes(8).toString("hex");
    const tmpPath = resolvePath(CACHE_DIR, `${scenarioId}-${suffix}.mjs`);
    await writeFile(tmpPath, compiled.moduleSource, "utf8");
    try {
        const url = pathToFileURL(tmpPath).href;
        const mod = (await import(/* @vite-ignore */ url)) as {
            readonly default: CompiledScriptObject;
        };
        return Object.freeze({
            ...mod.default,
            manifest: compiled.manifest,
        });
    } finally {
        await rm(tmpPath, { force: true });
    }
}

async function resolveSource(scenario: Scenario): Promise<{
    readonly source: string;
    readonly sourcePath: string;
}> {
    const hasScriptPath = scenario.scriptPath !== undefined;
    const hasInlineSource = scenario.inlineSource !== undefined;
    if (hasScriptPath && hasInlineSource) {
        throw new Error(`Scenario "${scenario.id}" cannot define both scriptPath and inlineSource`);
    }
    if (scenario.inlineSource !== undefined) {
        return {
            source: scenario.inlineSource,
            sourcePath: `<inline:${scenario.id}>.chart.ts`,
        };
    }
    if (scenario.scriptPath !== undefined) {
        const absScriptPath = resolveScriptPath(scenario.scriptPath);
        const source = await readFile(absScriptPath, "utf8");
        return { source, sourcePath: scenario.scriptPath };
    }
    throw new Error(`Scenario "${scenario.id}" must define either scriptPath or inlineSource`);
}

async function runOne(
    adapter: Adapter,
    scenario: Scenario,
    candles: ReadonlyArray<Bar>,
    compileFn: typeof defaultCompile,
): Promise<ReadonlyArray<ConformanceFailure>> {
    const { source, sourcePath } = await resolveSource(scenario);
    const compiled = await compileFn(source, {
        apiVersion: 1,
        sourcePath,
    });

    const scriptObj = await loadCompiledModule(compiled, scenario.id);

    const capabilities = mergeCapabilities(adapter.capabilities, scenario.capabilitiesOverride);
    const runner: RunnerWithPush = createScriptRunner({
        compiled: scriptObj,
        capabilities,
        ...(adapter.symInfo === undefined ? {} : { symInfo: adapter.symInfo }),
        ...(adapter.resolveInputs === undefined ? {} : { resolveInputs: adapter.resolveInputs }),
    });

    const plots: PlotEmission[] = [];
    const drawings: DrawingEmission[] = [];
    const alerts: AlertEmission[] = [];
    const alertConditions: AlertConditionEmission[] = [];
    const logs: LogEmission[] = [];
    const diagnostics: RuntimeDiagnostic[] = [];

    try {
        const scenarioCandles =
            scenario.candleLimit === undefined ? candles : candles.slice(0, scenario.candleLimit);
        const stream = scenario.eventStream ?? { kind: "close" };
        const secondaryIndexes = new Map<string, number>();
        let eventIndex = 0;
        for (const bar of scenarioCandles) {
            if (scenario.secondaryCandles !== undefined) {
                for (const [streamKey, secondaryBars] of Object.entries(
                    scenario.secondaryCandles,
                )) {
                    let secondaryIndex = secondaryIndexes.get(streamKey) ?? 0;
                    while (
                        secondaryIndex < secondaryBars.length &&
                        secondaryBars[secondaryIndex].time <= bar.time
                    ) {
                        const secondary = secondaryBars[secondaryIndex];
                        await pushRunnerEvent(runner, { kind: "close", bar: secondary, streamKey });
                        secondaryIndex += 1;
                    }
                    secondaryIndexes.set(streamKey, secondaryIndex);
                }
            }
            if (stream.kind === "initial-close-then-ticks" && eventIndex > 0) {
                await pushRunnerEvent(runner, { kind: "tick", bar });
            } else {
                await pushRunnerEvent(runner, { kind: "close", bar });
            }
            eventIndex += 1;
            const drained: RunnerEmissions = runner.drain();
            for (const p of drained.plots) plots.push(p);
            for (const d of drained.drawings) drawings.push(d);
            for (const a of drained.alerts) alerts.push(a);
            for (const a of drained.alertConditions) alertConditions.push(a);
            for (const log of drained.logs) logs.push(log);
            for (const d of drained.diagnostics) diagnostics.push(d);
        }
    } finally {
        await runner.dispose();
    }

    const run: BufferedRun = { plots, drawings, alerts, alertConditions, logs, diagnostics };
    const failures: ConformanceFailure[] = [];
    for (const assertion of scenario.assertions) {
        const failure = evalAssertion(scenario.id, run, assertion);
        if (failure !== null) failures.push(failure);
    }
    return failures;
}

let cachedDefaultBars: GoldenBars | null = null;

async function loadDefaultGoldenBars(): Promise<GoldenBars> {
    if (cachedDefaultBars !== null) return cachedDefaultBars;
    const raw = await readFile(GOLDEN_BARS_PATH, "utf8");
    const parsed = JSON.parse(raw) as ReadonlyArray<Bar>;
    cachedDefaultBars = Object.freeze(parsed.slice());
    return cachedDefaultBars;
}

/**
 * Drive every Phase-1 conformance scenario against `adapter` and
 * return a frozen {@link ConformanceReport}. The runner compiles each
 * scenario's script via `@invinite-org/chartlang-compiler`, evaluates
 * it through `createScriptRunner` against the supplied (or default
 * 10 000-bar `goldenBars.json`) candle stream, buffers every drained
 * emission, and evaluates each assertion in order.
 *
 * Scenarios run sequentially — the suite is I/O bound (compile +
 * tmp-file import) so parallelism wouldn't help and serial output
 * keeps the failure messages readable.
 *
 * The compiled bundle is written to
 * `packages/conformance/.cache/<scenarioId>-<rand>.mjs` for a single
 * `import(...)` because the bundle's `import { defineIndicator }
 * from "@invinite-org/chartlang-core"` cannot be resolved from a
 * `data:` URL. The tmp file is removed in a `finally` block.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { runConformanceSuite } from "@invinite-org/chartlang-conformance";
 *     import defaultAdapter from "chartlang-example-canvas2d-adapter";
 *
 *     const report = await runConformanceSuite(defaultAdapter);
 *     // report.passed >= 0
 *     void report;
 */
export async function runConformanceSuite(
    adapter: Adapter,
    opts?: RunConformanceSuiteOpts,
): Promise<ConformanceReport> {
    const scenarios = opts?.scenarios ?? (await loadBundledScenarios());
    const candles = opts?.candles ?? (await loadDefaultGoldenBars());
    const compileFn = opts?.compile ?? defaultCompile;

    const allFailures: ConformanceFailure[] = [];
    const scenarioResults: ScenarioResult[] = [];
    let scenariosPassed = 0;
    let scenariosFailed = 0;

    await mkdir(dirname(CACHE_DIR), { recursive: true });

    for (const scenario of scenarios) {
        const failures = await runOne(adapter, scenario, candles, compileFn);
        const frozenFailures = Object.freeze(failures.slice());
        if (failures.length === 0) {
            scenariosPassed += 1;
        } else {
            scenariosFailed += 1;
            for (const f of frozenFailures) allFailures.push(f);
        }
        scenarioResults.push(
            Object.freeze({
                id: scenario.id,
                title: scenario.title,
                status: frozenFailures.length === 0 ? "pass" : "fail",
                failures: frozenFailures,
            }),
        );
    }

    return Object.freeze({
        passed: scenariosPassed,
        failed: scenariosFailed,
        failures: Object.freeze(allFailures.slice()),
        scenarios: Object.freeze(scenarioResults.slice()),
    });
}

async function loadBundledScenarios(): Promise<ReadonlyArray<Scenario>> {
    const { ALL_SCENARIOS } = await import("./scenarios/index.js");
    return ALL_SCENARIOS;
}
