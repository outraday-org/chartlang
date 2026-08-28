// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
    compareTrendMasmEngineParity,
    compareTrendMasmLiveFeedParity,
    compareTrendMasmPresentationParity,
    deriveMasmBackgroundIntervals,
    loadTrendMasmParityOracle,
    parityOracleSha256,
    TREND_MASM_REQUIRED_DECISION_DISTANCES,
    type TrendMasmBar,
    type TrendMasmExpectedRow,
    type TrendMasmParityOracle,
    validateTrendMasmParityOracle,
} from "./parityOracle.js";

const RAW = Object.freeze({
    trendPine: "//@version=6\nindicator('Trend Wizard v1.0')\n",
    masmPine: "//@version=5\nindicator('MASM Strat 2.3 LIVE')\n",
    providerExport: '[{"source":"massive"}]\n',
    evaluatorSource: "export function independentReference() { return 1; }\n",
});

function makeBar(barIndex: number): TrendMasmBar {
    const value = 100 + barIndex / 100;
    return {
        time: 1_500_000_000_000 + barIndex * 86_400_000,
        open: value,
        high: value + 1,
        low: value - 1,
        close: value + 0.5,
        volume: 1_000 + barIndex,
    };
}

function makeExpected(bar: TrendMasmBar, barIndex: number): TrendMasmExpectedRow {
    const trendLong = barIndex / 10;
    const active = barIndex >= 1 && barIndex <= 2;
    return {
        time: bar.time,
        trend: {
            short: trendLong / 3,
            medium: trendLong / 2,
            long: trendLong,
            plots: {
                "Tab Trend Short": {
                    value: trendLong / 3,
                    semanticColor: "trend-short",
                    kind: "line",
                },
                "Tab Trend Medium": {
                    value: trendLong / 2,
                    semanticColor: "trend-medium",
                    kind: "line",
                },
                "Tab Trend Long": {
                    value: trendLong,
                    semanticColor: "trend-long",
                    kind: "line",
                },
            },
        },
        masm: {
            source: trendLong,
            histogram: {
                value: trendLong / 5,
                semanticColor: active ? "up" : "consolidation",
                kind: "columns",
            },
            direction: active ? "long" : "flat",
            entries: barIndex === 1 ? ["long"] : [],
            exits: barIndex === 3 ? ["long"] : [],
            background: {
                active,
                semanticColor: active ? "long-active" : null,
            },
            labels:
                barIndex === 1
                    ? [
                          {
                              id: "entry-c2",
                              text: "↑",
                              barAnchor: bar.time,
                              valueAnchor: -1.9,
                              kind: "label",
                              semanticColor: "#0DDA74FF",
                              pane: "script",
                          },
                      ]
                    : [],
            plots: {
                "MA Slope": {
                    value: trendLong / 5,
                    semanticColor: active ? "up" : "consolidation",
                    kind: "columns",
                },
            },
        },
    };
}

