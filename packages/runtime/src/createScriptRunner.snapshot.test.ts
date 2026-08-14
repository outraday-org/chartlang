// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator, isSnapshotError } from "@invinite-org/chartlang-core";
import type { Bar, MutableSlot, StateSnapshot } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner.js";
import type { RuntimeTaNamespace } from "./ta/index.js";

type RuntimeStateNamespace = {
    readonly int: (slotId: string, init: number) => MutableSlot<number>;
};
type RuntimeTaSubset = Pick<RuntimeTaNamespace, "sma">;

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
        maxLookback: 50,
        maxTickHz: 10,
    };
}

function makeBar(i: number): Bar {
    const open = 100 + i;
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open,
        high: open + 2,
        low: open - 2,
        close: open + 1,
        volume: 1_000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

/**
 * A script whose output depends on BOTH a `ta.*` accumulator and a `state.*`
 * slot, so an equivalence check across a snapshot boundary fails if either
 * family is left behind.
 */
function makeCompiled(sink: number[]): ReturnType<typeof defineIndicator> {
    const compiled = defineIndicator({
        name: "snapshot-demo",
        apiVersion: 1,
        compute: ({ bar, state, ta }) => {
            const runtimeState = state as unknown as RuntimeStateNamespace;
            const runtimeTa = ta as unknown as RuntimeTaSubset;
            const counter = runtimeState.int("counter", 0);
            counter.value += 1;
            const sma = runtimeTa.sma("sma", bar.close, 5);
            sink.push(sma.current + counter.value);
        },
    });
    return { ...compiled, manifest: { ...compiled.manifest, maxLookback: 50 } };
}

describe("ScriptRunner.exportSnapshot", () => {
    it("captures a bar-less runner with barIndex -1", () => {
        const runner = createScriptRunner({
            compiled: makeCompiled([]),
            capabilities: makeCapabilities(),
        });
        const snapshot = runner.exportSnapshot();
        expect(snapshot?.barIndex).toBe(-1);
        expect(snapshot?.snapshotVersion).toBe(2);
    });

    it("stamps the last folded bar after N closes", async () => {
        const runner = createScriptRunner({
            compiled: makeCompiled([]),
            capabilities: makeCapabilities(),
        });
        for (let i = 0; i < 6; i += 1) await runner.onBarClose(makeBar(i));
        expect(runner.exportSnapshot()?.barIndex).toBe(5);
    });
});

describe("ScriptRunner.importSnapshot", () => {
    it("round-trips: a resumed runner matches an uninterrupted one", async () => {
        const straight: number[] = [];
        const control = createScriptRunner({
            compiled: makeCompiled(straight),
            capabilities: makeCapabilities(),
        });
        for (let i = 0; i < 12; i += 1) await control.onBarClose(makeBar(i));

        const firstLeg: number[] = [];
        const cold = createScriptRunner({
            compiled: makeCompiled(firstLeg),
            capabilities: makeCapabilities(),
        });
        for (let i = 0; i < 7; i += 1) await cold.onBarClose(makeBar(i));
        const snapshot = cold.exportSnapshot();
        expect(snapshot).not.toBeNull();

        const secondLeg: number[] = [];
        const warm = createScriptRunner({
            compiled: makeCompiled(secondLeg),
            capabilities: makeCapabilities(),
        });
        const ack = warm.importSnapshot(snapshot as StateSnapshot);
        expect(ack).toEqual({ barIndex: 6 });
        for (let i = ack.barIndex + 1; i < 12; i += 1) await warm.onBarClose(makeBar(i));

        expect([...firstLeg, ...secondLeg]).toEqual(straight);
    });

    it("reports barIndex -1 for a snapshot captured before any bar closed", () => {
        const source = createScriptRunner({
            compiled: makeCompiled([]),
            capabilities: makeCapabilities(),
        });
        const target = createScriptRunner({
            compiled: makeCompiled([]),
            capabilities: makeCapabilities(),
        });
        expect(target.importSnapshot(source.exportSnapshot() as StateSnapshot)).toEqual({
            barIndex: -1,
        });
    });

    it("throws a SnapshotError on a malformed payload", () => {
        const runner = createScriptRunner({
            compiled: makeCompiled([]),
            capabilities: makeCapabilities(),
        });
        expect(() => runner.importSnapshot({ nope: true } as unknown as StateSnapshot)).toThrow(
            /failed validation/,
        );
        try {
            runner.importSnapshot({ nope: true } as unknown as StateSnapshot);
        } catch (err) {
            expect(isSnapshotError(err)).toBe(true);
        }
    });

    it("rejects a version-1 payload rather than coercing it", () => {
        const runner = createScriptRunner({
            compiled: makeCompiled([]),
            capabilities: makeCapabilities(),
        });
        const v1 = JSON.parse(
            '{"snapshotVersion":1,"lastBarTime":0,"streams":{},"savedAt":0,"slots":{}}',
        ) as StateSnapshot;
        expect(() => runner.importSnapshot(v1)).toThrow(/failed validation/);
    });
});
