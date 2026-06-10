// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import type { DrawingEmission } from "../types.js";
import { decodeDrawing } from "./decodeDrawing.js";

const wellFormedLine: DrawingEmission = {
    kind: "drawing",
    handleId: "h1",
    drawingKind: "line",
    op: "create",
    state: {
        kind: "line",
        anchors: [
            { time: 0, price: 0 },
            { time: 1, price: 1 },
        ],
        style: {},
    },
    bar: 0,
    time: 0,
};

describe("decodeDrawing", () => {
    it("returns the typed DrawingState for a well-formed emission", () => {
        const result = decodeDrawing(wellFormedLine);
        expect(result).not.toBeNull();
        if (result === null) return;
        expect(result.kind).toBe("line");
        if (result.kind === "line") {
            expect(result.anchors[0]).toEqual({ time: 0, price: 0 });
            expect(result.anchors[1]).toEqual({ time: 1, price: 1 });
        }
    });

    it("returns null when the state shape is malformed (anchor not a WorldPoint)", () => {
        const malformed = {
            ...wellFormedLine,
            state: {
                kind: "line",
                anchors: [
                    { time: 0, price: 0 },
                    { time: Number.NaN, price: 1 },
                ],
                style: {},
            },
        } as unknown as DrawingEmission;
        expect(decodeDrawing(malformed)).toBeNull();
    });

    it("returns null when state.kind !== drawingKind", () => {
        const mismatched = {
            ...wellFormedLine,
            state: {
                kind: "horizontal-line",
                price: 100,
                style: {},
            },
        } as unknown as DrawingEmission;
        expect(decodeDrawing(mismatched)).toBeNull();
    });

    it("returns null when the drawingKind is unknown", () => {
        const unknown = {
            ...wellFormedLine,
            drawingKind: "not-a-kind",
        } as unknown as DrawingEmission;
        expect(decodeDrawing(unknown)).toBeNull();
    });
});
