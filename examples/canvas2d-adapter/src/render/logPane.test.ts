// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { LogEmission } from "@invinite-org/chartlang-adapter-kit";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawLogPane } from "./logPane.js";
import type { Viewport } from "./coords.js";

const VIEWPORT: Viewport = {
    xMin: 0,
    xMax: 10,
    yMin: 0,
    yMax: 10,
    pxWidth: 320,
    pxHeight: 200,
};

function log(message: string, bar: number): LogEmission {
    return {
        kind: "log",
        level: "info",
        message,
        bar,
        time: bar,
    };
}

describe("drawLogPane", () => {
    it("renders the latest five log messages", () => {
        const ctx = new MockCanvas2DContext();
        drawLogPane(
            ctx,
            [log("a", 1), log("b", 2), log("c", 3), log("d", 4), log("e", 5), log("f", 6)],
            VIEWPORT,
            DEFAULT_PALETTE,
        );
        const text = ctx.calls.filter((c) => c.kind === "fillText").map((c) => c.text);
        expect(text).toEqual(["[info] b", "[info] c", "[info] d", "[info] e", "[info] f"]);
    });

    it("does nothing for an empty log list", () => {
        const ctx = new MockCanvas2DContext();
        drawLogPane(ctx, [], VIEWPORT, DEFAULT_PALETTE);
        expect(ctx.calls.some((c) => c.kind === "fillText")).toBe(false);
    });
});
