// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { clearPaneRect } from "./clearPaneRect.js";
import type { PaneRect } from "./paneLayout.js";

const RECTS: ReadonlyArray<PaneRect> = [
    { x: 0, y: 280, w: 800, h: 120 },
    { x: 0, y: 0, w: 800, h: 280 },
];

describe("clearPaneRect", () => {
    for (const rect of RECTS) {
        it(`emits set fillStyle then fillRect for ${JSON.stringify(rect)}`, () => {
            const ctx = new MockCanvas2DContext();
            clearPaneRect(ctx, rect, DEFAULT_PALETTE);
            expect(ctx.calls).toEqual([
                { kind: "set", prop: "fillStyle", value: DEFAULT_PALETTE.background },
                { kind: "fillRect", x: rect.x, y: rect.y, w: rect.w, h: rect.h },
            ]);
        });
    }
});
