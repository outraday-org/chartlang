// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableRunnerEmissions } from "../runtimeContext.js";
import { pushAlert, pushAlertCondition, pushLog, pushPlot } from "./emissionsQueue.js";
import { drain } from "../execution/drain.js";
import type { RunnerState } from "../createScriptRunner.js";
import { describe, expect, it } from "vitest";

function queue(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
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

    it("drains to an empty alertConditions array when the mutable queue omits it", () => {
        const emissions = queue();
        const state = { emissions } as RunnerState;

        const out = drain(state);

        expect(out.alertConditions).toEqual([]);
        expect(state.emissions.alertConditions).toEqual([]);
    });
});
