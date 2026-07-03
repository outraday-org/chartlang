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
    ExternalSeriesFeedMap,
    LogEmission,
    PlotEmission,
    PlotOverride,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { type CompiledScript, compile as defaultCompile } from "@invinite-org/chartlang-compiler";
import type { Bar, CompiledScriptBundle, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";
import { buildBundleFromModule, createScriptRunner } from "@invinite-org/chartlang-runtime";
import type { CompiledModuleExport } from "@invinite-org/chartlang-runtime";

import { GOLDEN_BARS_PATH, type GoldenBars } from "./fixtures/generateGoldenBars.js";

/**
 * A secondary stream identified by its composite `(symbol, interval)` feed.
 * The harness derives the wire `streamKey` via the core `feedKey(symbol,
 * interval)` helper — never a hand-composed `"<symbol>@<interval>"` string —
 * so the conformance scenario and the runtime agree on the byte-for-byte key.
 * `symbol` is omitted for a chart-symbol higher-timeframe feed (which collapses
 * to the bare interval, `feedKey(undefined, "1D") === "1D"`); a different
 * symbol survives as `"<symbol>@<interval>"`. This is the multi-symbol sibling
 * of {@link Scenario.secondaryCandles} (the interval-keyed back-compat shape).
 *
 * @since 1.3
 * @stable
 * @example
 *     import type { SecondaryFeed } from "@invinite-org/chartlang-conformance";
 *     declare const bars: SecondaryFeed["bars"];
 *     const spy: SecondaryFeed = { symbol: "AMEX:SPY", interval: "1D", bars };
 *     void spy;
 */
export type SecondaryFeed = {
    readonly symbol?: string;
    readonly interval: string;
    readonly bars: ReadonlyArray<Bar>;
};

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
    /**
     * Extra `.chart.ts` source files written next to the inline
     * consumer's compile-time directory so its
     * `import "./producer.chart"` resolves through the compiler's
     * default file-walking producer resolver. Map keys are paths
     * relative to the consumer's tmp directory (`"./producer.chart.ts"`);
     * values are the source text. Phase-7 indicator-composition
     * cross-file scenarios use this. Only valid alongside
     * {@link Scenario.inlineSource}. `@since 0.7`.
     */
    readonly additionalSources?: Readonly<Record<string, string>>;
    readonly intervalCount: number;
    readonly capabilitiesOverride?: Partial<Capabilities>;
    readonly candleLimit?: number;
    readonly secondaryCandles?: Readonly<Record<string, ReadonlyArray<Bar>>>;
    /**
     * Secondary streams identified by their composite `(symbol, interval)`
     * feed. Each entry's wire `streamKey` is derived via `feedKey(symbol,
     * interval)`, so a multi-symbol scenario (e.g. SPY + QQQ at `"1D"`) drives
     * two distinct streams without hand-composing the key. Folded into the
     * same per-key feed iteration as {@link Scenario.secondaryCandles}; the two
     * fields may be combined (their keys must not collide). `@since 1.3`.
     */
    readonly secondaryFeeds?: ReadonlyArray<SecondaryFeed>;
    readonly eventStream?: ScenarioEventStream;
    /**
     * Mount-time plot overrides, keyed by ordinal index into the compiled
     * `manifest.plots` so the scenario survives `slotId`-format changes —
     * the runner resolves each `slotIndex` to its real `slotId` from the
     * compiled manifest and passes the map to `createScriptRunner`. Only
     * valid against the primary script's plot slots. `@since 0.8`.
     */
    readonly plotOverrides?: ReadonlyArray<PlotSlotOverride>;
    /**
     * Mid-stream presentation-override updates applied via
     * `runner.setPlotOverrides(...)`. Each event's `overrides` REPLACES the
     * whole override map after the bar at `atBar` is pushed. The just-pushed
     * bar's emissions were already baked during `compute` and are returned
     * by the immediately following `drain` unchanged; the swap takes effect
     * starting with bar `atBar + 1`'s `compute`. Keyed by `manifest.plots`
     * ordinal like {@link Scenario.plotOverrides}. `@since 0.8`.
     */
    readonly overrideEvents?: ReadonlyArray<ScenarioOverrideEvent>;
    /**
     * Mount-time external-series feeds keyed by descriptor `name`. The runner
     * passes this complete map to `createScriptRunner`; unknown keys are
     * ignored by runtime input resolution, and missing descriptor feeds read
     * as `NaN`. `@since 1.9`.
     */
    readonly externalSeriesFeeds?: ExternalSeriesFeedMap;
    /**
     * Mid-stream external-series feed replacements applied via
     * `runner.setExternalSeries(...)`. Each event's `feeds` REPLACES the
     * whole feed map after the bar at `atBar` is pushed. The just-pushed
     * bar's emissions were already baked during `compute`; the swap takes
     * effect starting with bar `atBar + 1`'s `compute`. `@since 1.9`.
     */
    readonly externalSeriesEvents?: ReadonlyArray<ScenarioExternalSeriesEvent>;
    readonly assertions: ReadonlyArray<ScenarioAssertion>;
};

