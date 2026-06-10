// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertConditionEmission } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawAlertConditions } from "./alertConditions.js";
import type { Viewport } from "./coords.js";

const VIEWPORT: Viewport = {
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    pxWidth: 320,
    pxHeight: 200,
};

const BASE: AlertConditionEmission = {
    kind: "alert-condition",
    conditionId: "up",
    title: "Up",
    description: "desc",
    defaultMessage: "{{ticker}} up",
    fired: true,
    bar: 0,
    time: 0,
};

describe("drawAlertConditions", () => {
    it("draws condition id and default message for fired conditions", () => {
        const ctx = new MockCanvas2DContext();
        drawAlertConditions(ctx, [BASE], VIEWPORT, DEFAULT_PALETTE);

        expect(ctx.calls).toContainEqual({
            kind: "fillText",
            text: "up: {{ticker}} up",
            x: 140,
            y: 18,
        });
    });

    it("does not draw non-fired conditions", () => {
        const ctx = new MockCanvas2DContext();
        drawAlertConditions(ctx, [{ ...BASE, fired: false }], VIEWPORT, DEFAULT_PALETTE);

        expect(ctx.calls).toEqual([]);
    });
});
