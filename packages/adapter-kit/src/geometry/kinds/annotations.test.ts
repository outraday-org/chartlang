// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    ArrowMarkDownState,
    ArrowMarkUpState,
    ArrowMarkerState,
    ArrowState,
    TextState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../types.js";
import {
    decomposeArrow,
    decomposeArrowMarkDown,
    decomposeArrowMarkUp,
    decomposeArrowMarker,
    decomposeText,
} from "./annotations.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

describe("decomposeText", () => {
    it("emits one text primitive with resolved font/align/color", () => {
        const state: TextState = {
            kind: "text",
            anchor: { time: 5, price: 5 },
            body: "Hi",
            style: { size: "large", halign: "left", valign: "top", color: "#222" },
        };
        const prims = decomposeText(state, view);
        expect(prims).toHaveLength(1);
        const t = prims[0];
        if (t.kind === "text") {
            expect(t).toMatchObject({
                x: 50,
                y: 50,
                text: "Hi",
                color: "#222",
                font: "16px sans-serif",
                align: "left",
                baseline: "top",
            });
            expect(t.bgColor).toBeUndefined();
        }
    });

    it("carries bgColor onto the primitive when set", () => {
        const state: TextState = {
            kind: "text",
            anchor: { time: 0, price: 0 },
            body: "x",
            style: { bgColor: "#fef3c7" },
        };
        const t = decomposeText(state, view)[0];
        if (t.kind === "text") {
            expect(t.bgColor).toBe("#fef3c7");
        }
    });
});

describe("decomposeArrow", () => {
    it("emits a shaft, a filled arrowhead, and no label by default", () => {
        const state: ArrowState = {
            kind: "arrow",
            anchors: [
                { time: 0, price: 5 },
                { time: 5, price: 5 },
            ],
            style: {},
        };
        const prims = decomposeArrow(state, view);
        expect(prims.map((p) => p.kind)).toEqual(["polyline", "polyline"]);
        const shaft = prims[0];
        const head = prims[1];
        if (shaft.kind === "polyline") {
            expect(shaft.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
        }
        if (head.kind === "polyline") {
            expect(head.closed).toBe(true);
            expect(head.fill).toEqual({ color: "#000000", alpha: 1 });
            expect(head.stroke).toBeUndefined();
        }
    });

    it("adds a label primitive at the shaft midpoint when set", () => {
        const state: ArrowState = {
            kind: "arrow",
            anchors: [
                { time: 0, price: 0 },
                { time: 2, price: 0 },
            ],
            style: { label: "Sell", color: "#dc2626" },
        };
        const prims = decomposeArrow(state, view);
        expect(prims).toHaveLength(3);
        const label = prims[2];
        if (label.kind === "text") {
            expect(label.text).toBe("Sell");
            expect(label.color).toBe("#dc2626");
            expect(label.align).toBe("center");
            expect(label.baseline).toBe("bottom");
        }
    });
});

describe("decomposeArrowMarker", () => {
    it("emits a dot, a stub, an arrowhead, and no text by default", () => {
        const state: ArrowMarkerState = {
            kind: "arrow-marker",
            anchor: { time: 5, price: 5 },
            style: {},
        };
        const prims = decomposeArrowMarker(state, view);
        expect(prims.map((p) => p.kind)).toEqual(["arc", "polyline", "polyline"]);
        const dot = prims[0];
        if (dot.kind === "arc") {
            expect({ cx: dot.cx, cy: dot.cy, r: dot.r }).toEqual({ cx: 50, cy: 50, r: 3 });
            expect(dot.fill).toEqual({ color: "#3b82f6", alpha: 1 });
        }
    });

    it("adds text to the right of the dot when set", () => {
        const state: ArrowMarkerState = {
            kind: "arrow-marker",
            anchor: { time: 0, price: 0 },
            style: { text: "Long", color: "#10b981" },
        };
        const prims = decomposeArrowMarker(state, view);
        expect(prims).toHaveLength(4);
        const t = prims[3];
        if (t.kind === "text") {
            expect(t.text).toBe("Long");
            expect(t.color).toBe("#10b981");
            expect(t.align).toBe("left");
        }
    });
});

describe("decomposeArrowMarkUp", () => {
    it("emits a filled green up-chevron by default", () => {
        const state: ArrowMarkUpState = {
            kind: "arrow-mark-up",
            anchor: { time: 5, price: 5 },
            style: {},
        };
        const poly = decomposeArrowMarkUp(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.closed).toBe(true);
            expect(poly.fill).toEqual({ color: "#22c55e", alpha: 1 });
            expect(poly.points[0]).toEqual({ x: 50, y: 45 });
        }
    });

    it("honours an explicit colour", () => {
        const state: ArrowMarkUpState = {
            kind: "arrow-mark-up",
            anchor: { time: 0, price: 0 },
            style: { color: "#abc" },
        };
        const poly = decomposeArrowMarkUp(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill?.color).toBe("#abc");
        }
    });
});

describe("decomposeArrowMarkDown", () => {
    it("emits a filled red down-chevron by default", () => {
        const state: ArrowMarkDownState = {
            kind: "arrow-mark-down",
            anchor: { time: 5, price: 5 },
            style: {},
        };
        const poly = decomposeArrowMarkDown(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill).toEqual({ color: "#ef4444", alpha: 1 });
            expect(poly.points[0]).toEqual({ x: 50, y: 55 });
        }
    });

    it("honours an explicit colour", () => {
        const state: ArrowMarkDownState = {
            kind: "arrow-mark-down",
            anchor: { time: 0, price: 0 },
            style: { color: "#def" },
        };
        const poly = decomposeArrowMarkDown(state, view)[0];
        if (poly.kind === "polyline") {
            expect(poly.fill?.color).toBe("#def");
        }
    });
});
