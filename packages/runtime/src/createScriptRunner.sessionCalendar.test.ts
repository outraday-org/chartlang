// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, CompiledScriptObject, SessionCalendarDay } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner.js";
import { type CompiledModuleExport, buildBundleFromModule } from "./loadBundle.js";

// 2024-11-29 is the Black Friday half day (13:00 close); the bars below sit on
// that day in UTC so the calendar row and the accessor's `splitEpoch`-derived
// day key have to agree for the script to see the truncated session.
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
        maxLookback: 10,
        maxTickHz: 10,
    };
}

function barAt(hour: number): Bar {
    const time = Date.UTC(2024, 10, 29, hour, 0, 0);
    return {
        time,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1,
        symbol: "AAPL",
        interval: "1h",
    };
}

// A script that records whether the RTH window is open on each bar it sees.
function recordingScript(sink: boolean[]): CompiledScriptObject {
    return defineIndicator({
        name: "session-probe",
        apiVersion: 1,
        compute: (ctx) => {
            sink.push(ctx.session.isOpen(ctx.bar.time, "0930-1600"));
        },
    });
}

async function runAt(
    hours: ReadonlyArray<number>,
    sessionCalendar?: ReadonlyArray<SessionCalendarDay>,
): Promise<boolean[]> {
    const sink: boolean[] = [];
    const runner = createScriptRunner({
        compiled: recordingScript(sink),
        capabilities: makeCapabilities(),
        ...(sessionCalendar === undefined ? {} : { sessionCalendar }),
    });
    for (const hour of hours) await runner.onBarClose(barAt(hour));
    await runner.dispose();
    return sink;
}

describe("createScriptRunner — sessionCalendar", () => {
    it("gives the script a calendar-aware session.isOpen", async () => {
        expect(await runAt([10, 12, 13, 15], HALF_DAY)).toEqual([true, true, false, false]);
    });

    it("is byte-identical to the calendar-less path when omitted", async () => {
        expect(await runAt([10, 12, 13, 15])).toEqual([true, true, true, true]);
    });

    it("rejects a malformed calendar row at mount", () => {
        expect(() =>
            createScriptRunner({
                compiled: recordingScript([]),
                capabilities: makeCapabilities(),
                sessionCalendar: [
                    { dayKey: "2024-11-29", kind: "halfDay" } as unknown as SessionCalendarDay,
                ],
            }),
        ).toThrow(/needs an integer closeMinutes/);
    });

    it("is inherited by private deps and drawn siblings", async () => {
        const primarySink: boolean[] = [];
        const depSink: boolean[] = [];
        const siblingSink: boolean[] = [];
        const primary = recordingScript(primarySink);
        const sibling = recordingScript(siblingSink);
        // A real compiled bundle always carries the `__manifest` sidecar, and a
        // multi-export one carries it as an ARRAY whose tail entries name their
        // export; a stub sidecar is refused by `buildBundleFromModule`.
        const manifest = {
            ...primary.manifest,
            maxLookback: 1,
            seriesCapacities: Object.freeze({ ohlcv: 2 }),
        };
        const mod = {
            default: primary,
            sib: sibling,
            __manifest: [manifest, { ...manifest, exportName: "sib" }],
            __dependencies: [{ localId: "dep", compiled: recordingScript(depSink) }],
        } as unknown as CompiledModuleExport;
        const runner = createScriptRunner({
            compiled: buildBundleFromModule(mod),
            capabilities: makeCapabilities(),
            sessionCalendar: HALF_DAY,
        });
        await runner.onBarClose(barAt(15));
        await runner.dispose();
        expect(primarySink).toEqual([false]);
        expect(depSink).toEqual([false]);
        expect(siblingSink).toEqual([false]);
    });
});
