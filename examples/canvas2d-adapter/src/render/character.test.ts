// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette";
import { MockCanvas2DContext } from "../testing";
import { drawCharacter } from "./character";

describe("drawCharacter", () => {
    it("renders text with deterministic font and anchor", () => {
        const ctx = new MockCanvas2DContext();
        drawCharacter(
            ctx,
            { x: 10, y: 20, char: "A", size: 12, location: "above", color: "#abc" },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#abc" },
            { kind: "set", prop: "font", value: "12px sans-serif" },
            { kind: "set", prop: "textAlign", value: "center" },
            { kind: "set", prop: "textBaseline", value: "bottom" },
            { kind: "fillText", text: "A", x: 10, y: 8 },
        ]);
    });

    it("renders below and absolute anchors", () => {
        const below = new MockCanvas2DContext();
        drawCharacter(
            below,
            { x: 10, y: 20, char: "B", size: 12, location: "below", color: null },
            DEFAULT_PALETTE,
        );
        expect(below.calls.at(-1)).toEqual({ kind: "fillText", text: "B", x: 10, y: 32 });

        const absolute = new MockCanvas2DContext();
        drawCharacter(
            absolute,
            { x: 10, y: 20, char: "C", size: 12, color: null },
            DEFAULT_PALETTE,
        );
        expect(absolute.calls[3]).toEqual({
            kind: "set",
            prop: "textBaseline",
            value: "middle",
        });
    });
});
