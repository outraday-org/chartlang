// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { decodeDrawing } from "./decodeDrawing";
import type { DrawingEmission } from "../types";

describe("decodeDrawing", () => {
    it("always returns null (Phase-1 stub)", () => {
        const e: DrawingEmission = {
            kind: "drawing",
            handleId: "x",
            drawingKind: "line",
            op: "create",
            state: null,
            bar: 0,
            time: 0,
        };
        expect(decodeDrawing(e)).toBeNull();
    });
});
