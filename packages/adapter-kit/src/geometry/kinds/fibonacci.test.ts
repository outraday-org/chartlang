// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    FibChannelState,
    FibCirclesState,
    FibRetracementState,
    FibSpeedArcsState,
    FibSpeedFanState,
    FibSpiralState,
    FibTimeZoneState,
    FibTrendExtensionState,
    FibTrendTimeState,
    FibWedgeState,
} from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { FIB_LEVELS } from "../_lib/fibLevels.js";
import type { DrawPrimitive, Viewport } from "../types.js";
import {
    decomposeFibChannel,
    decomposeFibCircles,
    decomposeFibRetracement,
    decomposeFibSpeedArcs,
    decomposeFibSpeedFan,
    decomposeFibSpiral,
    decomposeFibTimeZone,
    decomposeFibTrendExtension,
    decomposeFibTrendTime,
    decomposeFibWedge,
} from "./fibonacci.js";

const view: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, pxWidth: 100, pxHeight: 100 };

function countByKind(prims: ReadonlyArray<DrawPrimitive>, kind: DrawPrimitive["kind"]): number {
    return prims.filter((p) => p.kind === kind).length;
}

describe("decomposeFibRetracement", () => {
    const base: FibRetracementState = {
        kind: "fib-retracement",
        anchors: [
            { time: 1, price: 0 },
            { time: 8, price: 10 },
        ],
        style: {},
    };

    it("emits one horizontal line per default level, no labels by default", () => {
        const prims = decomposeFibRetracement(base, view);
        expect(prims).toHaveLength(FIB_LEVELS.length);
        expect(countByKind(prims, "text")).toBe(0);
        const first = prims[0];
        if (first.kind !== "polyline") throw new Error("expected polyline");
        expect(first.stroke?.color).toBe("#facc15");
    });

    it("appends a right-edge label per rail when showLabels is true", () => {
        const prims = decomposeFibRetracement(
            { ...base, style: { showLabels: true, color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "polyline")).toBe(FIB_LEVELS.length);
        expect(countByKind(prims, "text")).toBe(FIB_LEVELS.length);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.align).toBe("left");
        expect(label.baseline).toBe("middle");
        expect(label.color).toBe("#abc");
    });

    it("respects a custom levels override and the empty-array no-op", () => {
        expect(decomposeFibRetracement({ ...base, style: { levels: [0.5] } }, view)).toHaveLength(
            1,
        );
        expect(decomposeFibRetracement({ ...base, style: { levels: [] } }, view)).toHaveLength(0);
    });

    it("extends rails to the viewport edges when extend flags are set", () => {
        const prims = decomposeFibRetracement(
            { ...base, style: { levels: [0.5], extendLeft: true, extendRight: true } },
            view,
        );
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.points[0].x).toBe(0);
        expect(p.points[1].x).toBe(view.pxWidth);
    });
});

describe("decomposeFibTrendExtension", () => {
    const base: FibTrendExtensionState = {
        kind: "fib-trend-extension",
        anchors: [
            { time: 0, price: 0 },
            { time: 2, price: 4 },
            { time: 4, price: 2 },
        ],
        style: {},
    };

    it("emits a rightward horizontal line per level", () => {
        const prims = decomposeFibTrendExtension(base, view);
        expect(prims).toHaveLength(FIB_LEVELS.length);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.points[1].x).toBe(view.pxWidth);
    });

    it("labels past the right edge when showLabels is true", () => {
        const prims = decomposeFibTrendExtension(
            { ...base, style: { showLabels: true, levels: [0.5], color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "text")).toBe(1);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.x).toBeGreaterThan(view.pxWidth);
        expect(label.color).toBe("#abc");
    });
});

describe("decomposeFibChannel", () => {
    const base: FibChannelState = {
        kind: "fib-channel",
        anchors: [
            { time: 0, price: 0 },
            { time: 4, price: 4 },
            { time: 0, price: 2 },
        ],
        style: {},
    };

    it("emits one parallel rail per level", () => {
        expect(decomposeFibChannel(base, view)).toHaveLength(FIB_LEVELS.length);
    });

    it("labels at the rail's right endpoint when showLabels is true", () => {
        const prims = decomposeFibChannel(
            { ...base, style: { showLabels: true, levels: [1], color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "text")).toBe(1);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.color).toBe("#abc");
    });
});

describe("decomposeFibTimeZone", () => {
    const base: FibTimeZoneState = {
        kind: "fib-time-zone",
        anchors: [
            { time: 0, price: 0 },
            { time: 4, price: 0 },
        ],
        style: {},
    };

    it("emits a full-height vertical line per level", () => {
        const prims = decomposeFibTimeZone(base, view);
        expect(prims).toHaveLength(FIB_LEVELS.length);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.points[0].y).toBe(0);
        expect(p.points[1].y).toBe(view.pxHeight);
    });

    it("uses a top-anchored label when showLabels is true", () => {
        const prims = decomposeFibTimeZone(
            { ...base, style: { showLabels: true, levels: [1], color: "#abc" } },
            view,
        );
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.baseline).toBe("top");
        expect(label.color).toBe("#abc");
    });
});

describe("decomposeFibTrendTime", () => {
    const base: FibTrendTimeState = {
        kind: "fib-trend-time",
        anchors: [
            { time: 0, price: 0 },
            { time: 2, price: 1 },
            { time: 4, price: 0 },
        ],
        style: {},
    };

    it("emits a vertical line per level anchored at C", () => {
        expect(decomposeFibTrendTime(base, view)).toHaveLength(FIB_LEVELS.length);
    });

    it("uses a top-anchored label when showLabels is true", () => {
        const prims = decomposeFibTrendTime(
            { ...base, style: { showLabels: true, levels: [1], color: "#abc" } },
            view,
        );
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.baseline).toBe("top");
        expect(label.color).toBe("#abc");
    });
});

