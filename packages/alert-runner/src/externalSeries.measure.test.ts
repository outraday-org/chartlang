// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createQuickJsHost } from "@invinite-org/chartlang-host-quickjs";
import { describe, expect, it } from "vitest";

import { CONSUMER, compiled, walk } from "./__fixtures__/scripts.js";
import { toRuntimeBar } from "./bar.js";
import { alertRunnerCapabilities } from "./capabilities.js";
import { createAlertRunner } from "./runner.js";
import type { AlertBar } from "./types.js";

// Opt-in measurement (minutes, not seconds): `ALERT_RUNNER_MEASURE=1 pnpm vitest run
// packages/alert-runner/src/externalSeries.measure.test.ts`. It prints the
// bar-close cost and heap of an external-series runner over 5,000 warm-up +
// 100,000 live bars, and the cost of the whole-array re-send it replaces.
const MEASURE = process.env.ALERT_RUNNER_MEASURE === "1";
const WARM_UP = 5_000;
const LIVE = 100_000;
const BATCH = 10_000;

function mib(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1);
}

describe.skipIf(!MEASURE)("external-series bar-close cost (measurement)", () => {
    it(
        "stays flat per bar over 100,000 live bars",
        async () => {
            const script = await compiled(CONSUMER);
            const bars = walk(WARM_UP + LIVE);
            const runner = await createAlertRunner({
                compiled: script,
                interval: "1h",
                frequency: "every_time",
                externalSeries: { names: ["signal"] },
            });
            const warmBars = bars.slice(0, WARM_UP);
            let start = performance.now();
            await runner.warmUp(warmBars, {
                externalSeries: { signal: warmBars.map((b) => b.close - 1) },
            });
            const warmMs = performance.now() - start;
            const lines = [`warm-up ${WARM_UP} bars: ${warmMs.toFixed(0)} ms`];
            const perBatch: number[] = [];
            start = performance.now();
            for (let i = WARM_UP; i < bars.length; i += 1) {
                const bar = bars[i] as AlertBar;
                await runner.onBarClose(bar, { externalSeries: { signal: bar.close - 1 } });
                if ((i - WARM_UP + 1) % BATCH === 0) {
                    const ms = performance.now() - start;
                    perBatch.push(ms / BATCH);
                    lines.push(
                        `live bars ${i - WARM_UP + 1}: ${((ms / BATCH) * 1000).toFixed(0)} µs/bar, node heap ${mib(process.memoryUsage().heapUsed)} MiB`,
                    );
                    start = performance.now();
                }
            }
            runner.dispose();

            // The approach it replaces: the whole history re-sent every bar.
            const host = createQuickJsHost({
                capabilities: alertRunnerCapabilities({
                    manifest: script.manifest,
                    interval: "1h",
                    maxLookback: 5_000,
                }),
                limits: { maxHeapBytes: 256 * 1024 * 1024, maxStepMs: 10_000 },
            });
            await host.load({ moduleSource: script.moduleSource, manifest: script.manifest });
            await host.push({ kind: "close", bar: toRuntimeBar(bars[0] as AlertBar, "", "1h") });
            await host.drain();
            for (const n of [5_000, 50_000, 105_000]) {
                const values = bars.slice(0, n).map((b) => b.close);
                const t = performance.now();
                for (let k = 0; k < 10; k += 1)
                    host.setExternalSeries({ "producer-feed": { values } });
                lines.push(
                    `whole-array re-send, history ${n}: ${((performance.now() - t) / 10).toFixed(2)} ms/bar`,
                );
            }
            host.dispose();
            console.info(lines.join("\n"));

            // Flat: the last batch costs no more than 2× the first.
            expect(perBatch[perBatch.length - 1] as number).toBeLessThan(
                2 * (perBatch[0] as number),
            );
        },
        30 * 60_000,
    );
});
