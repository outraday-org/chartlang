// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Container + table geometry moved from the canvas2d adapter's per-kind
// renderers
//   examples/canvas2d-adapter/src/render/draw/{group,frame,table}.ts.
// `group` / `frame` state shapes originate from invinite's collab
// y-doc-bridge (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02,
// © Invinite); the frame envelope + table layout are chartlang
// additions. Re-licensed MIT for chartlang.

import type {
    FrameState,
    GroupState,
    TableCell,
    TablePosition,
    TableState,
} from "@invinite-org/chartlang-core";

import { SOLID_DASH } from "../_lib/dash.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, FillStyle, StrokeStyle, Viewport } from "../types.js";

const FILL_OPAQUE = 1;

// --- group ---------------------------------------------------------------

/**
 * Decompose a `group` drawing — a no-op container. Groups are
 * metadata-only on the wire: `childHandleIds` reference drawings that
 * decompose through their own arms, and the `Viewport` exposes no
 * child-state side-channel, so a group emits nothing.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: GroupState;
 *     declare const v: Viewport;
 *     const prims = decomposeGroup(s, v);
 *     // prims.length === 0
 *     void prims;
 */
export function decomposeGroup(state: GroupState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    void state;
    void view;
    return [];
}

// --- frame ---------------------------------------------------------------

const FRAME_STROKE = "#64748b";
const FRAME_LABEL_COLOR = "#1e293b";
const FRAME_LINE_WIDTH = 1;
const FRAME_LABEL_FONT = "12px sans-serif";
const FRAME_LABEL_INSET_X = 6;
const FRAME_LABEL_INSET_Y = 14;

/**
 * Decompose a `frame` drawing — a stroked rectangle between the two
 * world anchors `[topLeft, bottomRight]`. An optional `style.bgColor`
 * adds a background `fill` (alpha 1) on the border polyline; an optional
 * `style.label` adds a `text` primitive at the top-left corner.
 * Degenerate anchors (zero width/height, or non-finite) emit `[]`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FrameState;
 *     declare const v: Viewport;
 *     const prims = decomposeFrame(s, v);
 *     void prims;
 */
export function decomposeFrame(state: FrameState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const xMin = Math.min(a.x, b.x);
    const xMax = Math.max(a.x, b.x);
    const yMin = Math.min(a.y, b.y);
    const yMax = Math.max(a.y, b.y);
    const width = xMax - xMin;
    const height = yMax - yMin;
    if (width === 0 || height === 0) return [];
    if (!Number.isFinite(width) || !Number.isFinite(height)) return [];
    const fill: FillStyle | undefined =
        state.style.bgColor !== undefined
            ? { color: state.style.bgColor, alpha: FILL_OPAQUE }
            : undefined;
    const border: DrawPrimitive = {
        kind: "polyline",
        points: [
            { x: xMin, y: yMin },
            { x: xMax, y: yMin },
            { x: xMax, y: yMax },
            { x: xMin, y: yMax },
        ],
        closed: true,
        stroke: { color: FRAME_STROKE, width: FRAME_LINE_WIDTH, dash: SOLID_DASH },
        ...(fill !== undefined ? { fill } : {}),
    };
    const out: DrawPrimitive[] = [border];
    if (state.style.label !== undefined) {
        out.push({
            kind: "text",
            x: xMin + FRAME_LABEL_INSET_X,
            y: yMin + FRAME_LABEL_INSET_Y,
            text: state.style.label,
            color: FRAME_LABEL_COLOR,
            font: FRAME_LABEL_FONT,
            align: "left",
            baseline: "bottom",
        });
    }
    return out;
}

// --- table ---------------------------------------------------------------

const TABLE_VIEWPORT_PADDING_PX = 8;
const TABLE_CELL_PAD_X_PX = 6;
const TABLE_CELL_PAD_Y_PX = 4;
const TABLE_DEFAULT_TEXT_COLOR = "#0f172a";
const TABLE_DEFAULT_BG_COLOR = "#ffffff";
const TABLE_FONT_FAMILY = "sans-serif";

