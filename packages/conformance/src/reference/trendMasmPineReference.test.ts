// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../../../runtime/src/createScriptRunner.js";
import type { RuntimeTaNamespace } from "../../../runtime/src/ta/index.js";

import { loadTrendMasmParityOracle, type TrendMasmBar } from "../parityOracle.js";
import {
    evaluateTrendMasmPineReference,
    pineEma,
    pineRma,
    pineSma,
    pineWma,
} from "./trendMasmPineReference.js";

const fixtureDir = resolve(import.meta.dirname, "../../fixtures/tradingview-trend-masm");

const RUNTIME_CAPABILITIES: Capabilities = {
    plots: capabilities.allLines(),
    drawings: new Set(),
    alerts: new Set(),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 3_000,
    maxTickHz: 10,
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return Object.prototype.toString.call(value) === "[object Object]";
}

describe("standalone Trend/MASM Pine reference", () => {
    it("recomputes every frozen expected row without Chartlang participation", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const evaluation = evaluateTrendMasmPineReference(oracle.bars);

        expect(evaluation.expected).toEqual(oracle.expected);
        expect(evaluation.presentation).toEqual(oracle.presentation);
        expect(evaluation.thresholdDistances).toEqual(oracle.thresholdDistances);
        expect(evaluation.minimumDecisionDistance).toBe(oracle.tolerance.minimumDecisionDistance);
    });

    it("keeps the checked-in evaluator byte-identical and import-free", async () => {
        const [source, frozenSource] = await Promise.all([
            readFile(resolve(import.meta.dirname, "trendMasmPineReference.ts"), "utf8"),
            readFile(resolve(fixtureDir, "raw/trendMasmPineReference.ts"), "utf8"),
        ]);

        expect(frozenSource).toBe(source);
        expect(source).not.toMatch(/^\s*import\b/m);
        expect(source).not.toMatch(/\brequire\s*\(/);
    });

    it("keeps both frozen Pine inputs byte-identical to the canonical sources", async () => {
        const repositoryRoot = resolve(fixtureDir, "../../../..");
        const [canonicalTrend, frozenTrend, canonicalMasm, frozenMasm] = await Promise.all([
            readFile(resolve(repositoryRoot, "Trend_Wizard.md"), "utf8"),
            readFile(resolve(fixtureDir, "raw/Trend_Wizard.pine"), "utf8"),
            readFile(resolve(repositoryRoot, "MASM_Strat.md"), "utf8"),
            readFile(resolve(fixtureDir, "raw/MASM_Strat.pine"), "utf8"),
        ]);

        expect(frozenTrend).toBe(canonicalTrend);
        expect(frozenMasm).toBe(canonicalMasm);
    });

    it("proves every normalized bar comes byte-for-byte from the pinned Massive rows", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const providerText = await readFile(
            resolve(fixtureDir, "raw/massive-tqqq-1d-pages.json"),
            "utf8",
        );
        const providerValue: unknown = JSON.parse(providerText);
        if (!Array.isArray(providerValue)) throw new Error("Provider fixture must be an array");

        expect(providerValue).toHaveLength(3);
        const normalizedBars: TrendMasmBar[] = [];
        for (const pageValue of providerValue) {
            if (!isRecord(pageValue) || !Array.isArray(pageValue.candles)) {
                throw new Error("Provider fixture page must contain candles");
            }
            expect(pageValue).toMatchObject({
                source: "massive",
                symbol: "TQQQ",
                interval: "1d",
                assetType: "us_stock",
                converted: false,
                displayCurrency: null,
            });
            expect(pageValue.candles).toHaveLength(1_000);
            for (const candleValue of pageValue.candles) {
                if (!isRecord(candleValue)) throw new Error("Provider candle must be an object");
                expect(candleValue).toMatchObject({
                    symbol: "TQQQ",
                    interval: "1d",
                    assetType: "us_stock",
                });
                const { datetime, open, high, low, close, volume } = candleValue;
                if (
                    typeof datetime !== "string" ||
                    typeof open !== "number" ||
                    typeof high !== "number" ||
                    typeof low !== "number" ||
                    typeof close !== "number" ||
                    typeof volume !== "number" ||
                    ![open, high, low, close, volume].every(Number.isFinite)
                ) {
                    throw new Error("Provider candle must contain finite OHLCV facts");
                }
                normalizedBars.push({
                    time: Date.parse(datetime),
                    open,
                    high,
                    low,
                    close,
                    volume,
                });
            }
        }

        expect(normalizedBars).toEqual(oracle.bars);
    });

    it("matches the authenticated TradingView one-bar rounded anchor", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const lastBar = oracle.bars.at(-1);
        const last = oracle.expected.at(-1);

        expect(lastBar?.time).toBe(Date.parse("2026-08-27T04:00:00.000Z"));
        expect(lastBar).toMatchObject({ high: 73.38, close: 73.3 });
        expect(last?.trend.short).toBeCloseTo(-0.0795, 4);
        expect(last?.trend.medium).toBeCloseTo(-0.0647, 4);
        expect(last?.trend.long).toBeCloseTo(0.2051, 4);
        expect(last?.masm.plots["MA Slope"].value).toBeCloseTo(0.0196, 4);
        expect(last?.masm.plots["Consolidation Overlay Bars"].value).toBeCloseTo(0.0196, 4);
    });

    it("implements Pine warm-up and recurrence semantics explicitly", () => {
        const values = [1, 2, 3, 4];
        expect(pineSma(values, 3)).toEqual([Number.NaN, Number.NaN, 2, 3]);
        expect(pineEma(values, 3)).toEqual([1, 1.5, 2.25, 3.125]);
        expect(pineRma(values, 3)).toEqual([Number.NaN, Number.NaN, 2, 8 / 3]);
        expect(pineWma(values, 3)).toEqual([Number.NaN, Number.NaN, 14 / 6, 20 / 6]);
    });

    it("matches Chartlang ta.ema to the independent Pine recurrence on all frozen bars", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const actual8: number[] = [];
        const actual21: number[] = [];
        const compiled = defineIndicator({
            name: "frozen-tqqq-ema-parity",
            apiVersion: 1,
            compute: ({ bar, ta }) => {
                const runtimeTa = ta as unknown as Pick<RuntimeTaNamespace, "ema">;
                actual8.push(runtimeTa.ema("ema-8", bar.close, 8).current);
                actual21.push(runtimeTa.ema("ema-21", bar.close, 21).current);
            },
        });
        const runner = createScriptRunner({
            compiled: {
                ...compiled,
                manifest: { ...compiled.manifest, maxLookback: oracle.bars.length },
            },
            capabilities: RUNTIME_CAPABILITIES,
        });
        await runner.onHistory(
            oracle.bars.map((bar) => ({
                ...bar,
                symbol: "TQQQ",
                interval: "1D",
            })),
        );

        const closes = oracle.bars.map((bar) => bar.close);
        expect(actual8).toEqual(pineEma(closes, 8));
        expect(actual21).toEqual(pineEma(closes, 21));
    });

    it("detects a one-bar provider mutation in independently recomputed outputs", async () => {
        const oracle = await loadTrendMasmParityOracle(fixtureDir);
        const mutatedBars = oracle.bars.map((bar, index) =>
            index === oracle.bars.length - 2 ? { ...bar, close: bar.close + 0.25 } : bar,
        );
        const mutated = evaluateTrendMasmPineReference(mutatedBars);

        expect(mutated.expected).not.toEqual(oracle.expected);
        expect(mutated.expected.at(-1)?.trend.long).not.toBe(oracle.expected.at(-1)?.trend.long);
    });
});
