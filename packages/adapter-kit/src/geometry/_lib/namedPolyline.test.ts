// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { namedPolylinePrimitives } from "./namedPolyline.js";

describe("namedPolylinePrimitives", () => {
    it("returns [] for an empty point list", () => {
        expect(namedPolylinePrimitives([], [], {})).toEqual([]);
    });

    it("emits one open polyline plus one text per vertex", () => {
        const prims = namedPolylinePrimitives(
            [
                { x: 0, y: 0 },
                { x: 10, y: 5 },
            ],
            ["X", "A"],
            {},
        );
        expect(prims).toHaveLength(3);
        const poly = prims[0];
        expect(poly.kind).toBe("polyline");
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(false);
            expect(poly.stroke).toEqual({ color: "#f59e0b", width: 1, dash: [] });
        }
        const label = prims[1];
        expect(label.kind).toBe("text");
        if (label.kind === "text") {
            expect(label).toMatchObject({
                text: "X",
                y: -6,
                align: "center",
                baseline: "bottom",
                font: "11px sans-serif",
            });
        }
    });

    it("honours explicit colour and width on the polyline + labels", () => {
        const prims = namedPolylinePrimitives([{ x: 0, y: 0 }], ["B"], {
            color: "#123456",
            lineWidth: 3,
        });
        const poly = prims[0];
        if (poly.kind === "polyline") {
            expect(poly.stroke).toEqual({ color: "#123456", width: 3, dash: [] });
        }
        const label = prims[1];
        if (label.kind === "text") {
            expect(label.color).toBe("#123456");
        }
    });
});
