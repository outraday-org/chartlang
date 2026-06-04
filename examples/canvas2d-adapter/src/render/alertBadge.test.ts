// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawAlertBadge } from "./alertBadge";

function alert(severity: AlertEmission["severity"]): AlertEmission {
    return {
        kind: "alert",
        slotId: "demo.chart.ts:1:1#0",
        severity,
        message: "x",
        bar: 0,
        time: 0,
        meta: {},
        channels: ["log"],
        dedupeKey: "k",
    };
}

describe("drawAlertBadge", () => {
    it("emits one arc + fill per call", () => {
        const ctx = new MockCanvas2DContext();
        drawAlertBadge(ctx, alert("info"), { x: 10, y: 20 }, DEFAULT_PALETTE);
        expect(ctx.calls.filter((c) => c.kind === "arc").length).toBe(1);
        expect(ctx.calls.filter((c) => c.kind === "fill").length).toBe(1);
    });

    it("maps severity → palette colour", () => {
        const info = new MockCanvas2DContext();
        drawAlertBadge(info, alert("info"), { x: 0, y: 0 }, DEFAULT_PALETTE);
        const setI = info.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setI).toEqual({ kind: "set", prop: "fillStyle", value: DEFAULT_PALETTE.alertInfo });

        const warn = new MockCanvas2DContext();
        drawAlertBadge(warn, alert("warning"), { x: 0, y: 0 }, DEFAULT_PALETTE);
        const setW = warn.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setW).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.alertWarning,
        });

        const crit = new MockCanvas2DContext();
        drawAlertBadge(crit, alert("critical"), { x: 0, y: 0 }, DEFAULT_PALETTE);
        const setC = crit.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setC).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.alertCritical,
        });
    });
});