const TABLE_TEXT_SIZE_PX: Readonly<Record<NonNullable<TableCell["textSize"]>, number>> = {
    tiny: 8,
    small: 10,
    normal: 12,
    large: 16,
    huge: 24,
};

type TableLayout = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly columnWidths: ReadonlyArray<number>;
    readonly rowHeights: ReadonlyArray<number>;
};

// The table is a SCREEN-SPACE HUD whose cell / font sizes are authored in
// CSS pixels. On a device-px canvas (`Viewport.pxRatio > 1`, the uplot /
// lightweight-charts adapters) those sizes are multiplied by the ratio so
// the table renders at the same physical size as on a CSS-px canvas. A
// CSS-px adapter omits `pxRatio` (⇒ `1`), keeping the output byte-identical.
function tableScale(view: Viewport): number {
    const ratio = view.pxRatio ?? 1;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function tableTextSizePx(cell: TableCell, scale: number): number {
    return TABLE_TEXT_SIZE_PX[cell.textSize ?? "normal"] * scale;
}

function estimateTextWidth(text: string, fontPx: number): number {
    return text.length * fontPx * 0.6;
}

function columnCount(rows: ReadonlyArray<ReadonlyArray<TableCell>>): number {
    let count = 0;
    for (const row of rows) {
        if (row.length > count) count = row.length;
    }
    return count;
}

function resolveTableX(
    position: TablePosition,
    tableWidth: number,
    view: Viewport,
    pad: number,
): number {
    if (position.endsWith("-center")) return view.pxWidth / 2 - tableWidth / 2;
    if (position.endsWith("-right")) return view.pxWidth - tableWidth - pad;
    return pad;
}

function resolveTableY(
    position: TablePosition,
    tableHeight: number,
    view: Viewport,
    pad: number,
): number {
    if (position.startsWith("middle-")) return view.pxHeight / 2 - tableHeight / 2;
    if (position.startsWith("bottom-")) return view.pxHeight - tableHeight - pad;
    return pad;
}

function layoutTable(state: TableState, view: Viewport, scale: number): TableLayout {
    const padX = TABLE_CELL_PAD_X_PX * scale;
    const padY = TABLE_CELL_PAD_Y_PX * scale;
    const viewportPad = TABLE_VIEWPORT_PADDING_PX * scale;
    const columns = columnCount(state.cells);
    const columnWidths = Array.from({ length: columns }, () => 0);
    const rowHeights = state.cells.map((row) => {
        let maxFont = TABLE_TEXT_SIZE_PX.normal * scale;
        for (let column = 0; column < row.length; column++) {
            const cell = row[column];
            const fontPx = tableTextSizePx(cell, scale);
            if (fontPx > maxFont) maxFont = fontPx;
            const width = estimateTextWidth(cell.text, fontPx) + padX * 2;
            if (width > columnWidths[column]) columnWidths[column] = width;
        }
        return maxFont + padY * 2;
    });
    const width = columnWidths.reduce((sum, widthPx) => sum + widthPx, 0);
    const height = rowHeights.reduce((sum, heightPx) => sum + heightPx, 0);
    return {
        x: resolveTableX(state.position, width, view, viewportPad),
        y: resolveTableY(state.position, height, view, viewportPad),
        width,
        height,
        columnWidths,
        rowHeights,
    };
}

function rectPolyline(
    x: number,
    y: number,
    width: number,
    height: number,
    stroke: StrokeStyle | undefined,
    fill: FillStyle | undefined,
): DrawPrimitive {
    return {
        kind: "polyline",
        points: [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ],
        closed: true,
        ...(stroke !== undefined ? { stroke } : {}),
        ...(fill !== undefined ? { fill } : {}),
    };
}

function cellTextX(cell: TableCell, x: number, width: number, padX: number): number {
    switch (cell.textHalign ?? "left") {
        case "center":
            return x + width / 2;
        case "right":
            return x + width - padX;
        case "left":
            return x + padX;
    }
}

function cellTextY(cell: TableCell, y: number, height: number, padY: number): number {
    switch (cell.textValign ?? "middle") {
        case "top":
            return y + padY;
        case "bottom":
            return y + height - padY;
        case "middle":
            return y + height / 2;
    }
}

function cellAlign(cell: TableCell): "left" | "center" | "right" {
    return cell.textHalign ?? "left";
}

function cellBaseline(cell: TableCell): "top" | "middle" | "bottom" {
    return cell.textValign ?? "middle";
}

/**
 * Decompose a `draw.table` emission as a CSS-pixel viewport overlay.
 * Unlike every other kind, `table` ignores world-coordinate transforms:
 * `state.position` resolves directly against `Viewport.pxWidth` /
 * `Viewport.pxHeight`. Each cell emits a background-fill polyline + a
 * `text` primitive (+ an optional per-cell border polyline when both
 * `borderColor` and `borderWidth` are set); an optional outer `frame`
 * polyline wraps the whole grid. Zero rows/columns yields a degenerate
 * (possibly empty) grid without throwing.
 *
 * Cell / font / padding / border sizes are CSS-pixel magnitudes scaled by
 * `Viewport.pxRatio` (default `1`), so a device-px adapter (uplot,
 * lightweight-charts) renders the HUD at the same physical size as a CSS-px
 * one. With `pxRatio` omitted the output is byte-identical to the
 * pre-feature decomposer.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TableState;
 *     declare const v: Viewport;
 *     const prims = decomposeTable(s, v);
 *     void prims;
 */
export function decomposeTable(state: TableState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const scale = tableScale(view);
    const padX = TABLE_CELL_PAD_X_PX * scale;
    const padY = TABLE_CELL_PAD_Y_PX * scale;
    const layout = layoutTable(state, view, scale);
    const out: DrawPrimitive[] = [];
    let y = layout.y;
    for (let rowIndex = 0; rowIndex < state.cells.length; rowIndex++) {
        const row = state.cells[rowIndex];
        const height = layout.rowHeights[rowIndex];
        let x = layout.x;
        for (let columnIndex = 0; columnIndex < layout.columnWidths.length; columnIndex++) {
            const width = layout.columnWidths[columnIndex];
            const cell = row[columnIndex] ?? { text: "" };
            out.push(
                rectPolyline(x, y, width, height, undefined, {
                    color: cell.bgColor ?? TABLE_DEFAULT_BG_COLOR,
                    alpha: FILL_OPAQUE,
                }),
            );
            out.push({
                kind: "text",
                x: cellTextX(cell, x, width, padX),
                y: cellTextY(cell, y, height, padY),
                text: cell.text,
                color: cell.textColor ?? TABLE_DEFAULT_TEXT_COLOR,
                font: `${tableTextSizePx(cell, scale)}px ${TABLE_FONT_FAMILY}`,
                align: cellAlign(cell),
                baseline: cellBaseline(cell),
            });
            if (state.borderColor !== undefined && state.borderWidth !== undefined) {
                out.push(
                    rectPolyline(
                        x,
                        y,
                        width,
                        height,
                        {
                            color: state.borderColor,
                            width: state.borderWidth * scale,
                            dash: SOLID_DASH,
                        },
                        undefined,
                    ),
                );
            }
            x += width;
        }
        y += height;
    }
    if (state.frame !== undefined) {
        out.push(
            rectPolyline(
                layout.x,
                layout.y,
                layout.width,
                layout.height,
                { color: state.frame.color, width: state.frame.width * scale, dash: SOLID_DASH },
                undefined,
            ),
        );
    }
    return out;
}
