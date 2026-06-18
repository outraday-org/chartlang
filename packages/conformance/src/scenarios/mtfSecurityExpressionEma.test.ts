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
import { createScriptRunner } from "@invinite-org/chartlang-runtime";
import { describe, expect, it } from "vitest";

import { generateGoldenBars } from "../fixtures/generateGoldenBars.js";
import { MTF_DAILY_FIXTURE_BARS } from "./mtfFixtures.js";
import { MTF_SECURITY_EXPRESSION_EMA_SCENARIO } from "./mtfSecurityExpressionEma.scenario.js";

const PACKAGE_DIR = resolvePath(fileURLToPath(import.meta.url), "../../..");
const CACHE_DIR = resolvePath(PACKAGE_DIR, ".cache");

// A multi-timeframe-enabled capability bag — the scenario itself overrides
// `multiTimeframe` on the suite, but this test drives the runtime directly so
// it needs a full bag. Mirrors the shape of `runConformanceSuite.test.ts`'s
// `TEST_CAPABILITIES` with `multiTimeframe: true`.
const MTF_CAPABILITIES: Capabilities = {
    plots: cb.union(cb.line(), cb.horizontalLine()),
    drawings: new Set(),
    alerts: cb.alerts("log"),
    alertConditions: true,
    logs: true,
    inputs: new Set(),
    intervals: [{ value: "1D", label: "1 day", group: "daily" }],
    multiTimeframe: true,
    subPanes: 1,
    symInfoFields: new Set(["ticker", "type", "mintick"]),
    maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
    maxLookback: 1000,
    maxTickHz: 30,
};

const EMA_LENGTH = 2;

/** Same-length single-pass EMA over an ascending close series. */
function mainEma(closes: ReadonlyArray<number>, length: number): ReadonlyArray<number> {
    const k = 2 / (length + 1);
    const out: number[] = [];
    let ema = Number.NaN;
    closes.forEach((close, i) => {
        ema = i === 0 ? close : close * k + ema * (1 - k);
        out.push(ema);
    });
    return out;
}

async function runExpressionSeries(): Promise<{
    readonly expr: ReadonlyArray<number>;
    readonly main: ReadonlyArray<number>;
}> {
    const compiled = await compile(MTF_SECURITY_EXPRESSION_EMA_SCENARIO.inlineSource ?? "", {
        apiVersion: 1,
        sourcePath: `<inline:${MTF_SECURITY_EXPRESSION_EMA_SCENARIO.id}>.chart.ts`,
    });
    await mkdir(CACHE_DIR, { recursive: true });
    const bundlePath = resolvePath(
        CACHE_DIR,
        `expr-distinctness-${randomBytes(8).toString("hex")}.mjs`,
    );
    await writeFile(bundlePath, compiled.moduleSource, "utf8");

    const expr: number[] = [];
    const main: number[] = [];
    try {
        const mod = (await import(pathToFileURL(bundlePath).href)) as {
            readonly default: { readonly compute: unknown };
        };
        const runnable = Object.freeze({ ...mod.default, manifest: compiled.manifest });
        const candleLimit = MTF_SECURITY_EXPRESSION_EMA_SCENARIO.candleLimit ?? 10;
        const candles: ReadonlyArray<Bar> = generateGoldenBars().slice(0, candleLimit);
        const runner = createScriptRunner({ compiled: runnable, capabilities: MTF_CAPABILITIES });
        let secondaryIndex = 0;
        for (const candle of candles) {
            while (
                secondaryIndex < MTF_DAILY_FIXTURE_BARS.length &&
                MTF_DAILY_FIXTURE_BARS[secondaryIndex].time <= candle.time
            ) {
                await runner.push({
                    kind: "close",
                    bar: MTF_DAILY_FIXTURE_BARS[secondaryIndex],
                    streamKey: "1D",
                });
                secondaryIndex += 1;
            }
            await runner.push({ kind: "close", bar: candle });
            for (const plot of runner.drain().plots) {
                if (typeof plot.value === "number") expr.push(plot.value);
            }
            main.push(candle.close);
        }
        await runner.dispose();
    } finally {
        await rm(bundlePath, { force: true });
    }
    return { expr, main: mainEma(main, EMA_LENGTH) };
}

describe("mtf-security-expression-ema distinctness guard", () => {
    it("computes the EMA on the HTF clock — finite output that differs from a same-length main EMA", async () => {
        const { expr, main } = await runExpressionSeries();

        // The HTF EMA(2) over the 3-bar daily fixture warms up and emits
        // finite values (the original bug left it indistinguishable from the
        // main EMA — or all-NaN — so finiteness is the first half of the
        // regression guard).
        const finite = expr.filter((v) => Number.isFinite(v));
        expect(finite.length).toBeGreaterThan(0);

        // The distinctness guard: the HTF series (computed over the secondary
        // 510/620/730 closes) must diverge from a same-length EMA over the
        // main golden closes (~100). The mean absolute difference over the
        // warm region is enormous; a regression that silently routed the EMA
        // back onto the main clock would collapse it toward zero.
        let sum = 0;
        let count = 0;
        for (let i = 0; i < expr.length; i += 1) {
            if (Number.isFinite(expr[i]) && Number.isFinite(main[i])) {
                sum += Math.abs(expr[i] - main[i]);
                count += 1;
            }
        }
        expect(count).toBeGreaterThan(0);
        expect(sum / count).toBeGreaterThan(50);
    });
});
