// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost";

// THRESHOLD_MS documents the Phase-5 §8.3 budget for the QuickJS host:
// QuickJS may be up to roughly 10x slower than host-worker for alert-class
// workloads, but the 10-bar push→drain loop must stay comfortably bounded in
// CI. This test is intentionally small; `roundTrip.bench.ts` carries the bench
// entry for `pnpm bench:ci`.
const THRESHOLD_MS = 1_500;

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
        name: "quickjs bench threshold",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 16 },
        maxLookback: 0,
    };
}

function bar(time: number): Bar {
    return {
        time,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        hl2: 1,
        hlc3: 1,
        ohlc4: 1,
        hlcc4: 1,
        volume: 0,
        symbol: "X",
        interval: "1m",
    };
}

describe("host-quickjs round-trip threshold", () => {
    it(`runs a 10-bar push→drain loop under ${THRESHOLD_MS}ms`, async () => {
        const m = manifest();
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        const startedAt = performance.now();
        await host.load({
            moduleSource: `
export default {
    manifest: ${JSON.stringify(m)},
    compute: ({ bar, plot }) => { plot("quickjs.threshold:1:1#0", bar.close, {}); },
};
`,
            manifest: m,
        });
        await host.push({
            kind: "history",
            bars: Array.from({ length: 10 }, (_, index) => bar(index + 1)),
        });
        await host.drain();
        host.dispose();

        expect(performance.now() - startedAt).toBeLessThan(THRESHOLD_MS);
    });
});
