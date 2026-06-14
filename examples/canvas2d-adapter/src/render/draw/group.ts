// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// State shape ported from
//   invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts
//     (GroupDrawing), commit
//     078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite.
// No standalone tool source exists in invinite — groups are
// metadata-only containers.
// Re-licensed MIT for chartlang.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";

import type { RenderCtx } from "../clear.js";
import type { Viewport } from "../coords.js";

/**
 * Render a `group` drawing emission. The group container is
 * metadata-only on the wire — `childHandleIds` reference drawings
 * that render themselves through their own dispatch arms. The Phase-3
 * `Viewport` exposes no `drawingsById` side-channel, so this
 * renderer cannot derive a bounding box from the children's anchor
 * extrema without a foundation-level Viewport change. It is a pure
 * no-op for Phase 3; the visible bounding-box envelope around grouped
 * drawings is a Phase-4 follow-up tied to the adapter-state plumbing
 * for child-state queries.
 *
 * @since 0.3
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderGroup(ctx, e, view);
 *     void renderGroup;
 */
export function renderGroup(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    // No-op per the Phase-3 contract (see file header).
    void ctx;
    void e;
    void view;
}
