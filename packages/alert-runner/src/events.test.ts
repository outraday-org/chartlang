// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { projectEvents } from "./events.js";

const EMPTY: RunnerEmissions = {
    plots: [],
    drawings: [],
    alerts: [],
    alertConditions: [],
    orders: [],
    logs: [],
    diagnostics: [],
    fromBar: 0,
    toBar: 0,
};

const alert = (slotId: string, time: number) => ({
    kind: "alert" as const,
    slotId,
    severity: "info" as const,
    message: `m-${slotId}`,
    bar: 3,
    time,
    meta: { a: 1 },
    channels: ["webhook" as const],
    dedupeKey: "runtime-key",
});

const signal = (conditionId: string, fired: boolean) => ({
    kind: "alert-condition" as const,
    conditionId,
    title: "T",
    description: "D",
    defaultMessage: "M",
    fired,
    bar: 3,
    time: 50,
});

describe("projectEvents", () => {
    it("maps alerts and fired conditions with stable keys", () => {
        const events = projectEvents(
            {
                ...EMPTY,
                alerts: [alert("s", 50)],
                alertConditions: [signal("up", true), signal("down", false)],
            },
            "close",
            0,
            "once_per_bar",
        );
        expect(events).toEqual([
            {
                kind: "alert",
                id: "s",
                message: "m-s",
                severity: "info",
                meta: { a: 1 },
                bar: 3,
                time: 50,
                dedupeKey: "alert:s:50",
                phase: "close",
            },
            {
                kind: "condition",
                id: "up",
                title: "T",
                message: "M",
                meta: { description: "D" },
                bar: 3,
                time: 50,
                dedupeKey: "condition:up:50",
                phase: "close",
            },
        ]);
    });

    it("suffixes every_time pre-close keys and repeated ids", () => {
        const events = projectEvents(
            {
                ...EMPTY,
                alertConditions: [signal("up", true), signal("up", true), signal("up", true)],
            },
            "preClose",
            900,
            "every_time",
        );
        expect(events.map((e) => e.dedupeKey)).toEqual([
            "condition:up:50:pre:900",
            "condition:up:50:pre:900#1",
            "condition:up:50:pre:900#2",
        ]);
        expect(
            projectEvents({ ...EMPTY, alerts: [alert("s", 50)] }, "preClose", 900, "once")[0]
                ?.dedupeKey,
        ).toBe("alert:s:50");
    });
});
