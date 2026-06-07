// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingState } from "@invinite-org/chartlang-core";

import type { DrawingEmission } from "../types";
import { validateEmission } from "./validateEmission";

/**
 * Narrow a {@link DrawingEmission} to its typed {@link DrawingState}.
 * Returns `null` when the emission fails the same validation
 * {@link validateEmission} runs — adapters that want to know WHY call
 * `validateEmission(e)` directly and inspect `.code` / `.message`.
 *
 * Successful narrows return `e.state` typed as `DrawingState`; the
 * caller can switch on `state.kind` for per-kind handling. The
 * validator pins `state.kind === e.drawingKind`, so the discriminator
 * is safe.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { decodeDrawing } from "@invinite-org/chartlang-adapter-kit";
 *     import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
 *
 *     declare const e: DrawingEmission;
 *     const state = decodeDrawing(e);
 *     if (state !== null && state.kind === "line") {
 *         const [from, to] = state.anchors;
 *         void from;
 *         void to;
 *     }
 */
export function decodeDrawing(e: DrawingEmission): DrawingState | null {
    const result = validateEmission(e as unknown);
    if (!result.ok) return null;
    return e.state;
}