/**
 * One plot override targeting a slot by its ordinal index into the
 * compiled `manifest.plots` array (source order). The runner resolves the
 * index to the real `slotId` at run time.
 *
 * @since 0.8
 * @stable
 * @example
 *     import type { PlotSlotOverride } from "@invinite-org/chartlang-conformance";
 *     const o: PlotSlotOverride = { slotIndex: 0, override: { visible: false } };
 *     void o;
 */
export type PlotSlotOverride = {
    readonly slotIndex: number;
    readonly override: PlotOverride;
};

/**
 * A mid-stream `setPlotOverrides` event. `overrides` is the full
 * replacement map (the runtime replaces, not merges) applied after the
 * bar at `atBar` is pushed and before it is drained.
 *
 * @since 0.8
 * @stable
 * @example
 *     import type { ScenarioOverrideEvent } from "@invinite-org/chartlang-conformance";
 *     const e: ScenarioOverrideEvent = {
 *         atBar: 3,
 *         overrides: [{ slotIndex: 0, override: { visible: true } }],
 *     };
 *     void e;
 */
export type ScenarioOverrideEvent = {
    readonly atBar: number;
    readonly overrides: ReadonlyArray<PlotSlotOverride>;
};

/**
 * A mid-stream `setExternalSeries` event. `feeds` is the full replacement map
 * applied after the bar at `atBar` is pushed and before it is drained.
 *
 * @since 1.9
 * @stable
 * @example
 *     import type { ScenarioExternalSeriesEvent } from "@invinite-org/chartlang-conformance";
 *     const e: ScenarioExternalSeriesEvent = {
 *         atBar: 3,
 *         feeds: { other: { values: [1, 2, 3] } },
 *     };
 *     void e;
 */
export type ScenarioExternalSeriesEvent = {
    readonly atBar: number;
    readonly feeds: ExternalSeriesFeedMap;
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
 * emissions. The variants cover plot-series hashing, single
 * override-baked plot-field inspection, alert counting,
 * alert-message substring search, diagnostic absence, diagnostic
 * presence, and (Phase 3) drawing-series hashing.
 *
 * The `drawing-hash` variant pins SHA-256 over JSON-stringified
 * `{ handleId, kind, op, state, bar }` tuples in emission order
 * (filtered by `handleId` if supplied). Re-pinning workflow
 * mirrors `plot-hash`: copy the `actual` hash from the failure
 * message into the scenario's pinned value.
 *
 * The `plot-field` variant inspects a single override-baked or
 * presentation field (`visible` / `color` / `style.lineWidth` /
 * `xShift` / `z` / `colorValue`) on the emission for a `(slotIndex, bar)` pair —
 * `slotIndex` is the ordinal into the compiled `manifest.plots`. It
 * exists because `plot-hash` deliberately hashes only `{ bar, value }`
 * and cannot see presentation fields. `expected: undefined` asserts an
 * omitted field (e.g. a visible plot carries no `visible` flag; a
 * no-offset plot carries no `xShift`; a no-`z`/`z:0` plot carries no
 * `z`). `xShift` is the bidirectional display shift in bars (`+n` right
 * / future, `−n` left / past) the runtime threads from a plotted offset
 * `ta.*` series. `z` is the presentation-only render-order key the
 * runtime threads from `plot(value, { z })`, omitted from the wire when
 * `0` for byte-identity. `colorValue` is the per-bar dynamic-color channel
 * the runtime threads from `bgcolor`/`barcolor` (and value-plot) per-bar
 * color expressions; it is excluded from the `plot-hash` tuple, so a
 * `plot-field: colorValue` assertion pins the per-bar color while the
 * numeric hash stays byte-identical. `@since 0.8` (`z`: `@since 1.4`;
 * `colorValue`: `@since 1.5`).
 *
 * The `all-plots-on-pane` variant asserts every emitted
 * `PlotEmission.pane` equals a single expected pane key — it pins the
 * post-`subpane-rendering` routing contract (e.g. an `overlay: false`
 * script emits every plot + hline on `script:<sanitised-name>`). The
 * failure message reports the expected key plus the first divergent
 * emission's `slotId` / `pane`. `@since 0.9`.
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
    | {
          readonly kind: "plot-field";
          readonly slotIndex: number;
          readonly bar: number;
          readonly field: "visible" | "color" | "lineWidth" | "xShift" | "z" | "colorValue";
          readonly expected: string | number | boolean | undefined;
      }
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
      }
    /** @since 0.9 */
    | { readonly kind: "all-plots-on-pane"; readonly pane: string };

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
    /** Slot ids from the compiled `manifest.plots`, in source order. */
    readonly plotSlotIds: ReadonlyArray<string>;
};

