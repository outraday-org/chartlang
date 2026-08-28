// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";

/**
 * JSON-safe numeric value used by the frozen oracle; `null` represents Pine `na`.
 * @since 1.7
 * @example
 *     const value: OracleNumber = null;
 *     void value;
 */
export type OracleNumber = number | null;

/**
 * Normalized MASM position direction captured for one bar.
 * @since 1.7
 * @example
 *     const direction: OracleDirection = "long";
 *     void direction;
 */
export type OracleDirection = "flat" | "long" | "short";

/**
 * Normalized entry or exit event emitted by the MASM reference.
 * @since 1.7
 * @example
 *     const event: OracleTradeEvent = "long";
 *     void event;
 */
export type OracleTradeEvent = "long" | "short";

/**
 * One adjusted daily OHLCV bar in the Trend/MASM parity fixture.
 * @since 1.7
 * @example
 *     const bar: TrendMasmBar = { time: 0, open: 1, high: 2, low: 0, close: 1, volume: 10 };
 *     void bar;
 */
export type TrendMasmBar = {
    readonly time: number;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number;
};

/**
 * Normalized value, color, and plot kind for one oracle plot point.
 * @since 1.7
 * @example
 *     const point: OraclePlotPoint = { value: 1, semanticColor: "#FFFFFFFF", kind: "line" };
 *     void point;
 */
export type OraclePlotPoint = {
    readonly value: OracleNumber;
    readonly semanticColor: string | null;
    readonly kind: string;
};

/**
 * Normalized label emitted by the standalone MASM reference.
 * @since 1.7
 * @example
 *     declare const label: OracleLabel;
 *     void label;
 */
export type OracleLabel = {
    readonly id: string;
    readonly text: string;
    readonly barAnchor: number;
    readonly valueAnchor: OracleNumber;
    readonly kind: string;
    readonly semanticColor: string;
    readonly pane: "script";
};

/**
 * All Trend and MASM oracle outputs associated with one source bar.
 * @since 1.7
 * @example
 *     declare const row: TrendMasmExpectedRow;
 *     void row;
 */
export type TrendMasmExpectedRow = {
    readonly time: number;
    readonly trend: {
        readonly short: OracleNumber;
        readonly medium: OracleNumber;
        readonly long: OracleNumber;
        readonly plots: Readonly<Record<string, OraclePlotPoint>>;
    };
    readonly masm: {
        /** Captured TradingView source input; always Trend `Tab Trend Long`. */
        readonly source: OracleNumber;
        readonly histogram: OraclePlotPoint;
        readonly direction: OracleDirection;
        readonly entries: ReadonlyArray<OracleTradeEvent>;
        readonly exits: ReadonlyArray<OracleTradeEvent>;
        readonly background: {
            readonly active: boolean;
            readonly semanticColor: string | null;
        };
        readonly labels: ReadonlyArray<OracleLabel>;
        readonly plots: Readonly<Record<string, OraclePlotPoint>>;
    };
};

/**
 * Numeric comparison policy and its nearest measured decision boundary.
 * @since 1.7
 * @example
 *     declare const tolerance: NumericTolerance;
 *     void tolerance;
 */
export type NumericTolerance = {
    readonly name: string;
    readonly absolute: number;
    readonly relative: number;
    readonly representation: string;
    readonly minimumDecisionDistance: number;
};

/**
 * Stable presentation descriptor for one Pine plot or shape channel.
 * @since 1.7
 * @example
 *     declare const definition: OraclePlotDefinition;
 *     void definition;
 */
export type OraclePlotDefinition = {
    /** Stable internal identity; unlike Pine titles, this must be unique. */
    readonly name: string;
    /** Exact user-visible Pine title. Pine permits duplicate titles. */
    readonly title: string;
    readonly kind: string;
    readonly style: string;
    readonly order: number;
    readonly visible: boolean;
    readonly lineWidth: number | null;
    readonly glyph: string | null;
    /** Independent `plotshape` text color; null for non-shape/no-text plots. */
    readonly textColor: string | null;
    /** Constant color for hlines/fills; null means the per-bar point owns color. */
    readonly semanticColor: string | null;
};

/**
 * TradingView chart, symbol, session, and fixture capture provenance.
 * @since 1.7
 * @example
 *     declare const capture: TrendMasmCaptureMetadata;
 *     void capture;
 */
export type TrendMasmCaptureMetadata = {
    readonly capturedAt: string;
    readonly tradingViewBuild: string;
    readonly tradingViewChartUrl: string;
    readonly symbol: string;
    readonly exchange: string;
    readonly interval: string;
    readonly chartTimezone: string;
    readonly session: string;
    readonly adjustment: string;
    /** The 1D TradingView chart exposes no extended-hours toggle. */
    readonly extendedHours: null;
    readonly extendedHoursEvidence: string;
    readonly barsRequested: number;
    readonly fixtureStart: number;
    readonly fixtureEnd: number;
    readonly trendScriptVersion: string;
    readonly masmScriptVersion: string;
};

/**
 * Validated frozen oracle containing provider bars, independent outputs, and checksums.
 * @since 1.7
 * @example
 *     declare const oracle: TrendMasmParityOracle;
 *     void oracle;
 */