describe("decomposeFibWedge", () => {
    const base: FibWedgeState = {
        kind: "fib-wedge",
        anchors: [
            { time: 0, price: 0 },
            { time: 4, price: 4 },
            { time: 4, price: -4 },
        ],
        style: {},
    };

    it("emits one ray per level", () => {
        expect(decomposeFibWedge(base, view)).toHaveLength(FIB_LEVELS.length);
    });

    it("labels a quarter of the way along each ray when showLabels is true", () => {
        const prims = decomposeFibWedge(
            { ...base, style: { showLabels: true, levels: [0.5], color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "polyline")).toBe(1);
        expect(countByKind(prims, "text")).toBe(1);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.color).toBe("#abc");
    });

    it("skips a level whose interpolated direction is degenerate", () => {
        // pivot === range1 === range2 → every interpolated direction has zero magnitude.
        const degenerate: FibWedgeState = {
            kind: "fib-wedge",
            anchors: [
                { time: 5, price: 5 },
                { time: 5, price: 5 },
                { time: 5, price: 5 },
            ],
            style: { showLabels: true },
        };
        expect(decomposeFibWedge(degenerate, view)).toHaveLength(0);
    });
});

describe("decomposeFibSpeedFan", () => {
    const base: FibSpeedFanState = {
        kind: "fib-speed-fan",
        anchors: [
            { time: 0, price: 0 },
            { time: 4, price: 4 },
        ],
        style: {},
    };

    it("emits one ray per level", () => {
        expect(decomposeFibSpeedFan(base, view)).toHaveLength(FIB_LEVELS.length);
    });

    it("labels along each ray when showLabels is true", () => {
        const prims = decomposeFibSpeedFan(
            { ...base, style: { showLabels: true, levels: [0.5], color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "text")).toBe(1);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.color).toBe("#abc");
    });

    it("skips a level whose ray magnitude is zero", () => {
        // from === to → dx = 0 and level*dy = 0 for every level → zero magnitude.
        const degenerate: FibSpeedFanState = {
            kind: "fib-speed-fan",
            anchors: [
                { time: 5, price: 5 },
                { time: 5, price: 5 },
            ],
            style: { showLabels: true },
        };
        expect(decomposeFibSpeedFan(degenerate, view)).toHaveLength(0);
    });
});

describe("decomposeFibSpeedArcs", () => {
    const base: FibSpeedArcsState = {
        kind: "fib-speed-arcs",
        anchors: [
            { time: 0, price: 0 },
            { time: 2, price: 0 },
        ],
        style: {},
    };

    it("emits one full circle arc per level", () => {
        const prims = decomposeFibSpeedArcs(base, view);
        expect(prims).toHaveLength(FIB_LEVELS.length);
        const p = prims[0];
        if (p.kind !== "arc") throw new Error("expected arc");
        expect(p.start).toBe(0);
        expect(p.end).toBeCloseTo(Math.PI * 2);
    });

    it("labels to the right of each arc when showLabels is true", () => {
        const prims = decomposeFibSpeedArcs(
            { ...base, style: { showLabels: true, levels: [1], color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "arc")).toBe(1);
        expect(countByKind(prims, "text")).toBe(1);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.color).toBe("#abc");
    });
});

describe("decomposeFibCircles", () => {
    const base: FibCirclesState = {
        kind: "fib-circles",
        anchors: [
            { time: 0, price: 0 },
            { time: 2, price: 0 },
        ],
        style: {},
    };

    it("emits one full circle arc per level", () => {
        expect(decomposeFibCircles(base, view)).toHaveLength(FIB_LEVELS.length);
    });

    it("labels each circle when showLabels is true", () => {
        const prims = decomposeFibCircles(
            { ...base, style: { showLabels: true, levels: [1], color: "#abc" } },
            view,
        );
        expect(countByKind(prims, "text")).toBe(1);
        const label = prims.find((p) => p.kind === "text");
        if (label?.kind !== "text") throw new Error("expected text");
        expect(label.color).toBe("#abc");
    });
});

describe("decomposeFibSpiral", () => {
    it("emits one open polyline approximating a golden spiral", () => {
        const state: FibSpiralState = {
            kind: "fib-spiral",
            anchors: [
                { time: 0, price: 0 },
                { time: 3, price: 0 },
            ],
            style: {},
        };
        const prims = decomposeFibSpiral(state, view);
        expect(prims).toHaveLength(1);
        const p = prims[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.closed).toBe(false);
        // 1 start point + 8 quarters * 16 samples each (first sample skipped).
        expect(p.points).toHaveLength(1 + 8 * 16);
        expect(p.stroke?.color).toBe("#facc15");
    });

    it("honours an explicit colour", () => {
        const state: FibSpiralState = {
            kind: "fib-spiral",
            anchors: [
                { time: 0, price: 0 },
                { time: 3, price: 0 },
            ],
            style: { color: "#123456" },
        };
        const p = decomposeFibSpiral(state, view)[0];
        if (p.kind !== "polyline") throw new Error("expected polyline");
        expect(p.stroke?.color).toBe("#123456");
    });

    it("returns [] for a zero-radius spiral", () => {
        const state: FibSpiralState = {
            kind: "fib-spiral",
            anchors: [
                { time: 5, price: 5 },
                { time: 5, price: 5 },
            ],
            style: {},
        };
        expect(decomposeFibSpiral(state, view)).toEqual([]);
    });
});
