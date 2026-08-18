// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableRunnerEmissions } from "../runtimeContext.js";
import { pushAlert, pushAlertCondition, pushLog, pushOrder, pushPlot } from "./emissionsQueue.js";
import { drain } from "../execution/drain.js";
import type { RunnerState } from "../createScriptRunner.js";
import { describe, expect, it } from "vitest";

function queue(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        orders: [],
        diagnostics: [],
        fromBar: 1,
        toBar: 1,
        logs: [],
    };
}

describe("emissions queue edge paths", () => {
    it("diagnoses malformed plot and alert emissions", () => {
        const emissions = queue();

        pushPlot(emissions, {
            kind: "plot",
            slotId: "",
            value: 1,
            style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
            color: null,
            pane: "overlay",
            title: "",
            meta: {},
            bar: 0,
            time: 1,
        });
        pushAlert(emissions, {
            kind: "alert",
            slotId: "",
            message: "bad",
            severity: "info",
            channels: [],
            dedupeKey: "bad",
            bar: 0,
            time: 1,
        });

        expect(emissions.plots).toEqual([]);
        expect(emissions.alerts).toEqual([]);
        expect(emissions.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "malformed-emission",
            "malformed-emission",
        ]);
    });

    it("diagnoses malformed alert condition emissions and leaves the queue unset", () => {
        const emissions = queue();

        pushAlertCondition(emissions, {
            kind: "alert-condition",
            conditionId: "",
            title: "Bad condition",
            description: "",
            defaultMessage: "",
            fired: true,
            bar: 0,
            time: 1,
        });

        expect(emissions.alertConditions).toBeUndefined();
        expect(emissions.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "malformed-emission",
        ]);
    });

    it("appends valid alert conditions into an existing queue", () => {
        const emissions = { ...queue(), alertConditions: [] };

        pushAlertCondition(emissions, {
            kind: "alert-condition",
            conditionId: "up",
            title: "Up",
            description: "",
            defaultMessage: "",
            fired: false,
            bar: 0,
            time: 1,
        });

        expect(emissions.alertConditions).toHaveLength(1);
        expect(emissions.diagnostics).toEqual([]);
    });

    it("creates the alert condition queue for the first valid emission", () => {
        const emissions = queue();

        pushAlertCondition(emissions, {
            kind: "alert-condition",
            conditionId: "up",
            title: "Up",
            description: "",
            defaultMessage: "",
            fired: true,
            bar: 0,
            time: 1,
        });

        expect(emissions.alertConditions).toHaveLength(1);
    });

    it("diagnoses malformed log emissions and drops the log", () => {
        const emissions = queue();

        pushLog(emissions, {
            kind: "log",
            level: "info",
            message: "",
            bar: 0,
            time: 1,
        });

        expect(emissions.logs).toEqual([]);
        expect(emissions.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "malformed-emission",
        ]);
    });

    it("diagnoses a malformed order emission, drops it, and reports false", () => {
        const emissions = queue();

        const queued = pushOrder(emissions, {
            kind: "order",
            slotId: "o:1:1#0",
            action: "buy",
            qty: 0,
            label: "",
            bar: 2,
            time: 1,
            meta: {},
            dedupeKey: "o:1:1#0::2::deadbeef",
        });

        expect(queued).toBe(false);
        expect(emissions.orders).toEqual([]);
        expect(emissions.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "malformed-emission",
        ]);
        expect(emissions.diagnostics[0].slotId).toBe("o:1:1#0");
        expect(emissions.diagnostics[0].bar).toBe(2);
    });

    it("appends orders without deduping (same slot, same bar) and reports true", () => {
        const emissions = queue();
        const base = {
            kind: "order",
            slotId: "o:1:1#0",
            action: "buy",
            qty: null,
            label: "",
            bar: 3,
            time: 1,
            meta: {},
            dedupeKey: "o:1:1#0::3::deadbeef",
        } as const;

        expect(pushOrder(emissions, { ...base, label: "first" })).toBe(true);
        expect(pushOrder(emissions, { ...base, label: "second" })).toBe(true);

        // Append-only: `pushAlert` would have replaced the first entry here.
        expect(emissions.orders.map((order) => order.label)).toEqual(["first", "second"]);
        expect(emissions.diagnostics).toEqual([]);
    });

    it("drains the order queue by reference and hands the runner a fresh array", () => {
        const emissions = queue();
        pushOrder(emissions, {
            kind: "order",
            slotId: "o:1:1#0",
            action: "sell",
            qty: 2,
            label: "S",
            bar: 1,
            time: 1,
            meta: {},
            dedupeKey: "o:1:1#0::1::deadbeef",
        });
        const state = { emissions } as RunnerState;

        const out = drain(state);

        expect(Object.isFrozen(out)).toBe(true);
        expect(out.orders).toHaveLength(1);
        expect(state.emissions.orders).toEqual([]);
        expect(drain(state).orders).toEqual([]);
    });

    it("drains to an empty alertConditions array when the mutable queue omits it", () => {
        const emissions = queue();
        const state = { emissions } as RunnerState;

        const out = drain(state);

        expect(out.alertConditions).toEqual([]);
        expect(state.emissions.alertConditions).toEqual([]);
    });
});