export type TrendMasmParityOracle = {
    readonly schemaVersion: 2;
    readonly provenance: {
        readonly owner: string;
        readonly license: string;
        readonly captureMethod: string;
        readonly generatedBy: string;
    };
    readonly capture: TrendMasmCaptureMetadata;
    readonly provider: {
        readonly name: "Massive";
        readonly sourceTag: "massive";
        readonly endpointContract: string;
        readonly retrievedThrough: string;
        readonly adjusted: true;
        readonly assetType: "us_stock";
        readonly interval: "1d";
        readonly symbol: "TQQQ";
        readonly converted: false;
        readonly displayCurrency: null;
        readonly rawArtifact: "raw/massive-tqqq-1d-pages.json";
        readonly rawPageCount: 3;
    };
    readonly reference: {
        readonly kind: "standalone-pine-translation";
        readonly evaluatorArtifact: "raw/trendMasmPineReference.ts";
        readonly evaluatorSource: string;
        readonly execution: string;
        readonly realtime: string;
        readonly imports: readonly [];
        readonly forbiddenDependencies: ReadonlyArray<string>;
    };
    readonly inputs: {
        readonly trend: Readonly<Record<string, unknown>>;
        readonly masm: Readonly<Record<string, unknown>>;
        readonly masmSource: {
            readonly script: string;
            readonly output: "Tab Trend Long";
        };
    };
    readonly tolerance: NumericTolerance;
    readonly presentation: {
        readonly trend: ReadonlyArray<OraclePlotDefinition>;
        readonly masm: ReadonlyArray<OraclePlotDefinition>;
    };
    readonly thresholdDistances: Readonly<Record<string, number>>;
    readonly anchorChecks: Readonly<Record<string, unknown>>;
    readonly checksums: {
        readonly barsSha256: string;
        readonly expectedSha256: string;
        readonly trendPineSha256: string;
        readonly masmPineSha256: string;
        readonly rawProviderSha256: string;
        readonly evaluatorSha256: string;
        readonly settingsSha256: string;
        readonly presentationSha256: string;
    };
    readonly bars: ReadonlyArray<TrendMasmBar>;
    readonly expected: ReadonlyArray<TrendMasmExpectedRow>;
};

/**
 * Comparison layer recorded on the first observed parity difference.
 * @since 1.7
 * @example
 *     const layer: ParityLayer = "engine";
 *     void layer;
 */
export type ParityLayer = "engine" | "live-feed";

/**
 * First bar and field where actual output diverges from the frozen oracle.
 * @since 1.7
 * @example
 *     declare const difference: ParityFirstDifference;
 *     void difference;
 */
export type ParityFirstDifference = {
    readonly layer: ParityLayer;
    readonly barIndex: number;
    readonly timestamp: number;
    readonly field: string;
    readonly expected: unknown;
    readonly actual: unknown;
};

/**
 * Result of an engine, presentation, or live-feed parity comparison.
 * @since 1.7
 * @example
 *     const result: ParityComparison = { matches: true, firstDifference: null };
 *     void result;
 */
export type ParityComparison =
    | { readonly matches: true; readonly firstDifference: null }
    | { readonly matches: false; readonly firstDifference: ParityFirstDifference };

/**
 * Absolute path to the checked-in Trend/MASM parity fixture directory.
 * @since 1.7
 * @example
 *     const fixtureDir: string = TREND_MASM_PARITY_FIXTURE_DIR;
 *     void fixtureDir;
 */
export const TREND_MASM_PARITY_FIXTURE_DIR = resolvePath(
    dirname(fileURLToPath(import.meta.url)),
    "../fixtures/tradingview-trend-masm",
);

const REQUIRED_TREND_INPUTS: Readonly<Record<string, unknown>> = Object.freeze({
    src_tframe: "",
    src_symbol_custom: "NASDAQ:QQQ",
    src_symbol_swtch: false,
});

const REQUIRED_MASM_INPUTS: Readonly<Record<string, unknown>> = Object.freeze({
    startYear: 2019,
    startMonth: 1,
    startDay: 1,
    closeYear: 2027,
    closeMonth: 1,
    closeDay: 1,
    trades_long: true,
    trades_short: false,
    long_exit_cond2_swtch: false,
});

const REQUIRED_TREND_PLOTS = Object.freeze([
    "Tab Trend Short",
    "Tab Trend Medium",
    "Tab Trend Long",
]);
const ORACLE_DIRECTIONS: ReadonlySet<string> = new Set(["flat", "long", "short"]);
const ORACLE_TRADE_EVENTS: ReadonlySet<string> = new Set(["long", "short"]);
const REQUIRED_CAPTURE_SYMBOL = "NASDAQ:TQQQ";
const REQUIRED_CAPTURE_INTERVAL = "1D";
/**
 * Decision-boundary witnesses every regenerated oracle must provide.
 * @since 1.7
 * @example
 *     const firstDistance = TREND_MASM_REQUIRED_DECISION_DISTANCES[0];
 *     void firstDistance;
 */
