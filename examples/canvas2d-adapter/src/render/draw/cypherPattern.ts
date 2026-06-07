// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// State shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (CypherPatternDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// `cypher-pattern` has no standalone invinite tool (UI surface lives
// in `defineDrawing`); only the y-doc-bridge type is cited per
// PLAN.md §3.1. Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { CypherPatternState } from "@invinite-org/chartlang-core";

import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";
import { renderNamedPolyline } from "./namedPolyline";
import { worldPointToCanvas } from "./worldToCanvas";

const LABELS: ReadonlyArray<string> = ["X", "A", "B", "C", "D"];

/**
 * Render a `cypher-pattern` drawing emission as a 4-leg open polyline
 * through the 5 anchors (X-A-B-C-D) with each pivot labelled. The
 * structural emission shape matches `xabcd-pattern` — the cypher
 * fib-ratio invariants are a script-author concern, not a renderer
 * one.
 *
 * @since 0.3
 * @experimental
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderCypherPattern(ctx, e, view);
 *     void renderCypherPattern;
 */
export function renderCypherPattern(
    ctx: RenderCtx,
    e: DrawingEmission,
    view: Viewport,
): void {
    const state = e.state as CypherPatternState;
    const points = state.anchors.map((p) => worldPointToCanvas(p, view));
    renderNamedPolyline(ctx, points, LABELS, state.style);
}
