// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingHandle, DrawingKind, DrawingState } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../../runtimeContext";
import { pushDrawing } from "./pushDrawing";

const OUTSIDE_CTX_MESSAGE = "draw called outside an active script step";

function mergeState(prev: DrawingState, patch: Partial<DrawingState>): DrawingState {
    // Spread the patch over `prev` and force `kind` back to the
    // previous variant. A cross-variant patch from a script is a type
    // error at the script's callsite — the runtime defends against it
    // here so the runtime cannot accidentally emit a drift between
    // `drawingKind` and `state.kind`. The cast is safe because every
    // variant of `DrawingState` shares the shape `{ kind, ... }` and
    // discriminants stay pinned to `prev.kind`.
    return { ...prev, ...patch, kind: prev.kind } as DrawingState;
}

function emit(
    ctx: RuntimeContext,
    handleId: string,
    kind: DrawingKind,
    op: "create" | "update" | "remove",
    state: DrawingState,
): void {
    pushDrawing(ctx, {
        kind: "drawing",
        handleId,
        drawingKind: kind,
        op,
        state,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
    });
}

/**
 * Construct a {@link DrawingHandle} for `slotId#subId` in the active
 * runtime context. Allocates the slot in `ctx.drawingSlots` on the
 * first call (`op: "create"`); subsequent calls at the same callsite
 * across bars find the existing slot and emit `op: "update"` with the
 * full merged state.
 *
 * `update(patch)` merges the patch with the current slot state and
 * re-emits the FULL merged state under `op: "update"` per PLAN.md
 * §10.3. `remove()` emits one final `op: "remove"` with the
 * last-known state and flags the slot `removed: true`; subsequent
 * `update` / `remove` calls on the returned handle are no-ops.
 *
 * The handle's `id` is `slotId#subId` — stable across bars.
 *
 * @since 0.3
 * @stable
 * @example
 *     // import {
 *     //     createDrawingHandle,
 *     // } from "@invinite-org/chartlang-runtime";
 *     // const h = createDrawingHandle(
 *     //     "demo.chart.ts:5:13#0",
 *     //     0,
 *     //     "line",
 *     //     {
 *     //         kind: "line",
 *     //         anchors: [{ time: 0, price: 0 }, { time: 1, price: 1 }],
 *     //         style: {},
 *     //     },
 *     // );
 *     // h.update({ style: { color: "#3b82f6" } });
 *     // h.remove();
 */
export function createDrawingHandle(
    slotId: string,
    subId: number,
    kind: DrawingKind,
    initialState: DrawingState,
): DrawingHandle {
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (ctx === null) throw new Error(OUTSIDE_CTX_MESSAGE);

    const handleId = `${slotId}#${subId}`;
    const existing = ctx.drawingSlots.get(handleId);

    let slot: { handleId: string; kind: DrawingKind; state: DrawingState; removed: boolean };
    let op: "create" | "update";
    if (existing === undefined) {
        slot = { handleId, kind, state: initialState, removed: false };
        ctx.drawingSlots.set(handleId, slot);
        op = "create";
    } else {
        // Cross-bar re-entry. Merge initialState into the existing slot
        // (script-author may pass new anchors / style); resurrect if it
        // was previously removed.
        existing.state = mergeState(existing.state, initialState);
        existing.removed = false;
        slot = existing;
        op = "update";
    }

    emit(ctx, handleId, kind, op, slot.state);

    return {
        id: handleId,
        update(patch: Partial<DrawingState>): void {
            // `ACTIVE_RUNTIME_CONTEXT.current` can be null when the
            // host calls `handle.update(...)` outside a compute step
            // (e.g. from an async callback). Drop silently in that
            // case — the handle's slot still persists and the next
            // in-step `update` will fire.
            const liveCtx = ACTIVE_RUNTIME_CONTEXT.current;
            if (liveCtx === null) return;
            const s = liveCtx.drawingSlots.get(handleId);
            if (s === undefined || s.removed) return;
            s.state = mergeState(s.state, patch);
            emit(liveCtx, handleId, kind, "update", s.state);
        },
        remove(): void {
            const liveCtx = ACTIVE_RUNTIME_CONTEXT.current;
            if (liveCtx === null) return;
            const s = liveCtx.drawingSlots.get(handleId);
            if (s === undefined || s.removed) return;
            // Flag-before-emit is safe: capabilities are invariant
            // mid-run, so a previously-created handle's "remove" always
            // reaches `pushDrawing`. The slot stays flagged even if a
            // future drop path swallows the emission — a removed handle
            // must never re-emit.
            s.removed = true;
            emit(liveCtx, handleId, kind, "remove", s.state);
        },
    };
}
