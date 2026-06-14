// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { TableCell, TablePosition, TableState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";

const VIEWPORT_PADDING_PX = 8;
const CELL_PAD_X_PX = 6;
const CELL_PAD_Y_PX = 4;
const DEFAULT_TEXT_COLOR = "#0f172a";
const DEFAULT_BG_COLOR = "#ffffff";
const FONT_FAMILY = "sans-serif";

const TEXT_SIZE_PX: Readonly<Record<NonNullable<TableCell["textSize"]>, number>> = {
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

function textSizePx(cell: TableCell): number {
    return TEXT_SIZE_PX[cell.textSize ?? "normal"];
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

function resolveX(position: TablePosition, tableWidth: number, viewport: Viewport): number {
    if (position.endsWith("-center")) return viewport.pxWidth / 2 - tableWidth / 2;
    if (position.endsWith("-right")) return viewport.pxWidth - tableWidth - VIEWPORT_PADDING_PX;
    return VIEWPORT_PADDING_PX;
}

function resolveY(position: TablePosition, tableHeight: number, viewport: Viewport): number {
    if (position.startsWith("middle-")) return viewport.pxHeight / 2 - tableHeight / 2;
    if (position.startsWith("bottom-"))
        return viewport.pxHeight - tableHeight - VIEWPORT_PADDING_PX;
    return VIEWPORT_PADDING_PX;
}

function layoutTable(state: TableState, viewport: Viewport): TableLayout {
    const columns = columnCount(state.cells);
    const columnWidths = Array.from({ length: columns }, () => 0);
    const rowHeights = state.cells.map((row) => {
        let maxFont = TEXT_SIZE_PX.normal;
        for (let column = 0; column < row.length; column++) {
            const cell = row[column];
            const fontPx = textSizePx(cell);
            if (fontPx > maxFont) maxFont = fontPx;
            const width = estimateTextWidth(cell.text, fontPx) + CELL_PAD_X_PX * 2;
            if (width > columnWidths[column]) columnWidths[column] = width;
        }
        return maxFont + CELL_PAD_Y_PX * 2;
    });
    const width = columnWidths.reduce((sum, widthPx) => sum + widthPx, 0);
    const height = rowHeights.reduce((sum, heightPx) => sum + heightPx, 0);
    return {
        x: resolveX(state.position, width, viewport),
        y: resolveY(state.position, height, viewport),
        width,
        height,
        columnWidths,
        rowHeights,
    };
}

function strokeRectPath(ctx: RenderCtx, x: number, y: number, width: number, height: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.stroke();
}

function cellTextX(cell: TableCell, x: number, width: number): number {
    switch (cell.textHalign ?? "left") {
        case "center":
            return x + width / 2;
        case "right":
            return x + width - CELL_PAD_X_PX;
        case "left":
            return x + CELL_PAD_X_PX;
    }
}

function cellTextY(cell: TableCell, y: number, height: number): number {
    switch (cell.textValign ?? "middle") {
        case "top":
            return y + CELL_PAD_Y_PX;
        case "bottom":
            return y + height - CELL_PAD_Y_PX;
        case "middle":
            return y + height / 2;
    }
}

function textAlign(cell: TableCell): RenderCtx["textAlign"] {
    switch (cell.textHalign ?? "left") {
        case "center":
            return "center";
        case "right":
            return "right";
        case "left":
            return "left";
    }
}

function textBaseline(cell: TableCell): RenderCtx["textBaseline"] {
    switch (cell.textValign ?? "middle") {
        case "top":
            return "top";
        case "bottom":
            return "bottom";
        case "middle":
            return "middle";
    }
}

/**
 * Render a `draw.table` emission as a CSS-pixel viewport overlay.
 * This renderer intentionally ignores world-coordinate transforms:
 * `state.position` resolves directly against `Viewport.pxWidth` /
 * `Viewport.pxHeight`.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const emission: DrawingEmission;
 *     declare const viewport: Viewport;
 *     renderTable(ctx, emission, viewport);
 */
export function renderTable(ctx: RenderCtx, emission: DrawingEmission, viewport: Viewport): void {
    if (emission.drawingKind !== "table" || emission.state.kind !== "table") return;
    const state = emission.state;
    const layout = layoutTable(state, viewport);
    ctx.save();
    let y = layout.y;
    for (let rowIndex = 0; rowIndex < state.cells.length; rowIndex++) {
        const row = state.cells[rowIndex];
        const height = layout.rowHeights[rowIndex];
        let x = layout.x;
        for (let columnIndex = 0; columnIndex < layout.columnWidths.length; columnIndex++) {
            const width = layout.columnWidths[columnIndex];
            const cell = row[columnIndex] ?? { text: "" };
            ctx.fillStyle = cell.bgColor ?? DEFAULT_BG_COLOR;
            ctx.fillRect(x, y, width, height);
            ctx.fillStyle = cell.textColor ?? DEFAULT_TEXT_COLOR;
            ctx.font = `${textSizePx(cell)}px ${FONT_FAMILY}`;
            ctx.textAlign = textAlign(cell);
            ctx.textBaseline = textBaseline(cell);
            ctx.fillText(cell.text, cellTextX(cell, x, width), cellTextY(cell, y, height));
            if (state.borderColor !== undefined && state.borderWidth !== undefined) {
                ctx.strokeStyle = state.borderColor;
                ctx.lineWidth = state.borderWidth;
                strokeRectPath(ctx, x, y, width, height);
            }
            x += width;
        }
        y += height;
    }
    if (state.frame !== undefined) {
        ctx.strokeStyle = state.frame.color;
        ctx.lineWidth = state.frame.width;
        strokeRectPath(ctx, layout.x, layout.y, layout.width, layout.height);
    }
    ctx.restore();
}
