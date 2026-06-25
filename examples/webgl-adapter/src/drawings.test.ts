// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import { beforeEach, describe, expect, it } from "vitest";

import type { AxisRenderInfo } from "./axes.js";
import { drawingPrimitives } from "./drawings.js";
import { type AdapterState, createAdapterState } from "./state.js";

// The overlay-pane render info the `onAxes` hook supplies — drawings project
// off this same pixel viewport (the glyph / axis-label projection source).
const INFO: AxisRenderInfo = {
    paneKey: "overlay",
    cssRect: { x: 0, y: 0, width: 800, height: 400 },
    window: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
    ticks: { priceTicks: [], timeTicks: [] },
};

// Build a `DrawingEmission` of `drawingKind` carrying `state`. The `state`
// shapes are cast via `unknown` (the per-kind `*State` types live in core; the
// decomposers read only the fields each kind needs), mirroring the ingest test.
function drawing(
    handleId: string,
    drawingKind: DrawingEmission["drawingKind"],
    state: unknown,
    z?: number,
): DrawingEmission {
    return {
        kind: "drawing",
        handleId,
        op: "create",
        drawingKind,
        state: state as DrawingEmission["state"],
        bar: 0,
        time: 0,
        ...(z === undefined ? {} : { z }),
    };
}

// A two-anchor line drawing → one open polyline primitive.
const LINE_STATE = {
    kind: "line",
    anchors: [
        { time: 10, price: 10 },
        { time: 90, price: 90 },
    ],
    style: {},
};

// A two-anchor rectangle → one CLOSED polyline primitive (with a fill when the
// style sets one).
const RECT_STATE = {
    kind: "rectangle",
    anchors: [
        { time: 10, price: 10 },
        { time: 90, price: 90 },
    ],
    style: { fill: "#3b82f6", fillAlpha: 0.2 },
};

// A centre + edge circle → one arc primitive (closed full circle).
const CIRCLE_STATE = {
    kind: "circle",
    anchors: [
        { time: 50, price: 50 },
        { time: 70, price: 50 },
    ],
    style: {},
};

// A text annotation → one text primitive.
const TEXT_STATE = {
    kind: "text",
    anchor: { time: 50, price: 50 },
    body: "note",
    style: {},
};

// A marker with `text` → one text primitive (the reference paints the label
// only; `decomposeMarker` emits `[]` without text).
const MARKER_STATE = {
    kind: "marker",
    anchor: { time: 50, price: 50 },
    text: "M",
    style: {},
};

// Ingest a drawing into state the same way `applyDrawing` does (set + lockstep
// seq), so `drawingPrimitives` reads a live drawing with an ordering key.
function ingest(state: AdapterState, d: DrawingEmission): void {
    state.drawings.set(d.handleId, d);
    state.drawingSeq.set(d.handleId, state.seq++);
}

let state: AdapterState;
beforeEach(() => {
    state = createAdapterState();
});

describe("drawingPrimitives — decompose mapping", () => {
    it("returns [] when there are no drawings", () => {
        expect(drawingPrimitives(state, INFO)).toEqual([]);
    });

    it("maps a line drawing to one open polyline primitive", () => {
        ingest(state, drawing("l1", "line", LINE_STATE));
        const prims = drawingPrimitives(state, INFO);
        expect(prims).toHaveLength(1);
        const [p] = prims;
        expect(p.kind).toBe("polyline");
        if (p.kind === "polyline") {
            expect(p.closed).toBe(false);
            expect(p.points).toHaveLength(2);
            // Projected to pixel space (NOT the world anchors) — the overlay
            // viewport projection ran.
            expect(p.points[0].x).not.toBe(LINE_STATE.anchors[0].time);
        }
    });

    it("maps a rectangle drawing to one closed polyline primitive with a fill", () => {
        ingest(state, drawing("r1", "rectangle", RECT_STATE));
        const prims = drawingPrimitives(state, INFO);
        expect(prims).toHaveLength(1);
        const [p] = prims;
        expect(p.kind).toBe("polyline");
        if (p.kind === "polyline") {
            expect(p.closed).toBe(true);
            expect(p.points).toHaveLength(4);
            expect(p.fill).toBeDefined();
        }
    });

    it("maps a circle drawing to one arc primitive", () => {
        ingest(state, drawing("c1", "circle", CIRCLE_STATE));
        const prims = drawingPrimitives(state, INFO);
        expect(prims).toHaveLength(1);
        expect(prims[0].kind).toBe("arc");
    });

    it("maps a text drawing to one text primitive", () => {
        ingest(state, drawing("t1", "text", TEXT_STATE));
        const prims = drawingPrimitives(state, INFO);
        expect(prims).toHaveLength(1);
        const [p] = prims;
        expect(p.kind).toBe("text");
        if (p.kind === "text") expect(p.text).toBe("note");
    });

    it("maps a marker-with-text drawing to one text primitive (label only)", () => {
        ingest(state, drawing("m1", "marker", MARKER_STATE));
        const prims = drawingPrimitives(state, INFO);
        expect(prims).toHaveLength(1);
        const [p] = prims;
        expect(p.kind).toBe("text");
        if (p.kind === "text") expect(p.text).toBe("M");
    });

    it("concatenates multiple drawings ordered by (z, seq)", () => {
        // Ingest in z order 1 then 0: the (z, seq) sort puts the z:0 circle's
        // arc BEFORE the z:1 line's polyline regardless of ingest order.
        ingest(state, drawing("hi", "line", LINE_STATE, 1));
        ingest(state, drawing("lo", "circle", CIRCLE_STATE, 0));
        const prims = drawingPrimitives(state, INFO);
        expect(prims.map((p) => p.kind)).toEqual(["arc", "polyline"]);
    });

    it("orders equal-z drawings by ingest seq", () => {
        ingest(state, drawing("first", "circle", CIRCLE_STATE));
        ingest(state, drawing("second", "line", LINE_STATE));
        const prims = drawingPrimitives(state, INFO);
        expect(prims.map((p) => p.kind)).toEqual(["arc", "polyline"]);
    });

    it("excludes a removed drawing (op:'remove' is dropped at ingest)", () => {
        ingest(state, drawing("d1", "line", LINE_STATE));
        // Mirror `applyDrawing`'s remove path: delete from both maps.
        state.drawings.delete("d1");
        state.drawingSeq.delete("d1");
        expect(drawingPrimitives(state, INFO)).toEqual([]);
    });
});
