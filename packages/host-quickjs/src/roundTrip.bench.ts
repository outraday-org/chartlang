// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest } from "@invinite-org/chartlang-core";
import { bench, describe } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost";

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
        name: "quickjs bench",
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

const MANIFEST = manifest();
const SOURCE = `
export default {
    manifest: ${JSON.stringify(MANIFEST)},
    compute: ({ bar, plot }) => { plot("quickjs.bench:1:1#0", bar.close, {}); },
};
`;

describe("host-quickjs round-trip", () => {
    bench("10 bars → drain", async () => {
        const host = createQuickJsHost({ capabilities: makeCapabilities() });
        await host.load({ moduleSource: SOURCE, manifest: MANIFEST });
        await host.push({
            kind: "history",
            bars: Array.from({ length: 10 }, (_, index) => bar(index + 1)),
        });
        await host.drain();
        host.dispose();
    });
});
