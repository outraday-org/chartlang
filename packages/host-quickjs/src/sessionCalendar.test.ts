// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, ScriptManifest, SessionCalendarDay } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createQuickJsHost } from "./createQuickJsHost.js";
import type { ScriptHost } from "./types.js";

// 2024-11-29 is the Black Friday half day (13:00 close), so the 15:00 bar is
// inside the nominal 09:30-16:00 window but outside the real session.
const HALF_DAY: ReadonlyArray<SessionCalendarDay> = [
    { dayKey: "2024-11-29", kind: "halfDay", closeMinutes: 13 * 60 },
];

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
        multiSymbol: false,
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
        name: "session-probe",
        inputs: {},
        capabilities: ["indicators"],
        requestedIntervals: [],
        userPickableInterval: false,
        seriesCapacities: { ohlcv: 8 },
        maxLookback: 0,
    };
}

const SESSION_PROBE_SOURCE = `
export default {
    manifest: ${JSON.stringify(manifest())},
    compute: (ctx) => {
        const open = ctx.session.isOpen(ctx.bar.time, "0930-1600");
        ctx.plot("probe.chart.ts:1:1#0", open ? 1 : 0, {});
    },
};
`;

function compiled(): Parameters<ScriptHost["load"]>[0] {
    return { moduleSource: SESSION_PROBE_SOURCE, manifest: manifest() };
}

function barAt(hour: number): Bar {
    return {
        time: Date.UTC(2024, 10, 29, hour, 0, 0),
        open: 10,
        high: 10,
        low: 10,
        close: 10,
        volume: 1,
        symbol: "X",
        interval: "1h",
    };
}

async function probe(sessionCalendar?: ReadonlyArray<SessionCalendarDay>): Promise<number[]> {
    const host = createQuickJsHost({
        capabilities: makeCapabilities(),
        ...(sessionCalendar === undefined ? {} : { sessionCalendar }),
    });
    await host.load(compiled());
    const values: number[] = [];
    for (const hour of [10, 12, 13, 15]) {
        await host.push({ kind: "close", bar: barAt(hour) });
        const emissions = await host.drain();
        for (const plot of emissions.plots) values.push(plot.value);
    }
    host.dispose();
    return values;
}

describe("createQuickJsHost — sessionCalendar (real QuickJS)", () => {
    // This is the load-bearing half of the Option-A ruling: the rows have to
    // survive the JSON membrane, be rebuilt guest-side by the runner, and reach
    // the script's `session.isOpen` through the REGENERATED dispatcher bundle.
    it("gives a guest script a calendar-aware session.isOpen", async () => {
        expect(await probe(HALF_DAY)).toEqual([1, 1, 0, 0]);
    });

    it("leaves the session untruncated when the option is omitted", async () => {
        expect(await probe()).toEqual([1, 1, 1, 1]);
    });
});
