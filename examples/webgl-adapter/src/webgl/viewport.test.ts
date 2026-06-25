// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/viewport.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it } from "vitest";

import { paneViewport } from "./viewport.js";

describe("paneViewport", () => {
    it("flips Y for a 100×80 pane in a 600×400 canvas at DPR=1", () => {
        const rect = paneViewport({ height: 80, width: 100, x: 50, y: 60 }, 400, 1);

        // x = 50, y = (400 - 60 - 80) = 260
        expect(rect.xPx).toBe(50);

        expect(rect.yPx).toBe(260);

        expect(rect.widthPx).toBe(100);

        expect(rect.heightPx).toBe(80);
    });

    it("multiplies all components by DPR for the same pane at DPR=2", () => {
        const rect = paneViewport({ height: 80, width: 100, x: 50, y: 60 }, 400, 2);

        // x = 100, y = (400-60-80) * 2 = 520
        expect(rect.xPx).toBe(100);

        expect(rect.yPx).toBe(520);

        expect(rect.widthPx).toBe(200);

        expect(rect.heightPx).toBe(160);
    });

    it("places the pane at the canvas top-left when pane.y = 0", () => {
        const rect = paneViewport({ height: 100, width: 200, x: 0, y: 0 }, 400, 1);

        // bottom-left origin: pane occupies the top, so yPx = canvasH - 0 - 100 = 300
        expect(rect.xPx).toBe(0);

        expect(rect.yPx).toBe(300);

        expect(rect.widthPx).toBe(200);

        expect(rect.heightPx).toBe(100);
    });

    it("places the pane at device-bottom when the pane is at the canvas bottom", () => {
        const rect = paneViewport({ height: 100, width: 200, x: 0, y: 300 }, 400, 1);

        // y = 400 - 300 - 100 = 0
        expect(rect.yPx).toBe(0);
    });

    it("rounds each edge once so adjacent fractional panes share an integer seam", () => {
        const upper = paneViewport({ height: 100.4, width: 100, x: 0, y: 0 }, 300, 1);

        const lower = paneViewport({ height: 199.6, width: 100, x: 0, y: 100.4 }, 300, 1);

        // Per-edge rounding: each shared CSS-edge passes through the
        // same Math.round(edge × dpr) so the seam is integer-tight.
        //
        // upper: top = round(300) = 300, bottom = round(199.6) = 200
        //        → yPx = 200, heightPx = 100
        // lower: top = round(199.6) = 200, bottom = round(0) = 0
        //        → yPx = 0, heightPx = 200
        expect(upper.yPx).toBe(200);

        expect(upper.heightPx).toBe(100);

        expect(lower.yPx).toBe(0);

        expect(lower.heightPx).toBe(200);

        // Their device-pixel seam aligns: upper.yPx === lower.yPx + lower.heightPx.
        // The shared CSS-y boundary (100.4) rounds the same way on both
        // sides because it passes through `Math.round(edge × dpr)` once.
        expect(upper.yPx).toBe(lower.yPx + lower.heightPx);
    });
});