function makeOracle(count = 3_000): TrendMasmParityOracle {
    const bars = Array.from({ length: count }, (_unused, barIndex) => makeBar(barIndex));
    const expected = bars.map(makeExpected);
    return {
        schemaVersion: 2,
        provenance: {
            owner: "TradeRational / chart owner",
            license: "MPL-2.0 and frozen provider data",
            captureMethod: "Pine-derived independent reference",
            generatedBy: "deterministic fixture compiler v1",
        },
        capture: {
            capturedAt: "2026-08-28T00:00:00.000Z",
            tradingViewBuild: "test-build",
            tradingViewChartUrl: "https://www.tradingview.com/chart/HNckvQvP/",
            symbol: "NASDAQ:TQQQ",
            exchange: "NASDAQ",
            interval: "1D",
            chartTimezone: "exchange",
            session: "regular",
            adjustment: "adjusted",
            extendedHours: null,
            extendedHoursEvidence: "No extended-hours control is exposed for this 1D chart",
            barsRequested: 3_000,
            fixtureStart: bars[0]?.time ?? -1,
            fixtureEnd: bars[bars.length - 1]?.time ?? -1,
            trendScriptVersion: "Trend Wizard v1.0",
            masmScriptVersion: "MASM Strat 2.3 LIVE",
        },
        provider: {
            name: "Massive",
            sourceTag: "massive",
            endpointContract: "/v2/aggs adjusted=true",
            retrievedThrough: "server-side read",
            adjusted: true,
            assetType: "us_stock",
            interval: "1d",
            symbol: "TQQQ",
            converted: false,
            displayCurrency: null,
            rawArtifact: "raw/massive-tqqq-1d-pages.json",
            rawPageCount: 3,
        },
        reference: {
            kind: "standalone-pine-translation",
            evaluatorArtifact: "raw/trendMasmPineReference.ts",
            evaluatorSource: "src/reference/trendMasmPineReference.ts",
            execution: "historical closed-bar",
            realtime: "not certified",
            imports: [],
            forbiddenDependencies: ["Chartlang runtime"],
        },
        inputs: {
            trend: {
                src_tframe: "",
                src_symbol_custom: "NASDAQ:QQQ",
                src_symbol_swtch: false,
            },
            masm: {
                startYear: 2019,
                startMonth: 1,
                startDay: 1,
                closeYear: 2027,
                closeMonth: 1,
                closeDay: 1,
                trades_long: true,
                trades_short: false,
                long_exit_cond2_swtch: false,
            },
            masmSource: { script: "Trend Wizard v1.0", output: "Tab Trend Long" },
        },
        tolerance: {
            name: "binary64-roundoff",
            absolute: 1e-12,
            relative: 1e-12,
            representation: "Pine and Chartlang use IEEE-754 binary64 numbers",
            minimumDecisionDistance: 1e-4,
        },
        presentation: {
            trend: [
                {
                    name: "Tab Trend Short",
                    title: "Tab Trend Short",
                    kind: "line",
                    style: "line",
                    order: 0,
                    visible: true,
                    lineWidth: 1,
                    glyph: null,
                    textColor: null,
                    semanticColor: null,
                },
                {
                    name: "Tab Trend Medium",
                    title: "Tab Trend Medium",
                    kind: "line",
                    style: "line",
                    order: 1,
                    visible: true,
                    lineWidth: 1,
                    glyph: null,
                    textColor: null,
                    semanticColor: null,
                },
                {
                    name: "Tab Trend Long",
                    title: "Tab Trend Long",
                    kind: "line",
                    style: "line",
                    order: 2,
                    visible: true,
                    lineWidth: 1,
                    glyph: null,
                    textColor: null,
                    semanticColor: null,
                },
            ],
            masm: [
                {
                    name: "MA Slope",
                    title: "MA Slope",
                    kind: "columns",
                    style: "columns",
                    order: 0,
                    visible: true,
                    lineWidth: 1,
                    glyph: null,
                    textColor: null,
                    semanticColor: null,
                },
            ],
        },
        thresholdDistances: Object.fromEntries(
            TREND_MASM_REQUIRED_DECISION_DISTANCES.map((distanceName) => [distanceName, 1e-4]),
        ),
        anchorChecks: { tradingViewDataWindow: { role: "rounded anchor" } },
        checksums: {
            barsSha256: parityOracleSha256(bars),
            expectedSha256: parityOracleSha256(expected),
            trendPineSha256: parityOracleSha256(RAW.trendPine),
            masmPineSha256: parityOracleSha256(RAW.masmPine),
            rawProviderSha256: parityOracleSha256(RAW.providerExport),
            evaluatorSha256: parityOracleSha256(RAW.evaluatorSource),
            settingsSha256: parityOracleSha256({
                trend: {
                    src_tframe: "",
                    src_symbol_custom: "NASDAQ:QQQ",
                    src_symbol_swtch: false,
                },
                masm: {
                    startYear: 2019,
                    startMonth: 1,
                    startDay: 1,
                    closeYear: 2027,
                    closeMonth: 1,
                    closeDay: 1,
                    trades_long: true,
                    trades_short: false,
                    long_exit_cond2_swtch: false,
                },
                masmSource: { script: "Trend Wizard v1.0", output: "Tab Trend Long" },
            }),
            presentationSha256: parityOracleSha256({
                trend: [
                    {
                        name: "Tab Trend Short",
                        title: "Tab Trend Short",
                        kind: "line",
                        style: "line",
                        order: 0,
                        visible: true,
                        lineWidth: 1,
                        glyph: null,
                        textColor: null,
                        semanticColor: null,
                    },
                    {
                        name: "Tab Trend Medium",
                        title: "Tab Trend Medium",
                        kind: "line",
                        style: "line",
                        order: 1,
                        visible: true,
                        lineWidth: 1,
                        glyph: null,
                        textColor: null,
                        semanticColor: null,
                    },
                    {
                        name: "Tab Trend Long",
                        title: "Tab Trend Long",
                        kind: "line",
                        style: "line",
                        order: 2,
                        visible: true,
                        lineWidth: 1,
                        glyph: null,
                        textColor: null,
                        semanticColor: null,
                    },
                ],
                masm: [
                    {
                        name: "MA Slope",
                        title: "MA Slope",
                        kind: "columns",
                        style: "columns",
                        order: 0,
                        visible: true,
                        lineWidth: 1,
                        glyph: null,
                        textColor: null,
                        semanticColor: null,
                    },
                ],
            }),
        },
        bars,
        expected,
    };
}

