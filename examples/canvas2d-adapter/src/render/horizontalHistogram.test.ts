// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawHorizontalHistogram } from "./horizontalHistogram";
import type { Viewport } from "./coords";

const VIEWPORT: Viewport = { xMin: 0, xMax: 1, yMin: 0, yMax: 100, pxWidth: 100, pxHeight: 100 };

describe("drawHorizontalHistogram", () => {
    it("scales bucket width linearly by max volume", () => {
        const ctx = new MockCanvas2DContext();
        drawHorizontalHistogram(
            ctx,
            {
                maxWidth: 40,
                rowHeight: 4,
                buckets: [
                    { price: 25, volume: 5, color: "#123" },
                    { price: 50, volume: 10 },
                ],
            },
            VIEWPORT,
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#123" },
            { kind: "fillRect", x: 80, y: 73, w: 20, h: 4 },
            { kind: "set", prop: "fillStyle", value: DEFAULT_PALETTE.plotDefault },
            { kind: "fillRect", x: 60, y: 48, w: 40, h: 4 },
        ]);
    });

    it("emits no calls when all volumes are zero", () => {
        const ctx = new MockCanvas2DContext();
        drawHorizontalHistogram(
            ctx,
            { maxWidth: 40, rowHeight: 4, buckets: [{ price: 25, volume: 0 }] },
            VIEWPORT,
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([]);
    });
});