export const TREND_MASM_REQUIRED_DECISION_DISTANCES = Object.freeze([
    "trend-cross-ma1-ma2",
    "trend-cross-ma2-ma3",
    "trend-cross-ma3-ma4",
    "trend-cross-ma4-ma5",
    "trend-cross-slope1-zero",
    "trend-cross-slope2-zero",
    "trend-cross-slope3-zero",
    "trend-cross-slope4-zero",
    "trend-cross-slope5-zero",
    "trend-slope-composite-color-zero",
    "trend-turnover-limit--0.1-zero",
    "trend-turnover-limit--0.1-one",
    "trend-turnover-limit--0.4-zero",
    "trend-turnover-limit--0.4-one",
    "trend-turnover-limit--0.05-zero",
    "trend-turnover-limit--0.05-one",
    "trend-cross-limit--0.08-zero",
    "trend-cross-limit--0.08-one",
    "trend-cross-limit--0.042-zero",
    "trend-cross-limit--0.042-one",
    "trend-cross-limit--0.0075-zero",
    "trend-cross-limit--0.0075-one",
    "trend-distance-limit-30--0.4-zero",
    "trend-distance-limit-30--0.4-upper",
    "trend-distance-limit-25--0.4-zero",
    "trend-distance-limit-25--0.4-upper",
    "trend-distance-limit-25--0.35-zero",
    "trend-distance-limit-25--0.35-upper",
    "trend-long-negative-scale-zero",
    "trend-short-output-limit-lower",
    "trend-short-output-limit-upper",
    "trend-medium-output-limit-lower",
    "trend-medium-output-limit-upper",
    "trend-long-output-limit-lower",
    "trend-long-output-limit-upper",
    "masm-consolidation-long-trend-zero",
    "masm-consolidation-slope-zero",
    "masm-consolidation-slope-upper",
    "masm-consolidation-slope-lower",
    "masm-consolidation-window-upper",
    "masm-consolidation-window-lower",
    "masm-consolidation-overlay-boundary",
    "entry-c1-ma-slope",
    "entry-c1-rsi-slope",
    "entry-c2-rsi-derivative",
    "entry-c2-rsi-slope-zero",
    "entry-c2-ma-slope-zero",
    "entry-c2-negative-ma-guard",
    "entry-c2-negative-branch",
    "entry-c2-rsi-negative-branch-cutoff",
    "entry-c2-prior-rsi-derivative-1",
    "entry-c2-prior-rsi-derivative-2",
    "entry-c2-prior-rsi-derivative-3",
    "exit-c1-ma-slope",
    "exit-c3-close-entry",
    "exit-c3-close-ma8",
    "masm-ma-derivative-color",
    "masm-rsi-slope-color",
    "masm-rsi-derivative-color",
]);

