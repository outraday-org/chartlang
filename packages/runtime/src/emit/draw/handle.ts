// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingHandle, DrawingKind, DrawingState } from "@invinite-org/chartlang-core";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type DrawingSlot,
    type RuntimeContext,
} from "../../runtimeContext.js";
import { pushDrawing } from "./pushDrawing.js";

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

/**
 * Lift the presentation-only `z` (render-order key) **out** of a
 * drawing's `state.style` and hand it back to the caller, returning a
 * state with `z` removed from a **shallow clone** of `style` (the
 * caller's style object is never mutated). Every `draw.*` option bag
 * carries `z` via core's `ZOrdered` mixin, and the per-kind impls fold
 * that bag into `state.style`, so `z` arrives nested at `state.style.z`.
 * `z` is a **top-level** `DrawingEmission` field, not part of
 * `DrawingState`, so it must not ride the wire inside `state` — strip it
 * here. Returns `z: 0` (the omit-when-`0` default) for states with no
 * `style` (e.g. `group`) or no `z`, leaving the state object **untouched**
 * in that case so a no-`z` drawing stays byte-identical to the
 * pre-feature baseline.
 */
function splitZ(state: DrawingState): { state: DrawingState; z: number } {
    if (!("style" in state) || state.style === undefined) {
        return { state, z: 0 };
    }
    const style: { z?: number } = state.style;
    if (style.z === undefined) {
        return { state, z: 0 };
    }
    // Shallow-clone style with `z` removed — never mutate the caller's
    // object. `rest` is z-free, so the wire `state.style` carries no `z`.
    const { z, ...rest } = style;
    return { state: { ...state, style: rest } as DrawingState, z };
}

function emit(
    ctx: RuntimeContext,
    handleId: string,
    kind: DrawingKind,
    op: "create" | "update" | "remove",
    state: DrawingState,
    z: number,
): void {
    pushDrawing(ctx, {
        kind: "drawing",
        handleId,
        drawingKind: kind,
        op,
        state,
        bar: ctx.barIndex(),
        time: ctx.stream.bar.time,
        // `z` is presentation-only and top-level (never inside `state`);
        // omit it when `0` so a no-`z` drawing is byte-identical to the
        // pre-feature baseline — mirrors `PlotEmission.xShift` / `.z`.
        ...(z === 0 ? {} : { z }),
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
 * re-emits the FULL merged state under `op: "update"`. `remove()`
 * emits one final `op: "remove"` with the
 * last-known state and flags the slot `removed: true`; subsequent
 * `update` / `remove` calls on the returned handle are no-ops.
 *
 * The handle's `id` is `slotId#subId` — stable across bars.
 *
 * `z` is the presentation-only render-order key the `draw.*` opts bag
 * carried (core's `ZOrdered` mixin) folded into `state.style`. It is
 * {@link splitZ | lifted out} of `state.style` so it rides the wire as
 * the top-level {@link DrawingEmission.z} field, **never** inside
 * `DrawingState` (Task 3 forbids `z` in `state`), and is persisted on
 * the slot. An `update` that does not re-specify a non-zero `z` retains
 * the last value; a re-specified non-zero `z` overrides; `remove`
 * carries the last-known `z`.
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

    // Lift `z` out of `state.style` so it rides the emission top-level,
    // not inside `DrawingState`. The remaining `style` (z removed) is
    // what persists in the slot.
    const initial = splitZ(initialState);

    let slot: DrawingSlot;
    let op: "create" | "update";
    if (existing === undefined) {
        slot = { handleId, kind, state: initial.state, z: initial.z, removed: false };
        ctx.drawingSlots.set(handleId, slot);
        op = "create";
    } else {
        // Cross-bar re-entry. Merge initialState into the existing slot
        // (script-author may pass new anchors / style); resurrect if it
        // was previously removed. A re-specified `z` (non-default)
        // overrides the retained one; an omitted/`0` `z` keeps the last.
        existing.state = mergeState(existing.state, initial.state);
        if (initial.z !== 0) existing.z = initial.z;
        existing.removed = false;
        slot = existing;
        op = "update";
    }

    emit(ctx, handleId, kind, op, slot.state, slot.z);

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
            // A patch may re-specify `z` inside `style`; split it out so
            // it never merges into `state.style`. A re-specified
            // non-default `z` overrides; an omitted/`0` `z` retains the
            // slot's last value.
            const split = splitZ(mergeState(s.state, patch));
            s.state = split.state;
            if (split.z !== 0) s.z = split.z;
            emit(liveCtx, handleId, kind, "update", s.state, s.z);
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
            // must never re-emit. `remove` carries the last-known `z`
            // (harmless — no render).
            s.removed = true;
            emit(liveCtx, handleId, kind, "remove", s.state, s.z);
        },
    };
}
