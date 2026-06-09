// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { bench, describe } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost";

const ITERATIONS = 1_000;

function makeCapabilities(): Capabilities {
    return {
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
        maxLookback: 5_000,
        maxTickHz: 10,
    };
}

function manifest(): ScriptManifest {
    return {
        apiVersion: 1,
        kind: "indicator",
        name: "quickjs per-bar compute bench",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 64 },
        maxLookback: 50,
    };
}

function bar(index: number): Bar {
    const close = 100 + Math.sin(index / 10) * 5 + index * 0.01;
    const open = close - 0.25;
    const high = close + 0.5;
    const low = close - 0.5;
    return {
        time: 1_700_000_000_000 + index * 60_000,
        open,
        high,
        low,
        close,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        volume: 1_000 + index,
        symbol: "X",
        interval: "1m",
    };
}

const MANIFEST = manifest();
const SOURCE = `
export default {
    manifest: ${JSON.stringify(MANIFEST)},
    compute: ({ bar, ta, plot }) => {
        const ema = ta.ema("per-bar.ema:1:1#0", bar.close, 20);
        const rsi = ta.rsi("per-bar.rsi:1:1#0", bar.close, 14);
        plot("per-bar.plot:1:1#0", ema.current + rsi.current, {});
    },
};
`;

describe("host-quickjs per-bar compute", () => {
    bench("1,000 push(close) → drain cycles", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load({ moduleSource: SOURCE, manifest: MANIFEST });
        for (let i = 0; i < ITERATIONS; i += 1) {
            await host.push({ kind: "close", bar: bar(i) });
            await host.drain();
        }
        host.dispose();
    });
});
