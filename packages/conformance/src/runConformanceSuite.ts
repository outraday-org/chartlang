// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
    Adapter,
    AlertEmission,
    DiagnosticCode,
    PlotEmission,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { compile as defaultCompile, type CompiledScript } from "@invinite-org/chartlang-compiler";
import type { Bar, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { createScriptRunner } from "@invinite-org/chartlang-runtime";

import { GOLDEN_BARS_PATH, type GoldenBars } from "./fixtures/generateGoldenBars";

/**
 * A single conformance scenario. Pins a Phase-1 example script
 * (`scriptPath`, repo-root relative) against a frozen list of
 * assertions evaluated over the runner's drained emissions.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { Scenario } from "@invinite-org/chartlang-conformance";
 *     declare const s: Scenario;
 *     // s.id === "ema-cross"
 *     void s;
 */
export type Scenario = {
    readonly id: string;
    readonly title: string;
    readonly scriptPath: string;
    readonly intervalCount: number;
    readonly assertions: ReadonlyArray<ScenarioAssertion>;
};

/**
 * Assertion the runner evaluates against a scenario's buffered
 * emissions. The five variants cover plot-series hashing, alert
 * counting, alert-message substring search, diagnostic absence,
 * and diagnostic presence.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ScenarioAssertion } from "@invinite-org/chartlang-conformance";
 *     const a: ScenarioAssertion = { kind: "alert-count", count: 0 };
 *     void a;
 */
export type ScenarioAssertion =
    | { readonly kind: "plot-hash"; readonly slotId?: string; readonly sha256: string }
    | { readonly kind: "alert-count"; readonly count: number }
    | { readonly kind: "alert-message-contains"; readonly pattern: string; readonly min: number }
    | { readonly kind: "diagnostic-code-absent"; readonly code: DiagnosticCode }
    | { readonly kind: "diagnostic-code-present"; readonly code: DiagnosticCode };

/**
 * A single conformance failure entry. `message` carries enough
 * context for the developer to re-pin assertion values without
 * re-running the suite — it always contains both `expected` and
 * `actual` for hash and count comparisons.
 *
 * @since 0.1
 * @experimental
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
 * Aggregated outcome of one `runConformanceSuite` call. `passed`
 * counts scenarios in which every assertion succeeded; `failed`
 * counts scenarios with at least one failure; `failures` carries one
 * entry per failed assertion across all scenarios.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import type { ConformanceReport } from "@invinite-org/chartlang-conformance";
 *     const r: ConformanceReport = { passed: 3, failed: 0, failures: [] };
 *     void r;
 */
export type ConformanceReport = {
    readonly passed: number;
    readonly failed: number;
    readonly failures: ReadonlyArray<ConformanceFailure>;
};

/**
 * Optional injection seams for {@link runConformanceSuite}. `scenarios`
 * overrides the bundled Phase-1 set; `candles` overrides the bundled
 * golden bars (useful for fast unit tests); `compile` overrides the
 * default `compile` so tests can short-circuit esbuild.
 *
 * @since 0.1
 * @experimental
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
    readonly alerts: ReadonlyArray<AlertEmission>;
    readonly diagnostics: ReadonlyArray<RuntimeDiagnostic>;
};

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
    }
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
        return mod.default;
    } finally {
        await rm(tmpPath, { force: true });
    }
}

async function runOne(
    adapter: Adapter,
    scenario: Scenario,
    candles: ReadonlyArray<Bar>,
    compileFn: typeof defaultCompile,
): Promise<ReadonlyArray<ConformanceFailure>> {
    const absScriptPath = resolveScriptPath(scenario.scriptPath);
    const source = await readFile(absScriptPath, "utf8");
    const compiled = await compileFn(source, {
        apiVersion: 1,
        sourcePath: scenario.scriptPath,
    });

    const scriptObj = await loadCompiledModule(compiled, scenario.id);

    const runner = createScriptRunner({
        compiled: scriptObj,
        capabilities: adapter.capabilities,
    });

    const plots: PlotEmission[] = [];
    const alerts: AlertEmission[] = [];
    const diagnostics: RuntimeDiagnostic[] = [];

    try {
        for (const bar of candles) {
            await runner.onBarClose(bar);
            const drained: RunnerEmissions = runner.drain();
            for (const p of drained.plots) plots.push(p);
            for (const a of drained.alerts) alerts.push(a);
            for (const d of drained.diagnostics) diagnostics.push(d);
        }
    } finally {
        runner.dispose();
    }

    const run: BufferedRun = { plots, alerts, diagnostics };
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
 * @experimental
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
    let scenariosPassed = 0;
    let scenariosFailed = 0;

    await mkdir(dirname(CACHE_DIR), { recursive: true });

    for (const scenario of scenarios) {
        const failures = await runOne(adapter, scenario, candles, compileFn);
        if (failures.length === 0) {
            scenariosPassed += 1;
        } else {
            scenariosFailed += 1;
            for (const f of failures) allFailures.push(f);
        }
    }

    return Object.freeze({
        passed: scenariosPassed,
        failed: scenariosFailed,
        failures: Object.freeze(allFailures.slice()),
    });
}

async function loadBundledScenarios(): Promise<ReadonlyArray<Scenario>> {
    const { PHASE_1_SCENARIOS } = await import("./scenarios/index");
    return PHASE_1_SCENARIOS;
}