function replaceExpectedRow(
    oracle: TrendMasmParityOracle,
    barIndex: number,
    replacement: TrendMasmExpectedRow,
): ReadonlyArray<TrendMasmExpectedRow> {
    return oracle.expected.map((row, currentIndex) =>
        currentIndex === barIndex ? replacement : row,
    );
}

describe("Trend/MASM TradingView parity oracle", () => {
    it("loads the checked-in Pine-derived provider fixture", async () => {
        const oracle = await loadTrendMasmParityOracle();
        expect(oracle.schemaVersion).toBe(2);
        expect(oracle.provider).toMatchObject({
            name: "Massive",
            adjusted: true,
            symbol: "TQQQ",
            interval: "1d",
            rawPageCount: 3,
        });
        expect(oracle.bars).toHaveLength(3_000);
        expect(oracle.expected).toHaveLength(3_000);
    });

    it("fails closed when the frozen evaluator gains an import", () => {
        const oracle = makeOracle();
        expect(() =>
            validateTrendMasmParityOracle(oracle, {
                ...RAW,
                evaluatorSource: 'import "@invinite-org/chartlang-runtime";\n',
            }),
        ).toThrow("must not import");
    });

    it("accepts a complete, checksummed 3000-bar fixture", () => {
        const oracle = makeOracle();
        expect(() => validateTrendMasmParityOracle(oracle, RAW)).not.toThrow();
        expect(parityOracleSha256(oracle.bars)).toHaveLength(64);
        expect(() => parityOracleSha256(undefined)).toThrow("undefined oracle value");

        const firstRow = oracle.expected[0];
        const nullableExpected = replaceExpectedRow(oracle, 0, {
            ...firstRow,
            trend: {
                ...firstRow.trend,
                short: null,
                plots: {
                    ...firstRow.trend.plots,
                    "Tab Trend Short": {
                        ...firstRow.trend.plots["Tab Trend Short"],
                        value: null,
                        semanticColor: null,
                    },
                },
            },
        });
        const nullableOracle = {
            ...oracle,
            expected: nullableExpected,
            checksums: {
                ...oracle.checksums,
                expectedSha256: parityOracleSha256(nullableExpected),
            },
        };
        expect(() => validateTrendMasmParityOracle(nullableOracle, RAW)).not.toThrow();
    });

    it("loads and validates the shared on-disk fixture shape", async () => {
        const fixtureDir = await mkdtemp(join(tmpdir(), "trend-masm-oracle-"));
        try {
            const oracle = makeOracle();
            const rawDir = join(fixtureDir, "raw");
            await mkdir(rawDir);
            await Promise.all([
                writeFile(join(fixtureDir, "oracle.json"), JSON.stringify(oracle), "utf8"),
                writeFile(join(rawDir, "Trend_Wizard.pine"), RAW.trendPine, "utf8"),
                writeFile(join(rawDir, "MASM_Strat.pine"), RAW.masmPine, "utf8"),
                writeFile(join(rawDir, "massive-tqqq-1d-pages.json"), RAW.providerExport, "utf8"),
                writeFile(join(rawDir, "trendMasmPineReference.ts"), RAW.evaluatorSource, "utf8"),
            ]);
            await expect(loadTrendMasmParityOracle(fixtureDir)).resolves.toEqual(oracle);
        } finally {
            await rm(fixtureDir, { recursive: true, force: true });
        }
    });

    it("rejects missing provenance, metadata, inputs, lengths, timestamps, tolerances, and checksums", () => {
        const oracle = makeOracle();
        const captureWithoutBuild = { ...oracle.capture };
        Reflect.deleteProperty(captureWithoutBuild, "tradingViewBuild");
        const captureWithoutExtendedHours = { ...oracle.capture };
        Reflect.deleteProperty(captureWithoutExtendedHours, "extendedHours");
        const captureWithoutExtendedHoursEvidence = { ...oracle.capture };
        Reflect.deleteProperty(captureWithoutExtendedHoursEvidence, "extendedHoursEvidence");
        const distancesWithoutTrendCross = { ...oracle.thresholdDistances };
        Reflect.deleteProperty(distancesWithoutTrendCross, "trend-cross-ma1-ma2");
        const cases: ReadonlyArray<readonly [string, TrendMasmParityOracle]> = [
            ["schemaVersion", { ...oracle, schemaVersion: 1 }],
            ["provenance.owner", { ...oracle, provenance: { ...oracle.provenance, owner: "" } }],
            [
                "provider.endpointContract",
                { ...oracle, provider: { ...oracle.provider, endpointContract: "" } },
            ],
            [
                "reference.execution",
                { ...oracle, reference: { ...oracle.reference, execution: "" } },
            ],
            ["anchorChecks must not be empty", { ...oracle, anchorChecks: {} }],
            ["capture.symbol", { ...oracle, capture: { ...oracle.capture, symbol: "" } }],
            [
                "capture.symbol must be NASDAQ:TQQQ",
                { ...oracle, capture: { ...oracle.capture, symbol: "NASDAQ:AAPL" } },
            ],
            [
                "capture.interval must be 1D",
                { ...oracle, capture: { ...oracle.capture, interval: "5" } },
            ],
            ["capture.tradingViewBuild", { ...oracle, capture: captureWithoutBuild }],
            [
                "capture.extendedHours must be null",
                { ...oracle, capture: captureWithoutExtendedHours },
            ],
            [
                "capture.extendedHoursEvidence",
                { ...oracle, capture: captureWithoutExtendedHoursEvidence },
            ],
            [
                "capture.extendedHours must be null",
                { ...oracle, capture: { ...oracle.capture, extendedHours: false } },
            ],
            ["requested bars", { ...oracle, capture: { ...oracle.capture, barsRequested: 2_999 } }],
            ["requested bars", { ...oracle, capture: { ...oracle.capture, barsRequested: 3_001 } }],
            ["exactly 3000 bars", makeOracle(2_999)],
            ["exactly 3000 bars", makeOracle(3_001)],
            ["length mismatch", { ...oracle, expected: oracle.expected.slice(1) }],
            [
                "ascending",
                {
                    ...oracle,
                    bars: [
                        oracle.bars[0],
                        { ...oracle.bars[1], time: oracle.bars[0].time },
                        ...oracle.bars.slice(2),
                    ],
                    expected: [
                        oracle.expected[0],
                        { ...oracle.expected[1], time: oracle.expected[0].time },
                        ...oracle.expected.slice(2),
                    ],
                },
            ],
            [
                "output timestamp",
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, { ...oracle.expected[0], time: -1 }),
                },
            ],
            ["fixtureStart", { ...oracle, capture: { ...oracle.capture, fixtureStart: -1 } }],
            ["fixtureEnd", { ...oracle, capture: { ...oracle.capture, fixtureEnd: -1 } }],
            ["Trend input", { ...oracle, inputs: { ...oracle.inputs, trend: {} } }],
            [
                "must be false",
                {
                    ...oracle,
                    inputs: {
                        ...oracle.inputs,
                        trend: { ...oracle.inputs.trend, src_symbol_swtch: true },
                    },
                },
            ],
            ["MASM input", { ...oracle, inputs: { ...oracle.inputs, masm: {} } }],
            [
                "MASM source",
                {
                    ...oracle,
                    inputs: {
                        ...oracle.inputs,
                        masmSource: { ...oracle.inputs.masmSource, output: "Tab Trend Medium" },
                    },
                },
            ],
            [
                "inputs.masmSource.script",
                {
                    ...oracle,
                    inputs: {
                        ...oracle.inputs,
                        masmSource: { ...oracle.inputs.masmSource, script: "" },
                    },
                },
            ],
            [
                "must match the captured Trend script version",
                {
                    ...oracle,
                    inputs: {
                        ...oracle.inputs,
                        masmSource: { ...oracle.inputs.masmSource, script: "Other Trend" },
                    },
                },
            ],
            ["tolerance.name", { ...oracle, tolerance: { ...oracle.tolerance, name: "" } }],
            [
                "tolerance.representation",
                { ...oracle, tolerance: { ...oracle.tolerance, representation: "" } },
            ],
            ["non-negative", { ...oracle, tolerance: { ...oracle.tolerance, absolute: -1 } }],
            [
                "minimumDecisionDistance",
                { ...oracle, tolerance: { ...oracle.tolerance, minimumDecisionDistance: 1e-13 } },
            ],
            [
                "minimumDecisionDistance",
                { ...oracle, tolerance: { ...oracle.tolerance, relative: 1e-9 } },
            ],
            [
                "finite number",
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...oracle.expected[0],
                        trend: { ...oracle.expected[0].trend, short: Number.NaN },
                    }),
                },
            ],
            [
                "MASM source differs",
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...oracle.expected[0],
                        masm: { ...oracle.expected[0].masm, source: oracle.bars[0].close },
                    }),
                },
            ],
            [
                "Tab Trend Long",
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...oracle.expected[0],
                        trend: {
                            ...oracle.expected[0].trend,
                            plots: {
                                "Tab Trend Short":
                                    oracle.expected[0].trend.plots["Tab Trend Short"],
                                "Tab Trend Medium":
                                    oracle.expected[0].trend.plots["Tab Trend Medium"],
                            },
                        },
                    }),
                },
            ],
            ["barsSha256", { ...oracle, checksums: { ...oracle.checksums, barsSha256: "bad" } }],
            [
                "threshold distances are missing trend-cross-ma1-ma2",
                { ...oracle, thresholdDistances: distancesWithoutTrendCross },
            ],
        ];
        for (const [expectedMessage, invalid] of cases) {
            expect(() => validateTrendMasmParityOracle(invalid, RAW)).toThrow(expectedMessage);
        }
    });

    it("rejects malformed row payloads and silently omitted capture fields", () => {
        const oracle = makeOracle();
        const firstRow = oracle.expected[0];

        const inputsWithoutTrend = { ...oracle.inputs };
        Reflect.deleteProperty(inputsWithoutTrend, "trend");
        expect(() =>
            validateTrendMasmParityOracle({ ...oracle, inputs: inputsWithoutTrend }, RAW),
        ).toThrow("inputs.trend must be an object");

        expect(() =>
            validateTrendMasmParityOracle(
                { ...oracle, capture: { ...oracle.capture, capturedAt: "not-a-timestamp" } },
                RAW,
            ),
        ).toThrow("capturedAt must be a valid timestamp");

        const invalidDirectionMasm = { ...firstRow.masm };
        Reflect.set(invalidDirectionMasm, "direction", "sideways");
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        masm: invalidDirectionMasm,
                    }),
                },
                RAW,
            ),
        ).toThrow("direction is unsupported");

        const entriesNotArrayMasm = { ...firstRow.masm };
        Reflect.set(entriesNotArrayMasm, "entries", "long");
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        masm: entriesNotArrayMasm,
                    }),
                },
                RAW,
            ),
        ).toThrow("masm.entries must be an array");

        const unsupportedEntryMasm = { ...firstRow.masm };
        Reflect.set(unsupportedEntryMasm, "entries", ["hold"]);
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        masm: unsupportedEntryMasm,
                    }),
                },
                RAW,
            ),
        ).toThrow("unsupported event");

        const labelsNotArrayMasm = { ...firstRow.masm };
        Reflect.set(labelsNotArrayMasm, "labels", "entry");
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        masm: labelsNotArrayMasm,
                    }),
                },
                RAW,
            ),
        ).toThrow("masm.labels must be an array");

        const invalidBackgroundMasm = {
            ...firstRow.masm,
            background: { ...firstRow.masm.background },
        };
        Reflect.set(invalidBackgroundMasm.background, "active", "yes");
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        masm: invalidBackgroundMasm,
                    }),
                },
                RAW,
            ),
        ).toThrow("background.active must be a boolean");

        const invalidLabel = { ...oracle.expected[1].masm.labels[0] };
        Reflect.set(invalidLabel, "text", 1);
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 1, {
                        ...oracle.expected[1],
                        masm: { ...oracle.expected[1].masm, labels: [invalidLabel] },
                    }),
                },
                RAW,
            ),
        ).toThrow("text must be a string");

        const invalidLabelColor = { ...oracle.expected[1].masm.labels[0] };
        Reflect.set(invalidLabelColor, "semanticColor", "");
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 1, {
                        ...oracle.expected[1],
                        masm: {
                            ...oracle.expected[1].masm,
                            labels: [invalidLabelColor],
                        },
                    }),
                },
                RAW,
            ),
        ).toThrow("semanticColor");

        const invalidLabelPane = { ...oracle.expected[1].masm.labels[0] };
        Reflect.set(invalidLabelPane, "pane", "overlay");
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 1, {
                        ...oracle.expected[1],
                        masm: { ...oracle.expected[1].masm, labels: [invalidLabelPane] },
                    }),
                },
                RAW,
            ),
        ).toThrow("pane must be script");

        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        masm: { ...firstRow.masm, labels: [] },
                        trend: { ...firstRow.trend, plots: {} },
                    }),
                },
                RAW,
            ),
        ).toThrow("trend.plots must not be empty");

        const invalidTrendPlots = { ...firstRow.trend.plots };
        Reflect.set(invalidTrendPlots, "Tab Trend Short", 1);
        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 0, {
                        ...firstRow,
                        trend: { ...firstRow.trend, plots: invalidTrendPlots },
                    }),
                },
                RAW,
            ),
        ).toThrow("Tab Trend Short must be an object");

        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 1, {
                        ...oracle.expected[1],
                        trend: {
                            ...oracle.expected[1].trend,
                            plots: {
                                ...oracle.expected[1].trend.plots,
                                Extra: {
                                    value: 1,
                                    semanticColor: "extra",
                                    kind: "line",
                                },
                            },
                        },
                    }),
                },
                RAW,
            ),
        ).toThrow("Trend plot names changed");

        expect(() =>
            validateTrendMasmParityOracle(
                {
                    ...oracle,
                    expected: replaceExpectedRow(oracle, 1, {
                        ...oracle.expected[1],
                        masm: {
                            ...oracle.expected[1].masm,
                            plots: {
                                ...oracle.expected[1].masm.plots,
                                Extra: {
                                    value: 1,
                                    semanticColor: "extra",
                                    kind: "line",
                                },
                            },
                        },
                    }),
                },
                RAW,
            ),
        ).toThrow("MASM plot names changed");

        const presentationWithoutTitle = {
            ...oracle.presentation,
            trend: oracle.presentation.trend.map((definitionValue, definitionIndex) => {
                if (definitionIndex !== 0) return definitionValue;
                const missingTitle = { ...definitionValue };
                Reflect.deleteProperty(missingTitle, "title");
                return missingTitle;
            }),
        };
        expect(() =>
            validateTrendMasmParityOracle(
                { ...oracle, presentation: presentationWithoutTitle },
                RAW,
            ),
        ).toThrow("presentation.trend.Tab Trend Short.title");
    });

    it("reports the first exact one-bar background boundary mutation", () => {
        const oracle = makeOracle();
        const expectedRow = oracle.expected[1];
        const actual = replaceExpectedRow(oracle, 1, {
            ...expectedRow,
            masm: {
                ...expectedRow.masm,
                background: { active: false, semanticColor: null },
            },
        });
        expect(compareTrendMasmEngineParity(oracle, actual)).toEqual({
            matches: false,
            firstDifference: {
                layer: "engine",
                barIndex: 1,
                timestamp: expectedRow.time,
                field: "masm.background",
                expected: expectedRow.masm.background,
                actual: { active: false, semanticColor: null },
            },
        });
    });

    it("fails entry shifts and replacing MASM's Trend source with close", () => {
        const oracle = makeOracle();
        const entryRow = oracle.expected[1];
        const shiftedEntry = replaceExpectedRow(oracle, 1, {
            ...entryRow,
            masm: { ...entryRow.masm, entries: [] },
        });
        expect(compareTrendMasmEngineParity(oracle, shiftedEntry).firstDifference?.field).toBe(
            "masm.entries",
        );

        const closeSource = replaceExpectedRow(oracle, 0, {
            ...oracle.expected[0],
            masm: { ...oracle.expected[0].masm, source: oracle.bars[0].close },
        });
        expect(compareTrendMasmEngineParity(oracle, closeSource).firstDifference?.field).toBe(
            "masm.source",
        );
    });

    it("compares numeric values with named tolerance and availability exactly", () => {
        const oracle = makeOracle();
        const withinTolerance = replaceExpectedRow(oracle, 4, {
            ...oracle.expected[4],
            trend: { ...oracle.expected[4].trend, long: oracle.expected[4].trend.long + 1e-13 },
        });
        expect(compareTrendMasmEngineParity(oracle, withinTolerance).matches).toBe(true);

        const unavailable = replaceExpectedRow(oracle, 4, {
            ...oracle.expected[4],
            trend: { ...oracle.expected[4].trend, long: null },
        });
        expect(compareTrendMasmEngineParity(oracle, unavailable).firstDifference?.field).toBe(
            "trend.long",
        );

        const unavailableLabel = replaceExpectedRow(oracle, 1, {
            ...oracle.expected[1],
            masm: {
                ...oracle.expected[1].masm,
                labels: [{ ...oracle.expected[1].masm.labels[0], valueAnchor: Number.NaN }],
            },
        });
        expect(compareTrendMasmEngineParity(oracle, unavailableLabel).firstDifference?.field).toBe(
            "masm.labels",
        );
    });

    it("compares complete plot names, values, colors, and kinds", () => {
        const oracle = makeOracle();
        const row = oracle.expected[0];
        const missingPlot = replaceExpectedRow(oracle, 0, {
            ...row,
            trend: { ...row.trend, plots: {} },
        });
        expect(compareTrendMasmEngineParity(oracle, missingPlot).firstDifference?.field).toBe(
            "trend.plots.names",
        );

        const changedPlotValue = replaceExpectedRow(oracle, 0, {
            ...row,
            trend: {
                ...row.trend,
                plots: {
                    ...row.trend.plots,
                    "Tab Trend Long": {
                        ...row.trend.plots["Tab Trend Long"],
                        value: 1,
                    },
                },
            },
        });
        expect(compareTrendMasmEngineParity(oracle, changedPlotValue).firstDifference?.field).toBe(
            "trend.plots.Tab Trend Long.value",
        );

        const changedPlotColor = replaceExpectedRow(oracle, 0, {
            ...row,
            trend: {
                ...row.trend,
                plots: {
                    ...row.trend.plots,
                    "Tab Trend Long": {
                        ...row.trend.plots["Tab Trend Long"],
                        semanticColor: "wrong",
                    },
                },
            },
        });
        expect(compareTrendMasmEngineParity(oracle, changedPlotColor).firstDifference?.field).toBe(
            "trend.plots.Tab Trend Long.semanticColor",
        );

        const changedPlotKind = replaceExpectedRow(oracle, 0, {
            ...row,
            trend: {
                ...row.trend,
                plots: {
                    ...row.trend.plots,
                    "Tab Trend Long": {
                        ...row.trend.plots["Tab Trend Long"],
                        kind: "columns",
                    },
                },
            },
        });
        expect(compareTrendMasmEngineParity(oracle, changedPlotKind).firstDifference?.field).toBe(
            "trend.plots.Tab Trend Long.kind",
        );

        const changedKind = replaceExpectedRow(oracle, 0, {
            ...row,
            masm: {
                ...row.masm,
                histogram: { ...row.masm.histogram, kind: "line" },
            },
        });
        expect(compareTrendMasmEngineParity(oracle, changedKind).firstDifference?.field).toBe(
            "masm.histogram.kind",
        );
    });

    it("compares presentation titles, order, visibility, styles, glyphs, and constant colors exactly", () => {
        const oracle = makeOracle();
        expect(compareTrendMasmPresentationParity(oracle, oracle.presentation)).toEqual({
            matches: true,
            firstDifference: null,
        });

        const changedStyle = {
            ...oracle.presentation,
            masm: oracle.presentation.masm.map((definitionValue, definitionIndex) =>
                definitionIndex === 0
                    ? { ...definitionValue, style: "histogram" }
                    : definitionValue,
            ),
        };
        expect(
            compareTrendMasmPresentationParity(oracle, changedStyle).firstDifference,
        ).toMatchObject({
            field: "presentation.masm[0].style",
            timestamp: oracle.capture.fixtureStart,
        });

        const changedTitle = {
            ...oracle.presentation,
            masm: oracle.presentation.masm.map((definitionValue, definitionIndex) =>
                definitionIndex === 0
                    ? { ...definitionValue, title: "Different title" }
                    : definitionValue,
            ),
        };
        expect(
            compareTrendMasmPresentationParity(oracle, changedTitle).firstDifference?.field,
        ).toBe("presentation.masm[0].title");

        const changedConstantColor = {
            ...oracle.presentation,
            trend: oracle.presentation.trend.map((definitionValue, definitionIndex) =>
                definitionIndex === 0
                    ? { ...definitionValue, semanticColor: "wrong" }
                    : definitionValue,
            ),
        };
        expect(
            compareTrendMasmPresentationParity(oracle, changedConstantColor).firstDifference?.field,
        ).toBe("presentation.trend[0].semanticColor");

        const missingTrendPlot = {
            ...oracle.presentation,
            trend: oracle.presentation.trend.slice(1),
        };
        expect(
            compareTrendMasmPresentationParity(oracle, missingTrendPlot).firstDifference?.field,
        ).toBe("presentation.trend.length");
    });

    it("reports length and timestamp drift for engine and live-feed layers", () => {
        const oracle = makeOracle();
        expect(
            compareTrendMasmEngineParity(oracle, oracle.expected.slice(1)).firstDifference,
        ).toMatchObject({ layer: "engine", field: "length" });
        expect(
            compareTrendMasmEngineParity(oracle, [...oracle.expected, oracle.expected[0]])
                .firstDifference?.timestamp,
        ).toBe(-1);
        expect(
            compareTrendMasmLiveFeedParity(oracle, oracle.bars.slice(1)).firstDifference,
        ).toMatchObject({ layer: "live-feed", field: "length" });
        expect(
            compareTrendMasmLiveFeedParity(oracle, [...oracle.bars, oracle.bars[0]]).firstDifference
                ?.timestamp,
        ).toBe(-1);
        const changedTime = [{ ...oracle.bars[0], time: -1 }, ...oracle.bars.slice(1)];
        expect(compareTrendMasmLiveFeedParity(oracle, changedTime).firstDifference?.field).toBe(
            "bar.time",
        );
        const changedClose = [
            { ...oracle.bars[0], close: oracle.bars[0].close + 1 },
            ...oracle.bars.slice(1),
        ];
        expect(compareTrendMasmLiveFeedParity(oracle, changedClose).firstDifference?.field).toBe(
            "bar.close",
        );
        expect(compareTrendMasmLiveFeedParity(oracle, oracle.bars).matches).toBe(true);

        const engineTime = replaceExpectedRow(oracle, 0, {
            ...oracle.expected[0],
            time: -1,
        });
        expect(compareTrendMasmEngineParity(oracle, engineTime).firstDifference?.field).toBe(
            "time",
        );

        const histogram = replaceExpectedRow(oracle, 0, {
            ...oracle.expected[0],
            masm: {
                ...oracle.expected[0].masm,
                histogram: { ...oracle.expected[0].masm.histogram, value: 99 },
            },
        });
        expect(compareTrendMasmEngineParity(oracle, histogram).firstDifference?.field).toBe(
            "masm.histogram.value",
        );
    });

    it("derives exact background intervals and splits on semantic color", () => {
        const oracle = makeOracle();
        const rows = oracle.expected.slice(0, 4);
        expect(deriveMasmBackgroundIntervals(rows)).toEqual([
            {
                start: rows[1].time,
                end: rows[2].time,
                semanticColor: "long-active",
            },
        ]);
        const recolored = replaceExpectedRow(oracle, 2, {
            ...oracle.expected[2],
            masm: {
                ...oracle.expected[2].masm,
                background: { active: true, semanticColor: "short-active" },
            },
        }).slice(0, 4);
        expect(deriveMasmBackgroundIntervals(recolored)).toHaveLength(2);
        expect(deriveMasmBackgroundIntervals(rows.slice(1, 3))).toEqual([
            {
                start: rows[1].time,
                end: rows[2].time,
                semanticColor: "long-active",
            },
        ]);
        expect(deriveMasmBackgroundIntervals([])).toEqual([]);
    });
});
