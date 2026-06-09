// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TablePosition } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../../testing";
import type { RecordedCall } from "../../testing";
import type { Viewport } from "../coords";
import { renderTable } from "./table";

const VIEWPORT: Viewport = {
    xMin: 1_700_000_000_000,
    xMax: 1_700_000_060_000,
    yMin: 90,
    yMax: 110,
    pxWidth: 200,
    pxHeight: 120,
};

const POSITIONS: ReadonlyArray<TablePosition> = [
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "middle-center",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
];

function emission(position: TablePosition): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "dash.chart.ts:1:1#0#0",
        drawingKind: "table",
        op: "create",
        state: {
            kind: "table",
            position,
            cells: [[{ text: "A" }]],
            borderColor: "#94a3b8",
            borderWidth: 1,
            frame: { color: "#475569", width: 2 },
        },
        bar: 0,
        time: 1_700_000_000_000,
    };
}

function fillRects(
    calls: ReadonlyArray<RecordedCall>,
): ReadonlyArray<Extract<RecordedCall, { kind: "fillRect" }>> {
    return calls.filter(
        (call): call is Extract<RecordedCall, { kind: "fillRect" }> => call.kind === "fillRect",
    );
}

function expectedAnchor(position: TablePosition): { readonly x: number; readonly y: number } {
    const tableWidth = 19.2;
    const tableHeight = 20;
    const x = position.endsWith("-center")
        ? VIEWPORT.pxWidth / 2 - tableWidth / 2
        : position.endsWith("-right")
          ? VIEWPORT.pxWidth - tableWidth - 8
          : 8;
    const y = position.startsWith("middle-")
        ? VIEWPORT.pxHeight / 2 - tableHeight / 2
        : position.startsWith("bottom-")
          ? VIEWPORT.pxHeight - tableHeight - 8
          : 8;
    return { x, y };
}

describe("renderTable", () => {
    it("anchors every table position against the CSS-pixel viewport", () => {
        for (const position of POSITIONS) {
            const ctx = new MockCanvas2DContext();
            renderTable(ctx, emission(position), VIEWPORT);
            expect(ctx.calls[0]).toEqual({ kind: "save" });
            expect(ctx.calls[ctx.calls.length - 1]).toEqual({ kind: "restore" });
            const [background] = fillRects(ctx.calls);
            const expected = expectedAnchor(position);
            expect(background.x).toBeCloseTo(expected.x);
            expect(background.y).toBeCloseTo(expected.y);
            expect(background.w).toBeCloseTo(19.2);
            expect(background.h).toBe(20);
        }
    });

    it("renders cell styles, borders, and frame deterministically", () => {
        const ctx = new MockCanvas2DContext();
        renderTable(
            ctx,
            {
                ...emission("top-left"),
                state: {
                    kind: "table",
                    position: "top-left",
                    cells: [
                        [
                            {
                                text: "Metric",
                                bgColor: "#0f172a",
                                textColor: "#f8fafc",
                                textHalign: "right",
                                textValign: "bottom",
                                textSize: "large",
                            },
                        ],
                    ],
                    borderColor: "#94a3b8",
                    borderWidth: 1,
                    frame: { color: "#475569", width: 2 },
                },
            },
            VIEWPORT,
        );
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "fillStyle", value: "#0f172a" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "fillStyle", value: "#f8fafc" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "font", value: "16px sans-serif" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "textAlign", value: "right" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "textBaseline", value: "bottom" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "strokeStyle", value: "#94a3b8" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "strokeStyle", value: "#475569" });
        expect(ctx.calls.filter((call) => call.kind === "stroke")).toHaveLength(2);
    });

    it("renders center/top aligned table text", () => {
        const ctx = new MockCanvas2DContext();
        renderTable(
            ctx,
            {
                ...emission("top-left"),
                state: {
                    kind: "table",
                    position: "top-left",
                    cells: [[{ text: "Centered", textHalign: "center", textValign: "top" }]],
                },
            },
            VIEWPORT,
        );
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "textAlign", value: "center" });
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "textBaseline", value: "top" });
    });

    it("renders missing cells in ragged rows as empty cells", () => {
        const ctx = new MockCanvas2DContext();
        renderTable(
            ctx,
            {
                ...emission("top-left"),
                state: {
                    kind: "table",
                    position: "top-left",
                    cells: [[{ text: "A" }, { text: "B" }], [{ text: "C" }]],
                },
            },
            VIEWPORT,
        );
        expect(fillRects(ctx.calls)).toHaveLength(4);
    });

    it("ignores non-table drawing emissions defensively", () => {
        const ctx = new MockCanvas2DContext();
        renderTable(
            ctx,
            {
                ...emission("top-left"),
                drawingKind: "line",
                state: {
                    kind: "line",
                    anchors: [
                        { time: 0, price: 0 },
                        { time: 1, price: 1 },
                    ],
                    style: {},
                },
            },
            VIEWPORT,
        );
        expect(ctx.calls).toEqual([]);
    });
});
