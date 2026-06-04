// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { clear } from "./clear";
import type { Viewport } from "./coords";

const viewport: Viewport = {
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    pxWidth: 320,
    pxHeight: 240,
};

describe("clear", () => {
    it("emits one clearRect and one background fillRect covering the canvas", () => {
        const ctx = new MockCanvas2DContext();
        clear(ctx, viewport, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([
            { kind: "clearRect", x: 0, y: 0, w: 320, h: 240 },
            { kind: "set", prop: "fillStyle", value: DEFAULT_PALETTE.background },
            { kind: "fillRect", x: 0, y: 0, w: 320, h: 240 },
        ]);
    });
});