type RunnerWithPush = ReturnType<typeof createScriptRunner>;

function mergeCapabilities(
    base: Capabilities,
    override: Partial<Capabilities> | undefined,
): Capabilities {
    return override === undefined ? base : Object.freeze({ ...base, ...override });
}

/**
 * Convert an ordinal-keyed override list into the `Record<slotId,
 * PlotOverride>` the runtime expects, resolving each `slotIndex` to its
 * real `slotId` from the compiled `manifest.plots`. An out-of-range
 * `slotIndex` resolves to no entry — the harness stays robust when driven
 * with a stubbed compiler that emits no `manifest.plots`; a genuinely
 * mis-authored override surfaces loudly as a failing `plot-field`
 * assertion instead.
 */
function resolveOverrideMap(
    overrides: ReadonlyArray<PlotSlotOverride>,
    plotSlotIds: ReadonlyArray<string>,
): Record<string, PlotOverride> {
    const map: Record<string, PlotOverride> = {};
    for (const { slotIndex, override } of overrides) {
        const slotId = plotSlotIds[slotIndex];
        if (slotId !== undefined) map[slotId] = override;
    }
    return map;
}

type ResolvedSecondaryStream = {
    readonly streamKey: string;
    readonly bars: ReadonlyArray<Bar>;
};

/**
 * Flatten a scenario's secondary streams into `streamKey → bars` rows. The
 * interval-keyed `secondaryCandles` carries its bare key through unchanged
 * (back-compat); each `secondaryFeeds` entry derives its composite key via the
 * core `feedKey(symbol, interval)` helper so it matches the runtime's stream
 * key byte-for-byte. The two sources are concatenated; an author colliding
 * keys across both surfaces gets two same-key rows (harmless — the runtime
 * routes both to the one stream the manifest registered).
 */
function resolveSecondaryStreams(scenario: Scenario): ReadonlyArray<ResolvedSecondaryStream> {
    const streams: ResolvedSecondaryStream[] = [];
    if (scenario.secondaryCandles !== undefined) {
        for (const [streamKey, bars] of Object.entries(scenario.secondaryCandles)) {
            streams.push({ streamKey, bars });
        }
    }
    if (scenario.secondaryFeeds !== undefined) {
        for (const feed of scenario.secondaryFeeds) {
            streams.push({ streamKey: feedKey(feed.symbol, feed.interval), bars: feed.bars });
        }
    }
    return streams;
}

const PACKAGE_DIR = resolvePath(fileURLToPath(import.meta.url), "../..");
const REPO_ROOT = resolvePath(PACKAGE_DIR, "../..");
const CACHE_DIR = resolvePath(PACKAGE_DIR, ".cache");

function resolveScriptPath(scriptPath: string): string {
    return isAbsolute(scriptPath) ? scriptPath : resolvePath(REPO_ROOT, scriptPath);
}

