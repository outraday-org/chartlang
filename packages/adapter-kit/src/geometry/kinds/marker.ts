// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Marker geometry moved from the canvas2d adapter's per-kind renderer
//   examples/canvas2d-adapter/src/render/draw/marker.ts.
// The originating math is invinite's marker tool (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type { MarkerState } from "@invinite-org/chartlang-core";

import { resolveTextOpts } from "../_lib/textStyle.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

/**
 * Decompose a `marker` drawing. The reference adapter paints a marker's
 * `text` label only (no glyph) — so this emits a single `text`
 * primitive when `state.text` is a non-empty string, and `[]`
 * otherwise. (The IR `marker` primitive exists for adapters / future
 * kinds; no basic kind emits it.) `style.bgColor` is preserved on the
 * IR `text` primitive but the canvas sink does not paint a background
 * rect, matching the source renderer.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: MarkerState;
 *     declare const v: Viewport;
 *     const prims = decomposeMarker(s, v);
 *     void prims;
 */
export function decomposeMarker(state: MarkerState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    if (state.text === undefined || state.text.length === 0) return [];
    const anchor = worldPointToPixel(state.anchor, view);
    const resolved = resolveTextOpts(state.style);
    return [
        {
            kind: "text",
            x: anchor.x,
            y: anchor.y,
            text: state.text,
            color: resolved.color,
            font: resolved.font,
            align: resolved.align,
            baseline: resolved.baseline,
            ...(state.style.bgColor === undefined ? {} : { bgColor: state.style.bgColor }),
        },
    ];
}