function assertNonEmpty(value: unknown, field: string): asserts value is string {
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Parity oracle is missing ${field}`);
    }
}

function assertFiniteNumber(value: unknown, field: string): asserts value is number {
    if (!Number.isFinite(value)) {
        throw new Error(`Parity oracle ${field} must be a finite number`);
    }
}

function assertOracleNumber(value: unknown, field: string): asserts value is OracleNumber {
    if (value !== null) assertFiniteNumber(value, field);
}

function assertRecord(
    value: unknown,
    field: string,
): asserts value is Readonly<Record<string, unknown>> {
    if (Object.prototype.toString.call(value) !== "[object Object]") {
        throw new Error(`Parity oracle ${field} must be an object`);
    }
}

function assertPlotPoint(value: unknown, field: string): asserts value is OraclePlotPoint {
    assertRecord(value, field);
    assertOracleNumber(value.value, `${field}.value`);
    if (value.semanticColor !== null) {
        assertNonEmpty(value.semanticColor, `${field}.semanticColor`);
    }
    assertNonEmpty(value.kind, `${field}.kind`);
}

function validatePlotMap(
    value: unknown,
    field: string,
    requiredNames: ReadonlyArray<string> = [],
): ReadonlyArray<string> {
    assertRecord(value, field);
    const names = Object.keys(value).sort();
    if (names.length === 0) throw new Error(`Parity oracle ${field} must not be empty`);
    for (const requiredName of requiredNames) {
        if (!(requiredName in value)) {
            throw new Error(`Parity oracle ${field} is missing ${requiredName}`);
        }
    }
    for (const name of names) assertPlotPoint(value[name], `${field}.${name}`);
    return names;
}

function validateTradeEvents(value: unknown, field: string): void {
    if (!Array.isArray(value)) throw new Error(`Parity oracle ${field} must be an array`);
    for (const event of value) {
        if (!ORACLE_TRADE_EVENTS.has(event)) {
            throw new Error(`Parity oracle ${field} contains an unsupported event`);
        }
    }
}

function validateLabels(value: unknown, field: string): void {
    if (!Array.isArray(value)) throw new Error(`Parity oracle ${field} must be an array`);
    for (let labelIndex = 0; labelIndex < value.length; labelIndex += 1) {
        const labelField = `${field}[${labelIndex}]`;
        const label = value[labelIndex];
        assertRecord(label, labelField);
        assertNonEmpty(label.id, `${labelField}.id`);
        if (typeof label.text !== "string") {
            throw new Error(`Parity oracle ${labelField}.text must be a string`);
        }
        assertFiniteNumber(label.barAnchor, `${labelField}.barAnchor`);
        assertOracleNumber(label.valueAnchor, `${labelField}.valueAnchor`);
        assertNonEmpty(label.kind, `${labelField}.kind`);
        assertNonEmpty(label.semanticColor, `${labelField}.semanticColor`);
        if (label.pane !== "script") {
            throw new Error(`Parity oracle ${labelField}.pane must be script`);
        }
    }
}

function validatePresentation(
    definitions: ReadonlyArray<OraclePlotDefinition>,
    field: string,
): ReadonlyMap<string, OraclePlotDefinition> {
    if (!Array.isArray(definitions) || definitions.length === 0) {
        throw new Error(`Parity oracle ${field} must not be empty`);
    }
    const byName = new Map<string, OraclePlotDefinition>();
    const orders = new Set<number>();
    for (const definitionValue of definitions) {
        assertNonEmpty(definitionValue.name, `${field}.name`);
        if (typeof definitionValue.title !== "string") {
            throw new Error(
                `Parity oracle ${field}.${definitionValue.name}.title must be a string`,
            );
        }
        assertNonEmpty(definitionValue.kind, `${field}.${definitionValue.name}.kind`);
        assertNonEmpty(definitionValue.style, `${field}.${definitionValue.name}.style`);
        if (!Number.isInteger(definitionValue.order) || definitionValue.order < 0) {
            throw new Error(`Parity oracle ${field}.${definitionValue.name}.order is invalid`);
        }
        if (typeof definitionValue.visible !== "boolean") {
            throw new Error(`Parity oracle ${field}.${definitionValue.name}.visible is invalid`);
        }
        if (
            definitionValue.lineWidth !== null &&
            (!Number.isInteger(definitionValue.lineWidth) || definitionValue.lineWidth <= 0)
        ) {
            throw new Error(`Parity oracle ${field}.${definitionValue.name}.lineWidth is invalid`);
        }
        if (definitionValue.glyph !== null && typeof definitionValue.glyph !== "string") {
            throw new Error(`Parity oracle ${field}.${definitionValue.name}.glyph is invalid`);
        }
        if (definitionValue.textColor !== null) {
            assertNonEmpty(definitionValue.textColor, `${field}.${definitionValue.name}.textColor`);
        }
        if (definitionValue.semanticColor !== null) {
            assertNonEmpty(
                definitionValue.semanticColor,
                `${field}.${definitionValue.name}.semanticColor`,
            );
        }
        if (byName.has(definitionValue.name) || orders.has(definitionValue.order)) {
            throw new Error(`Parity oracle ${field} names and orders must be unique`);
        }
        byName.set(definitionValue.name, definitionValue);
        orders.add(definitionValue.order);
    }
    return byName;
}

function oracleNumbersAreExactlyEqual(left: OracleNumber, right: OracleNumber): boolean {
    return left === right;
}

function numericMagnitude(value: OracleNumber): number {
    return value === null ? 0 : Math.abs(value);
}

function sha256(value: unknown): string {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (serialized === undefined) throw new Error("Cannot checksum an undefined oracle value");
    return createHash("sha256").update(serialized).digest("hex");
}

/**
 * Return the canonical SHA-256 used by parity fixture checksums.
 * @since 1.7
 * @example
 *     const checksum = parityOracleSha256({ value: 1 });
 *     void checksum;
 */
export function parityOracleSha256(value: unknown): string {
    return sha256(value);
}

function validateRequiredInputs(
    actual: Readonly<Record<string, unknown>>,
    required: Readonly<Record<string, unknown>>,
    owner: string,
): void {
    for (const [key, expected] of Object.entries(required)) {
        if (!(key in actual)) throw new Error(`Parity oracle is missing ${owner} input ${key}`);
        if (actual[key] !== expected) {
            throw new Error(
                `Parity oracle ${owner} input ${key} must be ${String(expected)}, got ${String(actual[key])}`,
            );
        }
    }
}

/**
 * Validate oracle structure, provenance, presentation, and every raw-artifact checksum.
 * @since 1.7
 * @example
 *     const fn: typeof validateTrendMasmParityOracle = validateTrendMasmParityOracle;
 *     void fn;
 */
export function validateTrendMasmParityOracle(
    oracle: TrendMasmParityOracle,
    raw: {
        readonly trendPine: string;
        readonly masmPine: string;
        readonly providerExport: string;
        readonly evaluatorSource: string;
    },
): void {
    if (oracle.schemaVersion !== 2) throw new Error("Unsupported parity oracle schemaVersion");
    assertNonEmpty(oracle.provenance.owner, "provenance.owner");
    assertNonEmpty(oracle.provenance.license, "provenance.license");
    assertNonEmpty(oracle.provenance.captureMethod, "provenance.captureMethod");
    assertNonEmpty(oracle.provenance.generatedBy, "provenance.generatedBy");
    for (const field of [
        "capturedAt",
        "tradingViewBuild",
        "tradingViewChartUrl",
        "symbol",
        "exchange",
        "interval",
        "chartTimezone",
        "session",
        "adjustment",
        "extendedHoursEvidence",
        "trendScriptVersion",
        "masmScriptVersion",
    ] as const) {
        assertNonEmpty(oracle.capture[field], `capture.${field}`);
    }
    if (!Number.isFinite(Date.parse(oracle.capture.capturedAt))) {
        throw new Error("Parity oracle capture.capturedAt must be a valid timestamp");
    }
    if (oracle.capture.symbol !== REQUIRED_CAPTURE_SYMBOL) {
        throw new Error(`Parity oracle capture.symbol must be ${REQUIRED_CAPTURE_SYMBOL}`);
    }
    if (oracle.capture.interval !== REQUIRED_CAPTURE_INTERVAL) {
        throw new Error(`Parity oracle capture.interval must be ${REQUIRED_CAPTURE_INTERVAL}`);
    }
    if (oracle.capture.extendedHours !== null) {
        throw new Error("Parity oracle capture.extendedHours must be null for the 1D chart");
    }
    assertFiniteNumber(oracle.capture.barsRequested, "capture.barsRequested");
    assertFiniteNumber(oracle.capture.fixtureStart, "capture.fixtureStart");
    assertFiniteNumber(oracle.capture.fixtureEnd, "capture.fixtureEnd");
    if (!Number.isInteger(oracle.capture.barsRequested) || oracle.capture.barsRequested !== 3_000) {
        throw new Error("Parity oracle must record exactly 3000 requested bars");
    }
    if (oracle.bars.length !== 3_000)
        throw new Error("Parity oracle must contain exactly 3000 bars");
    if (
        oracle.provider.name !== "Massive" ||
        oracle.provider.sourceTag !== "massive" ||
        oracle.provider.adjusted !== true ||
        oracle.provider.assetType !== "us_stock" ||
        oracle.provider.symbol !== "TQQQ" ||
        oracle.provider.interval !== "1d" ||
        oracle.provider.converted !== false ||
        oracle.provider.displayCurrency !== null ||
        oracle.provider.rawArtifact !== "raw/massive-tqqq-1d-pages.json" ||
        oracle.provider.rawPageCount !== 3
    ) {
        throw new Error(
            "Parity oracle provider metadata must identify the pinned adjusted Massive fixture",
        );
    }
    assertNonEmpty(oracle.provider.endpointContract, "provider.endpointContract");
    assertNonEmpty(oracle.provider.retrievedThrough, "provider.retrievedThrough");
    if (
        oracle.reference.kind !== "standalone-pine-translation" ||
        oracle.reference.evaluatorArtifact !== "raw/trendMasmPineReference.ts" ||
        oracle.reference.evaluatorSource !== "src/reference/trendMasmPineReference.ts" ||
        !Array.isArray(oracle.reference.imports) ||
        oracle.reference.imports.length !== 0
    ) {
        throw new Error("Parity oracle must identify the standalone zero-import evaluator");
    }
    assertNonEmpty(oracle.reference.execution, "reference.execution");
    assertNonEmpty(oracle.reference.realtime, "reference.realtime");
    if (
        !Array.isArray(oracle.reference.forbiddenDependencies) ||
        oracle.reference.forbiddenDependencies.length === 0
    ) {
        throw new Error("Parity oracle reference.forbiddenDependencies must not be empty");
    }
    for (const dependencyName of oracle.reference.forbiddenDependencies) {
        assertNonEmpty(dependencyName, "reference.forbiddenDependencies entry");
    }
    if (/^\s*import\b/m.test(raw.evaluatorSource) || /\brequire\s*\(/.test(raw.evaluatorSource)) {
        throw new Error("Parity oracle evaluator must not import runtime or shared code");
    }
    if (/chartlang-(?:runtime|compiler|pine-converter|adapter-kit)/i.test(raw.evaluatorSource)) {
        throw new Error("Parity oracle evaluator references a forbidden Chartlang package");
    }
    if (oracle.bars.length !== oracle.expected.length) {
        throw new Error(
            `Parity oracle bars/expected length mismatch: ${oracle.bars.length} versus ${oracle.expected.length}`,
        );
    }
    assertRecord(oracle.inputs.trend, "inputs.trend");
    assertRecord(oracle.inputs.masm, "inputs.masm");
    const trendPresentation = validatePresentation(oracle.presentation.trend, "presentation.trend");
    const masmPresentation = validatePresentation(oracle.presentation.masm, "presentation.masm");
    let previousTime = Number.NEGATIVE_INFINITY;
    let trendPlotNames: ReadonlyArray<string> | null = null;
    let masmPlotNames: ReadonlyArray<string> | null = null;
    let maximumExpectedMagnitude = 0;
    for (let barIndex = 0; barIndex < oracle.bars.length; barIndex += 1) {
        const bar = oracle.bars[barIndex];
        const output = oracle.expected[barIndex];
        for (const field of ["time", "open", "high", "low", "close", "volume"] as const) {
            assertFiniteNumber(bar[field], `bars[${barIndex}].${field}`);
        }
        if (bar.time <= previousTime) {
            throw new Error(
                `Parity oracle timestamps must be unique and ascending at bar ${barIndex}`,
            );
        }
        if (output.time !== bar.time) {
            throw new Error(`Parity oracle output timestamp mismatch at bar ${barIndex}`);
        }
        for (const field of ["short", "medium", "long"] as const) {
            const value = output.trend[field];
            assertOracleNumber(value, `expected[${barIndex}].trend.${field}`);
            maximumExpectedMagnitude = Math.max(maximumExpectedMagnitude, numericMagnitude(value));
        }
        const currentTrendPlotNames = validatePlotMap(
            output.trend.plots,
            `expected[${barIndex}].trend.plots`,
            REQUIRED_TREND_PLOTS,
        );
        if (trendPlotNames === null) trendPlotNames = currentTrendPlotNames;
        if (!isDeepStrictEqual(trendPlotNames, currentTrendPlotNames)) {
            throw new Error(`Parity oracle Trend plot names changed at bar ${barIndex}`);
        }
        for (const point of Object.values(output.trend.plots)) {
            maximumExpectedMagnitude = Math.max(
                maximumExpectedMagnitude,
                numericMagnitude(point.value),
            );
        }
        for (const [name, point] of Object.entries(output.trend.plots)) {
            if (trendPresentation.get(name)?.kind !== point.kind) {
                throw new Error(`Parity oracle Trend presentation mismatch for ${name}`);
            }
        }
        if (!oracleNumbersAreExactlyEqual(output.trend.long, output.masm.source)) {
            throw new Error(
                `Parity oracle MASM source differs from Tab Trend Long at bar ${barIndex}`,
            );
        }
        assertOracleNumber(output.masm.source, `expected[${barIndex}].masm.source`);
        maximumExpectedMagnitude = Math.max(
            maximumExpectedMagnitude,
            numericMagnitude(output.masm.source),
        );
        assertPlotPoint(output.masm.histogram, `expected[${barIndex}].masm.histogram`);
        maximumExpectedMagnitude = Math.max(
            maximumExpectedMagnitude,
            numericMagnitude(output.masm.histogram.value),
        );
        if (!ORACLE_DIRECTIONS.has(output.masm.direction)) {
            throw new Error(`Parity oracle expected[${barIndex}].masm.direction is unsupported`);
        }
        validateTradeEvents(output.masm.entries, `expected[${barIndex}].masm.entries`);
        validateTradeEvents(output.masm.exits, `expected[${barIndex}].masm.exits`);
        if (typeof output.masm.background.active !== "boolean") {
            throw new Error(
                `Parity oracle expected[${barIndex}].masm.background.active must be a boolean`,
            );
        }
        if (output.masm.background.semanticColor !== null) {
            assertNonEmpty(
                output.masm.background.semanticColor,
                `expected[${barIndex}].masm.background.semanticColor`,
            );
        }
        validateLabels(output.masm.labels, `expected[${barIndex}].masm.labels`);
        for (const label of output.masm.labels) {
            maximumExpectedMagnitude = Math.max(
                maximumExpectedMagnitude,
                numericMagnitude(label.valueAnchor),
            );
        }
        const currentMasmPlotNames = validatePlotMap(
            output.masm.plots,
            `expected[${barIndex}].masm.plots`,
        );
        if (masmPlotNames === null) masmPlotNames = currentMasmPlotNames;
        if (!isDeepStrictEqual(masmPlotNames, currentMasmPlotNames)) {
            throw new Error(`Parity oracle MASM plot names changed at bar ${barIndex}`);
        }
        for (const point of Object.values(output.masm.plots)) {
            maximumExpectedMagnitude = Math.max(
                maximumExpectedMagnitude,
                numericMagnitude(point.value),
            );
        }
        for (const [name, point] of Object.entries(output.masm.plots)) {
            if (masmPresentation.get(name)?.kind !== point.kind) {
                throw new Error(`Parity oracle MASM presentation mismatch for ${name}`);
            }
        }
        previousTime = bar.time;
    }
    if (oracle.capture.fixtureStart !== oracle.bars[0]?.time) {
        throw new Error("Parity oracle fixtureStart does not match the first bar");
    }
    if (oracle.capture.fixtureEnd !== oracle.bars[oracle.bars.length - 1]?.time) {
        throw new Error("Parity oracle fixtureEnd does not match the last bar");
    }
    validateRequiredInputs(oracle.inputs.trend, REQUIRED_TREND_INPUTS, "Trend");
    validateRequiredInputs(oracle.inputs.masm, REQUIRED_MASM_INPUTS, "MASM");
    if (oracle.inputs.masmSource.output !== "Tab Trend Long") {
        throw new Error("MASM source must be the captured Tab Trend Long output");
    }
    assertNonEmpty(oracle.inputs.masmSource.script, "inputs.masmSource.script");
    if (oracle.inputs.masmSource.script !== oracle.capture.trendScriptVersion) {
        throw new Error("MASM source script must match the captured Trend script version");
    }
    const tolerance = oracle.tolerance;
    assertNonEmpty(tolerance.name, "tolerance.name");
    assertNonEmpty(tolerance.representation, "tolerance.representation");
    assertFiniteNumber(tolerance.absolute, "tolerance.absolute");
    assertFiniteNumber(tolerance.relative, "tolerance.relative");
    assertFiniteNumber(tolerance.minimumDecisionDistance, "tolerance.minimumDecisionDistance");
    if (tolerance.absolute < 0 || tolerance.relative < 0) {
        throw new Error("Parity oracle numeric tolerances must be non-negative");
    }
    const maximumNumericTolerance = Math.max(
        tolerance.absolute,
        tolerance.relative * maximumExpectedMagnitude,
    );
    if (
        tolerance.minimumDecisionDistance <= 0 ||
        maximumNumericTolerance * 1_000 >= tolerance.minimumDecisionDistance
    ) {
        throw new Error("Parity oracle tolerance must be smaller than minimumDecisionDistance");
    }
    const recordedDistances = Object.values(oracle.thresholdDistances);
    if (
        recordedDistances.length === 0 ||
        recordedDistances.some((distance) => !Number.isFinite(distance) || distance <= 0) ||
        Math.min(...recordedDistances) !== tolerance.minimumDecisionDistance
    ) {
        throw new Error("Parity oracle threshold distances must reproduce minimumDecisionDistance");
    }
    for (const distanceName of TREND_MASM_REQUIRED_DECISION_DISTANCES) {
        if (!(distanceName in oracle.thresholdDistances)) {
            throw new Error(`Parity oracle threshold distances are missing ${distanceName}`);
        }
    }
    assertRecord(oracle.anchorChecks, "anchorChecks");
    if (Object.keys(oracle.anchorChecks).length === 0) {
        throw new Error("Parity oracle anchorChecks must not be empty");
    }
    const checksumRows: ReadonlyArray<readonly [string, string, unknown]> = [
        ["barsSha256", oracle.checksums.barsSha256, oracle.bars],
        ["expectedSha256", oracle.checksums.expectedSha256, oracle.expected],
        ["trendPineSha256", oracle.checksums.trendPineSha256, raw.trendPine],
        ["masmPineSha256", oracle.checksums.masmPineSha256, raw.masmPine],
        ["rawProviderSha256", oracle.checksums.rawProviderSha256, raw.providerExport],
        ["evaluatorSha256", oracle.checksums.evaluatorSha256, raw.evaluatorSource],
        ["settingsSha256", oracle.checksums.settingsSha256, oracle.inputs],
        ["presentationSha256", oracle.checksums.presentationSha256, oracle.presentation],
    ];
    for (const [name, expected, value] of checksumRows) {
        const actual = sha256(value);
        if (actual !== expected) {
            throw new Error(
                `Parity oracle ${name} mismatch: expected ${expected}, actual ${actual}`,
            );
        }
    }
}

/**
 * Load and fully validate the checked-in Trend/MASM parity oracle.
 * @since 1.7
 * @example
 *     const promise = loadTrendMasmParityOracle();
 *     void promise;
 */
export async function loadTrendMasmParityOracle(
    fixtureDir = TREND_MASM_PARITY_FIXTURE_DIR,
): Promise<TrendMasmParityOracle> {
    const rawDir = resolvePath(fixtureDir, "raw");
    const [oracleJson, trendPine, masmPine, providerExport, evaluatorSource] = await Promise.all([
        readFile(resolvePath(fixtureDir, "oracle.json"), "utf8"),
        readFile(resolvePath(rawDir, "Trend_Wizard.pine"), "utf8"),
        readFile(resolvePath(rawDir, "MASM_Strat.pine"), "utf8"),
        readFile(resolvePath(rawDir, "massive-tqqq-1d-pages.json"), "utf8"),
        readFile(resolvePath(rawDir, "trendMasmPineReference.ts"), "utf8"),
    ]);
    const oracle = JSON.parse(oracleJson) as TrendMasmParityOracle;
    validateTrendMasmParityOracle(oracle, {
        trendPine,
        masmPine,
        providerExport,
        evaluatorSource,
    });
    return oracle;
}

function firstDifference(
    layer: ParityLayer,
    barIndex: number,
    timestamp: number,
    field: string,
    expected: unknown,
    actual: unknown,
): ParityComparison {
    return {
        matches: false,
        firstDifference: { layer, barIndex, timestamp, field, expected, actual },
    };
}

function numbersMatch(
    expected: OracleNumber,
    actual: OracleNumber,
    tolerance: NumericTolerance,
): boolean {
    if (expected === null || actual === null) return expected === actual;
    const delta = Math.abs(expected - actual);
    return delta <= Math.max(tolerance.absolute, tolerance.relative * Math.abs(expected));
}

function compareExact(
    layer: ParityLayer,
    barIndex: number,
    timestamp: number,
    field: string,
    expected: unknown,
    actual: unknown,
): ParityComparison | null {
    return isDeepStrictEqual(expected, actual)
        ? null
        : firstDifference(layer, barIndex, timestamp, field, expected, actual);
}

function comparePlotMap(
    layer: ParityLayer,
    barIndex: number,
    timestamp: number,
    field: string,
    expected: Readonly<Record<string, OraclePlotPoint>>,
    actual: Readonly<Record<string, OraclePlotPoint>>,
    tolerance: NumericTolerance,
): ParityComparison | null {
    const expectedNames = Object.keys(expected).sort();
    const actualNames = Object.keys(actual).sort();
    const namesDifference = compareExact(
        layer,
        barIndex,
        timestamp,
        `${field}.names`,
        expectedNames,
        actualNames,
    );
    if (namesDifference !== null) return namesDifference;
    for (const name of expectedNames) {
        const expectedPoint = expected[name];
        const actualPoint = actual[name];
        if (!numbersMatch(expectedPoint.value, actualPoint.value, tolerance)) {
            return firstDifference(
                layer,
                barIndex,
                timestamp,
                `${field}.${name}.value`,
                expectedPoint.value,
                actualPoint.value,
            );
        }
        const semanticDifference = compareExact(
            layer,
            barIndex,
            timestamp,
            `${field}.${name}.semanticColor`,
            expectedPoint.semanticColor,
            actualPoint.semanticColor,
        );
        if (semanticDifference !== null) return semanticDifference;
        const kindDifference = compareExact(
            layer,
            barIndex,
            timestamp,
            `${field}.${name}.kind`,
            expectedPoint.kind,
            actualPoint.kind,
        );
        if (kindDifference !== null) return kindDifference;
    }
    return null;
}

function compareBarFacts(
    expected: TrendMasmBar,
    actual: TrendMasmBar,
    barIndex: number,
    tolerance: NumericTolerance,
): ParityComparison | null {
    if (expected.time !== actual.time) {
        return firstDifference(
            "live-feed",
            barIndex,
            expected.time,
            "bar.time",
            expected.time,
            actual.time,
        );
    }
    for (const field of ["open", "high", "low", "close", "volume"] as const) {
        if (!numbersMatch(expected[field], actual[field], tolerance)) {
            return firstDifference(
                "live-feed",
                barIndex,
                expected.time,
                `bar.${field}`,
                expected[field],
                actual[field],
            );
        }
    }
    return null;
}

function compareExpectedRow(
    expected: TrendMasmExpectedRow,
    actual: TrendMasmExpectedRow,
    barIndex: number,
    tolerance: NumericTolerance,
): ParityComparison | null {
    if (expected.time !== actual.time) {
        return firstDifference(
            "engine",
            barIndex,
            expected.time,
            "time",
            expected.time,
            actual.time,
        );
    }
    for (const field of ["short", "medium", "long"] as const) {
        if (!numbersMatch(expected.trend[field], actual.trend[field], tolerance)) {
            return firstDifference(
                "engine",
                barIndex,
                expected.time,
                `trend.${field}`,
                expected.trend[field],
                actual.trend[field],
            );
        }
    }
    const trendPlots = comparePlotMap(
        "engine",
        barIndex,
        expected.time,
        "trend.plots",
        expected.trend.plots,
        actual.trend.plots,
        tolerance,
    );
    if (trendPlots !== null) return trendPlots;
    if (!numbersMatch(expected.masm.source, actual.masm.source, tolerance)) {
        return firstDifference(
            "engine",
            barIndex,
            expected.time,
            "masm.source",
            expected.masm.source,
            actual.masm.source,
        );
    }
    if (!numbersMatch(expected.masm.histogram.value, actual.masm.histogram.value, tolerance)) {
        return firstDifference(
            "engine",
            barIndex,
            expected.time,
            "masm.histogram.value",
            expected.masm.histogram.value,
            actual.masm.histogram.value,
        );
    }
    for (const field of ["semanticColor", "kind"] as const) {
        const difference = compareExact(
            "engine",
            barIndex,
            expected.time,
            `masm.histogram.${field}`,
            expected.masm.histogram[field],
            actual.masm.histogram[field],
        );
        if (difference !== null) return difference;
    }
    for (const field of ["direction", "entries", "exits", "background", "labels"] as const) {
        const difference = compareExact(
            "engine",
            barIndex,
            expected.time,
            `masm.${field}`,
            expected.masm[field],
            actual.masm[field],
        );
        if (difference !== null) return difference;
    }
    return comparePlotMap(
        "engine",
        barIndex,
        expected.time,
        "masm.plots",
        expected.masm.plots,
        actual.masm.plots,
        tolerance,
    );
}

/**
 * Compare all normalized Trend/MASM engine rows and report the first difference.
 * @since 1.7
 * @example
 *     const fn: typeof compareTrendMasmEngineParity = compareTrendMasmEngineParity;
 *     void fn;
 */
export function compareTrendMasmEngineParity(
    oracle: Pick<TrendMasmParityOracle, "expected" | "tolerance">,
    actual: ReadonlyArray<TrendMasmExpectedRow>,
): ParityComparison {
    if (actual.length !== oracle.expected.length) {
        return firstDifference(
            "engine",
            Math.min(actual.length, oracle.expected.length),
            oracle.expected[Math.min(actual.length, oracle.expected.length)]?.time ?? -1,
            "length",
            oracle.expected.length,
            actual.length,
        );
    }
    for (let barIndex = 0; barIndex < oracle.expected.length; barIndex += 1) {
        const expectedRow = oracle.expected[barIndex];
        const actualRow = actual[barIndex];
        const difference = compareExpectedRow(expectedRow, actualRow, barIndex, oracle.tolerance);
        if (difference !== null) return difference;
    }
    return { matches: true, firstDifference: null };
}

/**
 * Compare plot order, visibility, style, glyph, width, and semantic colors.
 * @since 1.7
 * @example
 *     const fn: typeof compareTrendMasmPresentationParity = compareTrendMasmPresentationParity;
 *     void fn;
 */
export function compareTrendMasmPresentationParity(
    oracle: Pick<TrendMasmParityOracle, "capture" | "presentation">,
    actual: TrendMasmParityOracle["presentation"],
): ParityComparison {
    for (const owner of ["trend", "masm"] as const) {
        const expectedDefinitions = oracle.presentation[owner];
        const actualDefinitions = actual[owner];
        if (expectedDefinitions.length !== actualDefinitions.length) {
            return firstDifference(
                "engine",
                0,
                oracle.capture.fixtureStart,
                `presentation.${owner}.length`,
                expectedDefinitions.length,
                actualDefinitions.length,
            );
        }
        for (let plotIndex = 0; plotIndex < expectedDefinitions.length; plotIndex += 1) {
            const expectedDefinition = expectedDefinitions[plotIndex];
            const actualDefinition = actualDefinitions[plotIndex];
            for (const field of [
                "name",
                "title",
                "kind",
                "style",
                "order",
                "visible",
                "lineWidth",
                "glyph",
                "textColor",
                "semanticColor",
            ] as const) {
                if (!isDeepStrictEqual(expectedDefinition[field], actualDefinition[field])) {
                    return firstDifference(
                        "engine",
                        0,
                        oracle.capture.fixtureStart,
                        `presentation.${owner}[${plotIndex}].${field}`,
                        expectedDefinition[field],
                        actualDefinition[field],
                    );
                }
            }
        }
    }
    return { matches: true, firstDifference: null };
}

/**
 * Compare live OHLCV input bars against the provider-backed frozen fixture.
 * @since 1.7
 * @example
 *     const fn: typeof compareTrendMasmLiveFeedParity = compareTrendMasmLiveFeedParity;
 *     void fn;
 */
export function compareTrendMasmLiveFeedParity(
    oracle: Pick<TrendMasmParityOracle, "bars" | "tolerance">,
    actual: ReadonlyArray<TrendMasmBar>,
): ParityComparison {
    if (actual.length !== oracle.bars.length) {
        return firstDifference(
            "live-feed",
            Math.min(actual.length, oracle.bars.length),
            oracle.bars[Math.min(actual.length, oracle.bars.length)]?.time ?? -1,
            "length",
            oracle.bars.length,
            actual.length,
        );
    }
    for (let barIndex = 0; barIndex < oracle.bars.length; barIndex += 1) {
        const expectedBar = oracle.bars[barIndex];
        const actualBar = actual[barIndex];
        const difference = compareBarFacts(expectedBar, actualBar, barIndex, oracle.tolerance);
        if (difference !== null) return difference;
    }
    return { matches: true, firstDifference: null };
}

/**
 * Inclusive active MASM background interval with its semantic color.
 * @since 1.7
 * @example
 *     const interval: ActiveInterval = { start: 1, end: 2, semanticColor: null };
 *     void interval;
 */
export type ActiveInterval = {
    readonly start: number;
    readonly end: number;
    readonly semanticColor: string | null;
};

/**
 * Collapse consecutive active MASM background rows into inclusive intervals.
 * @since 1.7
 * @example
 *     const intervals = deriveMasmBackgroundIntervals([]);
 *     void intervals;
 */
export function deriveMasmBackgroundIntervals(
    rows: ReadonlyArray<TrendMasmExpectedRow>,
): ReadonlyArray<ActiveInterval> {
    const intervals: ActiveInterval[] = [];
    let start: number | null = null;
    let end = -1;
    let semanticColor: string | null = null;
    for (const row of rows) {
        const background = row.masm.background;
        if (!background.active) {
            if (start !== null) intervals.push({ start, end, semanticColor });
            start = null;
            semanticColor = null;
            continue;
        }
        if (start === null || semanticColor !== background.semanticColor) {
            if (start !== null) intervals.push({ start, end, semanticColor });
            start = row.time;
            semanticColor = background.semanticColor;
        }
        end = row.time;
    }
    if (start !== null) intervals.push({ start, end, semanticColor });
    return intervals;
}
