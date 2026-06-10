// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Color } from "../types.js";
import type { DrawingHandle } from "./handle.js";

/**
 * CSS-pixel viewport anchor used by `draw.table`. Tables are status
 * panels, not world-space drawings, so the position resolves against
 * the adapter viewport per PLAN.md §10.2.
 *
 * @formula  N/A — viewport anchor enum
 * @anchors  CSS viewport edge/corner/center
 * @since 0.5
 * @stable
 * @example
 *     const position: TablePosition = "top-right";
 *     void position;
 */
export type TablePosition =
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "middle-center"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";

/**
 * One cell in a `draw.table` dashboard. Text is required; styling
 * fields are optional and interpreted by the target adapter.
 *
 * @formula  N/A — viewport table cell payload
 * @anchors  table grid cell
 * @since 0.5
 * @stable
 * @example
 *     const cell: TableCell = {
 *         text: "P&L",
 *         textColor: "#16a34a",
 *         textHalign: "right",
 *     };
 *     void cell;
 */
export type TableCell = Readonly<{
    text: string;
    bgColor?: Color;
    textColor?: Color;
    textHalign?: "left" | "center" | "right";
    textValign?: "top" | "middle" | "bottom";
    textSize?: "tiny" | "small" | "normal" | "large" | "huge";
}>;

/**
 * Options accepted by `draw.table`.
 *
 * @formula  N/A — viewport table payload
 * @anchors  position: CSS viewport anchor; cells: 2D table grid
 * @since 0.5
 * @stable
 * @example
 *     const opts: TableOpts = {
 *         position: "top-right",
 *         cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
 *         borderColor: "#94a3b8",
 *         borderWidth: 1,
 *     };
 *     void opts;
 */
export type TableOpts = Readonly<{
    position: TablePosition;
    cells: ReadonlyArray<ReadonlyArray<TableCell>>;
    borderColor?: Color;
    borderWidth?: number;
    frame?: Readonly<{ color: Color; width: number }>;
}>;

/**
 * Compile-time callable hole. The runtime swaps this for the slot-id
 * aware implementation, and the compiler injects the callsite id into
 * every script-side `draw.table(opts)` call.
 *
 * @formula  N/A — compiler/runtime primitive seam
 * @anchors  position + cells, viewport anchored
 * @since 0.5
 * @stable
 * @example
 *     // Inside compute:
 *     // const h = draw.table({
 *     //     position: "top-right",
 *     //     cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
 *     // });
 */
export function table(_opts: TableOpts): DrawingHandle {
    throw new Error("draw.table called outside compiled runtime");
}
