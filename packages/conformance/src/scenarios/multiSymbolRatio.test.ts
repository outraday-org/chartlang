// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { capabilities as cb } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { compile } from "@invinite-org/chartlang-compiler";
import type { Bar } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";
import { createScriptRunner } from "@invinite-org/chartlang-runtime";
import { describe, expect, it } from "vitest";

import { generateGoldenBars } from "../fixtures/generateGoldenBars.js";
import { MTF_QQQ_FIXTURE_BARS, MTF_SPY_FIXTURE_BARS } from "./multiSymbolFixtures.js";
import { MULTI_SYMBOL_RATIO_SCENARIO } from "./multiSymbolRatio.scenario.js";

const PACKAGE_DIR = resolvePath(fileURLToPath(import.meta.url), "../../..");
const CACHE_DIR = resolvePath(PACKAGE_DIR, ".cache");

// A multi-symbol + multi-timeframe capability bag. The scenario overrides both
// on the suite, but this test drives the runtime directly so it needs a full
// bag — mirrors `mtfSecurityExpressionEma.test.ts` with `multiSymbol: true`.
const MULTI_SYMBOL_CAPABILITIES: Capabilities = {
    plots: cb.union(cb.line(), cb.horizontalLine()),
    drawings: new Set(),
    alerts: cb.alerts("log"),
    alertConditions: true,
    logs: true,
    inputs: new Set(),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: true,
    multiSymbol: true,
    subPanes: 1,
    symInfoFields: new Set(["ticker", "type", "mintick"]),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
};

const SPY_FEED = feedKey("AMEX:SPY", "1D");
const QQQ_FEED = feedKey("NASDAQ:QQQ", "1D");

async function runRatioSeries(): Promise<ReadonlyArray<number>> {
    const compiled = await compile(MULTI_SYMBOL_RATIO_SCENARIO.inlineSource ?? "", {
        apiVersion: 1,
        sourcePath: `<inline:${MULTI_SYMBOL_RATIO_SCENARIO.id}>.chart.ts`,
    });
    await mkdir(CACHE_DIR, { recursive: true });
    const bundlePath = resolvePath(
        CACHE_DIR,
        `multi-symbol-distinctness-${randomBytes(8).toString("hex")}.mjs`,
    );
    await writeFile(bundlePath, compiled.moduleSource, "utf8");

    const ratio: number[] = [];
    try {
        const mod = (await import(pathToFileURL(bundlePath).href)) as {
            readonly default: { readonly compute: unknown };
        };
        const runnable = Object.freeze({ ...mod.default, manifest: compiled.manifest });
        const candleLimit = MULTI_SYMBOL_RATIO_SCENARIO.candleLimit ?? 10;
        const candles: ReadonlyArray<Bar> = generateGoldenBars().slice(0, candleLimit);
        const runner = createScriptRunner({
            compiled: runnable,
            capabilities: MULTI_SYMBOL_CAPABILITIES,
        });
        let spyIndex = 0;
        let qqqIndex = 0;
        for (const candle of candles) {
            while (
                spyIndex < MTF_SPY_FIXTURE_BARS.length &&
                MTF_SPY_FIXTURE_BARS[spyIndex].time <= candle.time
            ) {
                await runner.push({
                    kind: "close",
                    bar: MTF_SPY_FIXTURE_BARS[spyIndex],
                    streamKey: SPY_FEED,
                });
                spyIndex += 1;
            }
            while (
                qqqIndex < MTF_QQQ_FIXTURE_BARS.length &&
                MTF_QQQ_FIXTURE_BARS[qqqIndex].time <= candle.time
            ) {
                await runner.push({
                    kind: "close",
                    bar: MTF_QQQ_FIXTURE_BARS[qqqIndex],
                    streamKey: QQQ_FEED,
                });
                qqqIndex += 1;
            }
            await runner.push({ kind: "close", bar: candle });
            for (const plot of runner.drain().plots) {
                if (typeof plot.value === "number") ratio.push(plot.value);
            }
        }
        await runner.dispose();
    } finally {
        await rm(bundlePath, { force: true });
    }
    return ratio;
}

describe("multi-symbol-ratio distinctness guard", () => {
    it("routes SPY and QQQ to distinct streams — the ratio is finite and ≠ 1", async () => {
        const ratio = await runRatioSeries();

        // If the composite feed key collapsed SPY and QQQ onto one stream, the
        // ratio would be 1 (a stream divided by itself) — or all-NaN if the
        // second feed never registered. Finiteness plus ≠ 1 is the regression
        // guard that `feedKey(symbol, interval)` separates the two symbols.
        const finite = ratio.filter((v) => Number.isFinite(v));
        expect(finite.length).toBeGreaterThan(0);

        // The fixture closes give a SPY/QQQ ratio around 2 (600/300 .. 640/320),
        // a band the main golden stream and a same-symbol read never produce.
        for (const v of finite) {
            expect(v).not.toBe(1);
            expect(v).toBeGreaterThan(1.5);
            expect(v).toBeLessThan(2.5);
        }
    });
});
