// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner";

function caps(alertConditions: boolean): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

const BAR: Bar = {
    time: 1_700_000_000_000,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 100,
    hl2: 10.5,
    hlc3: 10.6,
    ohlc4: 10.5,
    hlcc4: 10.75,
    symbol: "DEMO",
    interval: "1D",
};

function compiled(compute: CompiledScriptObject["compute"]): CompiledScriptObject {
    return {
        manifest: {
            apiVersion: 1,
            kind: "alertCondition",
            name: "conditions",
            inputs: {},
            capabilities: ["alertConditions"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            alertConditions: [
                {
                    id: "up",
                    title: "Up",
                    description: "Close crossed up",
                    defaultMessage: "{{ticker}} up",
                },
            ],
        },
        compute,
    };
}

describe("alert-condition emission", () => {
    it("emits fired and non-fired condition transitions", async () => {
        const runner = createScriptRunner({
            compiled: compiled(({ signal }) => {
                signal?.("up", true);
                signal?.("up", false);
            }),
            capabilities: caps(true),
        });

        await runner.onBarClose(BAR);
        const out = runner.drain();

        expect(out.alertConditions).toEqual([
            {
                kind: "alert-condition",
                conditionId: "up",
                title: "Up",
                description: "Close crossed up",
                defaultMessage: "{{ticker}} up",
                fired: true,
                bar: 0,
                time: BAR.time,
            },
            {
                kind: "alert-condition",
                conditionId: "up",
                title: "Up",
                description: "Close crossed up",
                defaultMessage: "{{ticker}} up",
                fired: false,
                bar: 0,
                time: BAR.time,
            },
        ]);
        expect(out.diagnostics).toEqual([]);
    });

    it("diagnoses disabled capability once per condition id", async () => {
        const runner = createScriptRunner({
            compiled: compiled(({ signal }) => {
                signal?.("up", true);
                signal?.("up", false);
            }),
            capabilities: caps(false),
        });

        await runner.onBarClose(BAR);
        const out = runner.drain();

        expect(out.alertConditions).toEqual([]);
        expect(out.diagnostics.map((d) => d.code)).toEqual(["alert-conditions-not-supported"]);
    });

    it("diagnoses unknown condition ids", async () => {
        const runner = createScriptRunner({
            compiled: compiled(({ signal }) => {
                signal?.("missing", true);
            }),
            capabilities: caps(true),
        });

        await runner.onBarClose(BAR);
        const out = runner.drain();

        expect(out.alertConditions).toEqual([]);
        expect(out.diagnostics.map((d) => d.code)).toEqual(["unknown-alert-condition"]);
    });
});
