// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { compile } from "@invinite-org/chartlang-compiler";
import type { Bar } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost.js";

/**
 * Regression: a `request.security({ interval }, (b) => ta.rsi(b.close, 14))`
 * filter must warm under the PRODUCTION feed pattern — the host bulk-warms the
 * secondary stream BEFORE the script's first compute (which captures the
 * callback). Before the compiler counted the in-callback indicator length into
 * `maxLookback`, the secondary ring collapsed to one bar, evicted the warmup
 * window, and the indicator read NaN forever, so the alert silently never fired.
 */

const SEC = "1h";
const MAIN = "15m";
const M15 = 900_000;
const HOUR = 3_600_000;

// crossover(close, 100) AND rsi(14) @ 1h > 70 — the multi-condition alert shape.
const SOURCE = `import { alert, defineAlert, request, ta } from "@invinite-org/chartlang-core";

export default defineAlert({
    name: "rsi-htf-filter",
    apiVersion: 1,
    compute({ bar, request, ta, alert }) {
        const f = request.security({ interval: "1h" }, (b) => ta.rsi(b.close, 14));
        if (ta.crossover(bar.close, 100).current && f.current > 70) {
            alert("rsi-htf-filter", { severity: "info" });
        }
    }
});
`;

function caps(): Capabilities {
    return {
        plots: new Set(["line"]) as unknown as Capabilities["plots"],
        drawings: new Set(),
        alerts: new Set(["log"]),
        alertConditions: true,
        logs: true,
        inputs: new Set(),
        intervals: [
            { value: MAIN, label: "15 min", group: "m" },
            { value: SEC, label: "1 hour", group: "h" },
        ],
        multiTimeframe: true,
        multiSymbol: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 30,
    } as unknown as Capabilities;
}

function bar(time: number, close: number, interval: string): Bar {
    return {
        time,
        open: close,
        high: close,
        low: close,
        close,
        hl2: close,
        hlc3: close,
        ohlc4: close,
        hlcc4: close,
        volume: 0,
        symbol: "X",
        interval,
    } as Bar;
}

// 16 oscillating closes (RSI ≈ 50) then 14 pure gains (RSI climbs well past 70).
function secondaryCloses(): number[] {
    const out: number[] = [];
    for (let i = 0; i < 16; i += 1) out.push(i % 2 === 0 ? 100 : 101);
    let last = out[out.length - 1];
    for (let i = 0; i < 14; i += 1) {
        last += 4;
        out.push(last);
    }
    return out;
}

describe("request.security indicator filter warmup (production bulk-warm)", () => {
    it("fires the high-RSI cross after a bulk-warmed secondary stream", async () => {
        const compiled = await compile(SOURCE, { apiVersion: 1 });
        // The compiler must size capacity to retain the rsi(14) warmup window.
        expect(compiled.manifest.maxLookback).toBeGreaterThanOrEqual(14);

        const host = createQuickJsHost({ capabilities: caps() });
        await host.load({ moduleSource: compiled.moduleSource, manifest: compiled.manifest });

        // PRODUCTION pattern: warm ALL secondary 1h history in bulk first.
        const sec = secondaryCloses().map((c, i) => bar(i * HOUR, c, SEC));
        await host.push({ kind: "history", bars: sec, streamKey: feedKey(undefined, SEC) });
        await host.drain();

        // 15m base crosses: 95 → 105 crosses up 100; the last cross aligns to the
        // end of the gain run (RSI ≫ 70) and must fire.
        const fired: number[] = [];
        const base: ReadonlyArray<readonly [number, number]> = [
            [15 * HOUR, 95],
            [15 * HOUR + M15, 105], // cross; RSI ≈ 50 → blocked
            [15 * HOUR + 2 * M15, 95],
            [29 * HOUR, 105], // cross; RSI ≫ 70 → fires
        ];
        for (const [time, close] of base) {
            await host.push({ kind: "close", bar: bar(time, close, MAIN) });
            const em = await host.drain();
            if (em.alerts.length > 0) fired.push(time);
        }
        host.dispose();

        expect(fired).toEqual([29 * HOUR]);
    });
});
