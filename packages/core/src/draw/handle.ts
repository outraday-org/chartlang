// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingState } from "./drawingState";

/**
 * Script-facing handle returned by every `draw.<kind>(...)` call. The
 * runtime keys handles by `slotId#subId` so a script's `for` loop
 * emitting N drawings gets N stable cross-bar handles — same loop
 * iteration across bars yields the same handle.
 *
 * `update(patch)` re-emits the FULL merged state under `op: "update"`
 * (the patch is merged with the handle's current `DrawingState` in the
 * runtime); `remove()` emits one final `op: "remove"` with the last
 * known state. The impl lives in
 * `@invinite-org/chartlang-runtime/emit/draw/handle.ts` (Task 3).
 *
 * @formula  N/A — handle is an opaque script-facing object
 * @anchors  id (slotId#subId), update(patch), remove()
 * @since 0.3
 * @stable
 * @example
 *     // Inside a compiled `compute`:
 *     //   const h = draw.horizontalLine(supportLevel);
 *     //   h.update({ price: nextLevel });
 *     //   h.remove();
 *     import type { DrawingHandle } from "@invinite-org/chartlang-core";
 *     const _shape: DrawingHandle | null = null;
 *     void _shape;
 */
export type DrawingHandle = {
    readonly id: string;
    update(patch: Partial<DrawingState>): void;
    remove(): void;
};