function readLineWidth(emission: PlotEmission): number | undefined {
    const style: Readonly<Record<string, unknown>> = emission.style;
    return typeof style.lineWidth === "number" ? style.lineWidth : undefined;
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
        case "plot-field": {
            const slotId = run.plotSlotIds[assertion.slotIndex];
            if (slotId === undefined) {
                return {
                    scenarioId,
                    assertionKind: "plot-field",
                    message: `plot-field[slot ${assertion.slotIndex}]: no plot slot at that ordinal in manifest.plots (${run.plotSlotIds.length} slots)`,
                };
            }
            const emission = run.plots.find((p) => p.slotId === slotId && p.bar === assertion.bar);
            if (emission === undefined) {
                return {
                    scenarioId,
                    assertionKind: "plot-field",
                    message: `plot-field[${slotId}@bar ${assertion.bar}]: no plot emission for that slot and bar`,
                };
            }
            let actual: string | number | boolean | undefined;
            switch (assertion.field) {
                case "lineWidth":
                    actual = readLineWidth(emission);
                    break;
                case "color":
                    actual = emission.color ?? undefined;
                    break;
                case "xShift":
                    actual = emission.xShift;
                    break;
                case "z":
                    actual = emission.z;
                    break;
                case "colorValue":
                    // The per-bar dynamic-color channel. `expected: undefined`
                    // asserts an omitted field (a static-color emission carries
                    // no `colorValue`); a string asserts the per-bar color. The
                    // explicit `null` gap reads back as `null`.
                    actual = emission.colorValue ?? undefined;
                    break;
                default:
                    actual = emission.visible;
                    break;
            }
            if (actual === assertion.expected) return null;
            return {
                scenarioId,
                assertionKind: "plot-field",
                message: `plot-field[${slotId}@bar ${assertion.bar}].${assertion.field}: expected ${String(assertion.expected)}, actual ${String(actual)}`,
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
        case "all-plots-on-pane": {
            if (run.plots.length === 0) {
                return {
                    scenarioId,
                    assertionKind: "all-plots-on-pane",
                    message: `all-plots-on-pane: expected every plot.pane === "${assertion.pane}", but no plots were emitted (nothing to assert against)`,
                };
            }
            const wrong = run.plots.filter((p) => p.pane !== assertion.pane);
            if (wrong.length === 0) return null;
            const first = wrong[0];
            return {
                scenarioId,
                assertionKind: "all-plots-on-pane",
                message: `all-plots-on-pane: expected every plot.pane === "${assertion.pane}", got ${wrong.length} divergent (first divergent slotId=${first.slotId}, pane="${first.pane}")`,
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

async function loadCompiledModuleAt(
    compiled: CompiledScript,
    tmpPath: string,
): Promise<CompiledScriptObject | CompiledScriptBundle> {
    await writeFile(tmpPath, compiled.moduleSource, "utf8");
    const url = pathToFileURL(tmpPath).href;
    const mod = (await import(/* @vite-ignore */ url)) as CompiledModuleExport;
    // The shared runtime loader merges the compiled `__manifest` sidecar over
    // `mod.default` (real compiler output always carries it after the
    // default-manifest rebind) and fails loud on a stub-without-sidecar.
    return buildBundleFromModule(mod);
}

type ResolvedSource = {
    readonly source: string;
    readonly sourcePath: string;
    /**
     * Per-scenario tmp directory the runner created so the compiler's
     * default file-walking producer resolver can pick up
     * {@link Scenario.additionalSources}. `null` when the scenario
     * does not need a writable workspace (every existing scenario).
     */
    readonly workspaceDir: string | null;
    /** Absolute path of the bundle's tmp `.mjs` file. */
    readonly bundlePath: string;
};

async function resolveSource(scenario: Scenario): Promise<ResolvedSource> {
    const hasScriptPath = scenario.scriptPath !== undefined;
    const hasInlineSource = scenario.inlineSource !== undefined;
    if (hasScriptPath && hasInlineSource) {
        throw new Error(`Scenario "${scenario.id}" cannot define both scriptPath and inlineSource`);
    }
    if (!hasScriptPath && !hasInlineSource) {
        throw new Error(`Scenario "${scenario.id}" must define either scriptPath or inlineSource`);
    }
    if (scenario.additionalSources !== undefined && !hasInlineSource) {
        throw new Error(`Scenario "${scenario.id}" additionalSources requires inlineSource`);
    }
    await mkdir(CACHE_DIR, { recursive: true });
    const suffix = randomBytes(8).toString("hex");
    // Multi-file workspace: write inline + additionalSources to disk so the
    // compiler's default producer resolver walks the directory tree.
    if (scenario.inlineSource !== undefined && scenario.additionalSources !== undefined) {
        const workspaceDir = resolvePath(CACHE_DIR, `${scenario.id}-${suffix}`);
        await mkdir(workspaceDir, { recursive: true });
        const inlinePath = resolvePath(workspaceDir, "inline.chart.ts");
        await writeFile(inlinePath, scenario.inlineSource, "utf8");
        for (const [relativePath, content] of Object.entries(scenario.additionalSources)) {
            const absPath = resolvePath(workspaceDir, relativePath);
            await mkdir(dirname(absPath), { recursive: true });
            await writeFile(absPath, content, "utf8");
        }
        return {
            source: scenario.inlineSource,
            sourcePath: inlinePath,
            workspaceDir,
            bundlePath: resolvePath(workspaceDir, "bundle.mjs"),
        };
    }
    if (scenario.inlineSource !== undefined) {
        return {
            source: scenario.inlineSource,
            sourcePath: `<inline:${scenario.id}>.chart.ts`,
            workspaceDir: null,
            bundlePath: resolvePath(CACHE_DIR, `${scenario.id}-${suffix}.mjs`),
        };
    }
    /* v8 ignore next 3 — guarded by mutual-exclusion check above */
    if (scenario.scriptPath === undefined) {
        throw new Error(`Scenario "${scenario.id}" must define either scriptPath or inlineSource`);
    }
    const absScriptPath = resolveScriptPath(scenario.scriptPath);
    const source = await readFile(absScriptPath, "utf8");
    return {
        source,
        sourcePath: scenario.scriptPath,
        workspaceDir: null,
        bundlePath: resolvePath(CACHE_DIR, `${scenario.id}-${suffix}.mjs`),
    };
}

async function runOne(
    adapter: Adapter,
    scenario: Scenario,
    candles: ReadonlyArray<Bar>,
    compileFn: typeof defaultCompile,
): Promise<ReadonlyArray<ConformanceFailure>> {
    const resolved = await resolveSource(scenario);
    let compiledScript: CompiledScriptObject | CompiledScriptBundle;
    let plotSlotIds: ReadonlyArray<string> = [];
    try {
        const compiled = await compileFn(resolved.source, {
            apiVersion: 1,
            sourcePath: resolved.sourcePath,
        });
        plotSlotIds = (compiled.manifest.plots ?? []).map((slot) => slot.slotId);
        compiledScript = await loadCompiledModuleAt(compiled, resolved.bundlePath);
    } catch (error) {
        if (resolved.workspaceDir !== null) {
            await rm(resolved.workspaceDir, { recursive: true, force: true });
        } else {
            await rm(resolved.bundlePath, { force: true });
        }
        throw error;
    }

    const capabilities = mergeCapabilities(adapter.capabilities, scenario.capabilitiesOverride);
    const runner: RunnerWithPush = createScriptRunner({
        compiled: compiledScript,
        capabilities,
        ...(adapter.symInfo === undefined ? {} : { symInfo: adapter.symInfo }),
        ...(adapter.resolveInputs === undefined ? {} : { resolveInputs: adapter.resolveInputs }),
        ...(scenario.plotOverrides === undefined
            ? {}
            : { plotOverrides: resolveOverrideMap(scenario.plotOverrides, plotSlotIds) }),
        ...(scenario.externalSeriesFeeds === undefined
            ? {}
            : { externalSeriesFeeds: scenario.externalSeriesFeeds }),
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
        // Unify the interval-keyed `secondaryCandles` (back-compat) and the
        // composite-feed `secondaryFeeds` into one `streamKey → bars` list.
        // `secondaryFeeds` derives its key via the core `feedKey` helper so the
        // wire key matches the runtime's composite key byte-for-byte.
        const secondaryStreams = resolveSecondaryStreams(scenario);
        const secondaryIndexes = new Map<string, number>();
        let eventIndex = 0;
        for (const bar of scenarioCandles) {
            for (const { streamKey, bars: secondaryBars } of secondaryStreams) {
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
            if (stream.kind === "initial-close-then-ticks" && eventIndex > 0) {
                await pushRunnerEvent(runner, { kind: "tick", bar });
            } else {
                await pushRunnerEvent(runner, { kind: "close", bar });
            }
            // Apply any live override event scheduled for the bar just pushed
            // (`eventIndex` is the 0-based bar ordinal). `compute` already
            // ran inside `pushRunnerEvent`, so this bar's emissions are
            // already baked with the PRE-swap map and the immediately
            // following `drain` returns them unchanged; the swap takes effect
            // starting with bar `eventIndex + 1`'s `compute`.
            // `setPlotOverrides` replaces the whole map — the runtime does
            // not merge.
            if (scenario.overrideEvents !== undefined) {
                for (const event of scenario.overrideEvents) {
                    if (event.atBar !== eventIndex) continue;
                    runner.setPlotOverrides(resolveOverrideMap(event.overrides, plotSlotIds));
                }
            }
            if (scenario.externalSeriesEvents !== undefined) {
                for (const event of scenario.externalSeriesEvents) {
                    if (event.atBar !== eventIndex) continue;
                    runner.setExternalSeries(event.feeds);
                }
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
        if (resolved.workspaceDir !== null) {
            await rm(resolved.workspaceDir, { recursive: true, force: true });
        } else {
            await rm(resolved.bundlePath, { force: true });
        }
    }

    const run: BufferedRun = {
        plots,
        drawings,
        alerts,
        alertConditions,
        logs,
        diagnostics,
        plotSlotIds,
    };
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
