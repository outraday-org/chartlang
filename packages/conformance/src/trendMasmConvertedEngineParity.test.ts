// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { PHASE_5_PLOT_KINDS } from "@invinite-org/chartlang-adapter-kit";
import type {
    Capabilities,
    DrawingEmission,
    PlotEmission,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import { DRAWING_KINDS } from "@invinite-org/chartlang-core";
import type { CompiledScriptObject, PlotKind, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it, vi } from "vitest";

// Package imports resolve to the last-built adapter-kit dist in a source-only
// workspace run. Route runtime wire validation through the concurrent source
// validator so the additive Task 4 `columns` and shape-text contract is tested
// without requiring a forbidden package build.
vi.mock("@invinite-org/chartlang-adapter-kit", async (importOriginal) => {
    const original = await importOriginal<typeof import("@invinite-org/chartlang-adapter-kit")>();
    const source = await import("../../adapter-kit/src/validation/validateEmission.js");
    return { ...original, validateEmission: source.validateEmission };
});

import { compile } from "../../compiler/src/api.js";
import { type ConvertOpts, convert } from "../../pine-converter/src/index.js";
import { createScriptRunner } from "../../runtime/src/createScriptRunner.js";
import { buildBundleFromModule, type CompiledModuleExport } from "../../runtime/src/loadBundle.js";
import {
    compareTrendMasmEngineParity,
    compareTrendMasmPresentationParity,
    loadTrendMasmParityOracle,
    type OracleLabel,
    type OraclePlotDefinition,
    type OraclePlotPoint,
    type TrendMasmBar,
    type TrendMasmExpectedRow,
    type TrendMasmParityOracle,
} from "./parityOracle.js";

const fixtureDir = resolve(import.meta.dirname, "../fixtures/tradingview-trend-masm");
const repositoryRoot = resolve(import.meta.dirname, "../../..");

const ALL_INPUT_KINDS = new Set([
    "int",
    "float",
    "bool",
    "string",
    "enum",
    "color",
    "source",
    "time",
    "price",
    "symbol",
    "interval",
    "session",
] as const);

const ALL_CAPABILITIES: Capabilities = {
    plots: new Set<PlotKind>([...PHASE_5_PLOT_KINDS, "columns"]),
    drawings: new Set(DRAWING_KINDS),
    alerts: new Set(["log", "toast", "webhook", "email", "sms", "push"]),
    alertConditions: true,
    logs: true,
    inputs: ALL_INPUT_KINDS,
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: true,
    multiSymbol: true,
    subPanes: 1,
    symInfoFields: new Set([
        "ticker",
        "type",
        "mintick",
        "currency",
        "basecurrency",
        "exchange",
        "timezone",
        "session",
    ]),
    maxDrawingsPerScript: {
        lines: 5_000,
        labels: 5_000,
        boxes: 5_000,
        polylines: 5_000,
        other: 5_000,
    },
    maxLookback: 5_000,
    maxTickHz: 10,
};

const TREND_INPUT_OVERRIDES = Object.freeze({
    ma1_slope_smooth: 3,
    ma3_slope_smooth: 3,
    ma1_dist_smooth: 10,
});

const MASM_INPUT_OVERRIDES = Object.freeze({
    trades_short: false,
    long_entry_cond1_ltadj_factor1: 0.5,
    long_entry_cond1_ltadj_factor2: 0.5,
});

type ExecutedScript = Readonly<{
    source: string;
    manifest: ScriptManifest;
    emissions: RunnerEmissions;
}>;

type ActualParity = Readonly<{
    rows: ReadonlyArray<TrendMasmExpectedRow>;
    presentation: TrendMasmParityOracle["presentation"];
}>;

function finiteOrNull(value: number | null): number | null {
    return value !== null && Number.isFinite(value) ? value : null;
}

function canonicalColor(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === "") return null;
    const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(value);
    if (rgba !== null) {
        const channels = rgba.slice(1, 4).map(Number);
        const alpha = Math.round(Number(rgba[4]) * 255);
        if (
            [...channels, alpha].every(
                (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255,
            )
        ) {
            return `#${[...channels, alpha]
                .map((channel) => channel.toString(16).padStart(2, "0"))
                .join("")}`.toUpperCase();
        }
    }
    if (!/^#[\dA-Fa-f]{6}(?:[\dA-Fa-f]{2})?$/.test(value)) return value;
    return `${value.toUpperCase()}${value.length === 7 ? "FF" : ""}`;
}

function compiledModuleUrl(source: string): string {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
}

async function executeCanonicalScript(args: {
    pinePath: string;
    sourcePath: string;
    bars: ReadonlyArray<TrendMasmBar>;
    convertOpts?: ConvertOpts;
    inputOverrides: Readonly<Record<string, unknown>>;
    externalSeriesFeeds?: Readonly<Record<string, { readonly values: ReadonlyArray<number> }>>;
}): Promise<ExecutedScript> {
    const pine = await readFile(resolve(repositoryRoot, args.pinePath), "utf8");
    const conversion = convert(pine, {
        barInterval: 86_400_000,
        barIndexOrigin: args.bars[0]?.time ?? 0,
        ...args.convertOpts,
    });
    expect(conversion.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual(
        [],
    );
    expect(conversion.output).not.toBeNull();
    if (conversion.output === null) throw new Error("Canonical Pine conversion returned null");
    const source = conversion.output;

    const compiled = await compile(source, {
        apiVersion: 1,
        sourcePath: args.sourcePath,
    });
    const moduleValue = (await import(
        /* @vite-ignore */ compiledModuleUrl(compiled.moduleSource)
    )) as CompiledModuleExport;
    const bundle = buildBundleFromModule(moduleValue);
    const primary: CompiledScriptObject = "primary" in bundle ? bundle.primary : bundle;
    const runner = createScriptRunner({
        compiled: bundle,
        capabilities: ALL_CAPABILITIES,
        inputOverrides: args.inputOverrides,
        externalSeriesFeeds: args.externalSeriesFeeds,
        symInfo: {
            ticker: "TQQQ",
            type: "stock",
            mintick: 0.01,
            currency: "USD",
            basecurrency: "USD",
            exchange: "NASDAQ",
            // The frozen independent evaluator uses UTC calendar boundaries.
            // Supplying UTC also keeps the runtime's documented DST fallback
            // diagnostic out of this numerical/presentation parity surface.
            timezone: "UTC",
            session: "regular",
        },
    });
    await runner.onHistory(args.bars.map((bar) => ({ ...bar, symbol: "TQQQ", interval: "1D" })));
    const emissions = runner.drain();
    await runner.dispose();
    return { source, manifest: primary.manifest, emissions };
}

function representativePlot(emissions: RunnerEmissions, slotId: string): PlotEmission {
    const emission = emissions.plots.find((candidate) => candidate.slotId === slotId);
    if (emission === undefined) throw new Error(`No runtime emission for plot slot ${slotId}`);
    return emission;
}

function representativeFill(emissions: RunnerEmissions): DrawingEmission {
    const emission = emissions.drawings.find(
        (candidate) => candidate.state.kind === "fill-between",
    );
    if (emission === undefined) throw new Error("No runtime fill-between emission");
    return emission;
}

function authoredLineWidth(source: string, emission: PlotEmission): number | null {
    const title = `title: ${JSON.stringify(emission.title)}`;
    const sourceLine = source
        .split("\n")
        .find(
            (candidate) =>
                (candidate.includes("plot(") || candidate.includes("hline(")) &&
                candidate.includes(title),
        );
    if (sourceLine?.includes("lineWidth:") !== true) return null;
    return "lineWidth" in emission.style ? emission.style.lineWidth : null;
}

function runtimePresentationStyle(emission: PlotEmission): {
    kind: string;
    style: string;
    glyph: string | null;
} {
    switch (emission.style.kind) {
        case "horizontal-line":
            return {
                kind: "hline",
                style: emission.style.lineStyle === "solid" ? "line" : emission.style.lineStyle,
                glyph: null,
            };
        case "bg-color":
            return { kind: "background", style: "background", glyph: null };
        case "marker":
            return { kind: "circles", style: "circles", glyph: null };
        case "shape":
            return {
                kind: "shape",
                style: emission.style.shape,
                glyph: emission.style.text ?? null,
            };
        case "character":
            return { kind: "character", style: "character", glyph: emission.style.char };
        default:
            return { kind: emission.style.kind, style: emission.style.kind, glyph: null };
    }
}

function buildPresentation(
    expectedDefinitions: ReadonlyArray<OraclePlotDefinition>,
    execution: ExecutedScript,
): ReadonlyArray<OraclePlotDefinition> {
    const declarations = execution.manifest.plots ?? [];
    let declarationIndex = 0;
    return expectedDefinitions.map((expectedDefinition, order) => {
        if (expectedDefinition.kind === "fill") {
            const fill = representativeFill(execution.emissions);
            if (fill.state.kind !== "fill-between") throw new Error("Expected fill-between state");
            return {
                name: expectedDefinition.name,
                title: "",
                kind: "fill",
                style: "fill",
                order,
                visible: true,
                lineWidth: null,
                glyph: null,
                textColor: null,
                semanticColor: canonicalColor(fill.state.style.fill),
            };
        }
        const declaration = declarations[declarationIndex];
        declarationIndex += 1;
        if (declaration === undefined) throw new Error(`Missing plot declaration at ${order}`);
        const emission = representativePlot(execution.emissions, declaration.slotId);
        const presentation = runtimePresentationStyle(emission);
        return {
            name: expectedDefinition.name,
            title: emission.title,
            kind: presentation.kind,
            style: presentation.style,
            order,
            visible: emission.visible !== false,
            lineWidth: authoredLineWidth(execution.source, emission),
            glyph: presentation.glyph,
            textColor:
                emission.style.kind === "shape" ? canonicalColor(emission.style.textColor) : null,
            semanticColor: presentation.kind === "hline" ? canonicalColor(emission.color) : null,
        };
    });
}

function emissionsBySlotAndBar(emissions: RunnerEmissions): ReadonlyMap<string, PlotEmission> {
    return new Map(
        emissions.plots.map((emission) => [`${emission.slotId}:${emission.bar}`, emission]),
    );
}

function declarationNames(
    definitions: ReadonlyArray<OraclePlotDefinition>,
    manifest: ScriptManifest,
): ReadonlyMap<string, OraclePlotDefinition> {
    const declarations = manifest.plots ?? [];
    const output = new Map<string, OraclePlotDefinition>();
    let declarationIndex = 0;
    for (const definition of definitions) {
        if (definition.kind === "fill") continue;
        const declaration = declarations[declarationIndex];
        declarationIndex += 1;
        if (declaration === undefined)
            throw new Error(`Missing declaration for ${definition.name}`);
        output.set(declaration.slotId, definition);
    }
    return output;
}

function pointFromEmission(
    emission: PlotEmission,
    definition: OraclePlotDefinition,
): OraclePlotPoint {
    return {
        value: finiteOrNull(emission.value),
        semanticColor: canonicalColor(emission.color),
        kind: definition.kind,
    };
}

function plotMapForBar(
    barIndex: number,
    definitions: ReadonlyArray<OraclePlotDefinition>,
    slots: ReadonlyMap<string, OraclePlotDefinition>,
    bySlotAndBar: ReadonlyMap<string, PlotEmission>,
): Readonly<Record<string, OraclePlotPoint>> {
    const output: Record<string, OraclePlotPoint> = {};
    for (const [slotId, definition] of slots) {
        if (definition.kind === "hline" || definition.kind === "background") continue;
        const emission = bySlotAndBar.get(`${slotId}:${barIndex}`);
        if (emission === undefined)
            throw new Error(`Missing ${definition.name} at bar ${barIndex}`);
        output[definition.name] = pointFromEmission(emission, definition);
    }
    const ordered: Record<string, OraclePlotPoint> = {};
    for (const definition of definitions) {
        if (output[definition.name] !== undefined)
            ordered[definition.name] = output[definition.name];
    }
    return ordered;
}

function barAnchorFromTime(time: number, bars: ReadonlyArray<TrendMasmBar>): number {
    const exact = bars.findIndex((bar) => bar.time === time);
    if (exact >= 0) return exact;
    for (let index = 1; index < bars.length; index += 1) {
        const previous = bars[index - 1];
        const current = bars[index];
        if (
            previous !== undefined &&
            current !== undefined &&
            time > previous.time &&
            time < current.time
        ) {
            return index - 1 + (time - previous.time) / (current.time - previous.time);
        }
    }
    return Number.NaN;
}

function labelsForBar(
    barIndex: number,
    bars: ReadonlyArray<TrendMasmBar>,
    drawingsByBar: ReadonlyMap<number, ReadonlyArray<DrawingEmission>>,
): ReadonlyArray<OracleLabel> {
    const labels: OracleLabel[] = [];
    for (const drawing of drawingsByBar.get(barIndex) ?? []) {
        if (drawing.state.kind !== "text") continue;
        const { anchor, body, style } = drawing.state;
        const id =
            body === "↑" ? "long-entry-c2" : anchor.price === -1.6 ? "long-exit" : "short-exit";
        labels.push({
            id,
            text: body,
            barAnchor: barAnchorFromTime(anchor.time, bars),
            valueAnchor: Number.isFinite(anchor.price) ? anchor.price : null,
            kind: `label.style_none/${style.size ?? "normal"}`,
            semanticColor: canonicalColor(style.color) ?? "",
            pane: drawing.pane === "overlay" || drawing.pane === undefined ? "overlay" : "script",
        });
    }
    return labels;
}

function backgroundForBar(
    barIndex: number,
    backgroundSlot: string,
    bySlotAndBar: ReadonlyMap<string, PlotEmission>,
): { active: boolean; semanticColor: string | null } {
    const emission = bySlotAndBar.get(`${backgroundSlot}:${barIndex}`);
    if (emission === undefined) throw new Error(`Missing background at bar ${barIndex}`);
    const rawColor = canonicalColor(emission.colorValue ?? emission.color);
    const active = rawColor !== null && !rawColor.endsWith("00");
    return { active, semanticColor: active ? rawColor : null };
}

function tradeTransitions(
    previous: "flat" | "long" | "short",
    current: "flat" | "long" | "short",
): { entries: ReadonlyArray<"long" | "short">; exits: ReadonlyArray<"long" | "short"> } {
    const exits = previous !== "flat" && previous !== current ? [previous] : [];
    const entries = current !== "flat" && previous !== current ? [current] : [];
    return { entries, exits };
}

async function executeActualParity(): Promise<ActualParity> {
    const oracle = await loadTrendMasmParityOracle(fixtureDir);
    const trend = await executeCanonicalScript({
        pinePath: "Trend_Wizard.md",
        sourcePath: "trend-wizard-full.chart.ts",
        bars: oracle.bars,
        inputOverrides: TREND_INPUT_OVERRIDES,
    });
    const trendPresentation = buildPresentation(oracle.presentation.trend, trend);
    const trendSlots = declarationNames(oracle.presentation.trend, trend.manifest);
    const trendEmissions = emissionsBySlotAndBar(trend.emissions);
    const trendRows = oracle.bars.map((_bar, barIndex) =>
        plotMapForBar(barIndex, oracle.presentation.trend, trendSlots, trendEmissions),
    );
    const trendLong = trendRows.map((plots) => plots["Tab Trend Long"]?.value ?? null);

    const masm = await executeCanonicalScript({
        pinePath: "MASM_Strat.md",
        sourcePath: "masm-strat-full.chart.ts",
        bars: oracle.bars,
        convertOpts: {
            externalSeriesInputs: [
                {
                    inputName: "lt_trend",
                    feedName: "trendInput",
                    title: "Trend Wizard v1.0: Tab Trend Long",
                },
            ],
        },
        inputOverrides: MASM_INPUT_OVERRIDES,
        externalSeriesFeeds: {
            trendInput: { values: trendLong.map((value) => value ?? Number.NaN) },
        },
    });
    expect(trend.emissions.diagnostics).toEqual([]);
    expect(masm.emissions.diagnostics).toEqual([]);
    expect(new Set(trend.emissions.plots.map((emission) => emission.pane))).not.toContain(
        "overlay",
    );
    expect(new Set(masm.emissions.plots.map((emission) => emission.pane))).not.toContain("overlay");

    const masmPresentation = buildPresentation(oracle.presentation.masm, masm);
    const masmSlots = declarationNames(oracle.presentation.masm, masm.manifest);
    const masmEmissions = emissionsBySlotAndBar(masm.emissions);
    const masmDrawingsByBar = new Map<number, DrawingEmission[]>();
    for (const drawing of masm.emissions.drawings) {
        const group = masmDrawingsByBar.get(drawing.bar) ?? [];
        group.push(drawing);
        masmDrawingsByBar.set(drawing.bar, group);
    }
    const backgroundEntry = [...masmSlots].find(
        ([, definition]) => definition.kind === "background",
    );
    if (backgroundEntry === undefined) throw new Error("MASM background declaration is absent");
    const backgroundSlot = backgroundEntry[0];
    let previousDirection: "flat" | "long" | "short" = "flat";
    const rows: TrendMasmExpectedRow[] = [];
    for (let barIndex = 0; barIndex < oracle.bars.length; barIndex += 1) {
        const bar = oracle.bars[barIndex];
        if (bar === undefined) throw new Error(`Missing bar ${barIndex}`);
        const trendPlots = trendRows[barIndex];
        if (trendPlots === undefined) throw new Error(`Missing Trend plots at ${barIndex}`);
        const masmPlots = plotMapForBar(
            barIndex,
            oracle.presentation.masm,
            masmSlots,
            masmEmissions,
        );
        const background = backgroundForBar(barIndex, backgroundSlot, masmEmissions);
        const direction =
            background.semanticColor === "#0DDA741F"
                ? "long"
                : background.semanticColor === "#FF52781F"
                  ? "short"
                  : "flat";
        const transitions = tradeTransitions(previousDirection, direction);
        previousDirection = direction;
        const histogram = masmPlots["MA Slope"];
        if (histogram === undefined) throw new Error(`Missing MASM histogram at ${barIndex}`);
        rows.push({
            time: bar.time,
            trend: {
                short: trendPlots["Tab Trend Short"]?.value ?? null,
                medium: trendPlots["Tab Trend Medium"]?.value ?? null,
                long: trendPlots["Tab Trend Long"]?.value ?? null,
                plots: trendPlots,
            },
            masm: {
                source: trendLong[barIndex] ?? null,
                histogram,
                direction,
                entries: transitions.entries,
                exits: transitions.exits,
                background,
                labels: labelsForBar(barIndex, oracle.bars, masmDrawingsByBar),
                plots: masmPlots,
            },
        });
    }
    return {
        rows,
        presentation: { trend: trendPresentation, masm: masmPresentation },
    };
}

let actualPromise: Promise<ActualParity> | undefined;

function actualParity(): Promise<ActualParity> {
    actualPromise ??= executeActualParity();
    return actualPromise;
}

describe("converted Trend/MASM full-engine visual parity", () => {
    it("matches every frozen runtime row and presentation descriptor", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const actual = await actualParity();
        expect(compareTrendMasmEngineParity(oracle, actual.rows)).toEqual({
            matches: true,
            firstDifference: null,
        });
        expect(compareTrendMasmPresentationParity(oracle, actual.presentation)).toEqual({
            matches: true,
            firstDifference: null,
        });
    }, 180_000);

    it("detects one-bar background, finite-white, glyph-style, and label-color mutations", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const actual = await actualParity();
        const backgroundIndex = actual.rows.findIndex((row) => row.masm.background.active);
        expect(backgroundIndex).toBeGreaterThanOrEqual(0);
        const backgroundRows = actual.rows.slice();
        const backgroundRow = backgroundRows[backgroundIndex];
        if (backgroundRow === undefined) throw new Error("Missing active background row");
        backgroundRows[backgroundIndex] = {
            ...backgroundRow,
            masm: {
                ...backgroundRow.masm,
                background: { active: false, semanticColor: null },
            },
        };
        expect(compareTrendMasmEngineParity(oracle, backgroundRows).firstDifference?.barIndex).toBe(
            backgroundIndex,
        );

        const whiteIndex = actual.rows.findIndex(
            (row) =>
                row.masm.plots["Consolidation Overlay Bars"]?.semanticColor === "#FFFFFFFF" &&
                row.masm.plots["Consolidation Overlay Bars"]?.value !== null,
        );
        expect(whiteIndex).toBeGreaterThanOrEqual(0);
        const whiteRows = actual.rows.slice();
        const whiteRow = whiteRows[whiteIndex];
        const whitePoint = whiteRow?.masm.plots["Consolidation Overlay Bars"];
        if (whiteRow === undefined || whitePoint === undefined) {
            throw new Error("Missing finite white consolidation bar");
        }
        whiteRows[whiteIndex] = {
            ...whiteRow,
            masm: {
                ...whiteRow.masm,
                plots: {
                    ...whiteRow.masm.plots,
                    "Consolidation Overlay Bars": { ...whitePoint, value: null },
                },
            },
        };
        expect(compareTrendMasmEngineParity(oracle, whiteRows).firstDifference?.barIndex).toBe(
            whiteIndex,
        );

        const mutatedPresentation = {
            ...actual.presentation,
            masm: actual.presentation.masm.map((definition) =>
                definition.name === "Stay Long C Cancel"
                    ? { ...definition, style: "circle" }
                    : definition,
            ),
        };
        expect(
            compareTrendMasmPresentationParity(oracle, mutatedPresentation).firstDifference?.field,
        ).toBe("presentation.masm[16].style");

        const labelIndex = actual.rows.findIndex((row) => row.masm.labels.length > 0);
        expect(labelIndex).toBeGreaterThanOrEqual(0);
        const labelRows = actual.rows.slice();
        const labelRow = labelRows[labelIndex];
        const label = labelRow?.masm.labels[0];
        if (labelRow === undefined || label === undefined) throw new Error("Missing MASM label");
        labelRows[labelIndex] = {
            ...labelRow,
            masm: {
                ...labelRow.masm,
                labels: [
                    { ...label, semanticColor: "#000000FF" },
                    ...labelRow.masm.labels.slice(1),
                ],
            },
        };
        expect(compareTrendMasmEngineParity(oracle, labelRows).firstDifference?.barIndex).toBe(
            labelIndex,
        );
    }, 180_000);
});
