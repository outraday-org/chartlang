// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ViewController } from "./viewController.js";

// Wheel notch → zoom factor sensitivity. A positive `deltaY` (scroll down)
// yields a factor > 1 (zoom out); negative (scroll up) yields < 1 (zoom in).
// `Math.exp` keeps both directions symmetric, so zoom-out always exists —
// the bug the native-default drag-zoom-in lacked.
const DEFAULT_ZOOM_STEP = 0.0015;

/**
 * The per-frame projection + data context {@link attachInteraction} needs
 * to translate pixel gestures into world-x transforms. The adapter supplies
 * these closing over its latest overlay `Viewport`, so the math always uses
 * the current frame's scale.
 *
 * @since 1.6
 * @stable
 * @example
 *     declare const view: import("./viewController.js").ViewController;
 *     const h: InteractionHandlers = {
 *         controller: view,
 *         pxToWorldX: (px) => px,
 *         worldXPerPx: () => 1,
 *         dataBounds: () => ({ xMin: 0, xMax: 100 }),
 *         requestRender: () => {},
 *     };
 *     void h;
 */
export type InteractionHandlers = {
    /** The controller whose window the gestures mutate. */
    readonly controller: ViewController;
    /** Map a plot-area pixel x to a world x for the current frame. */
    readonly pxToWorldX: (px: number) => number;
    /** World-x units per pixel for the current frame (pan delta scale). */
    readonly worldXPerPx: () => number;
    /** The current data x extent (grows as bars stream in). */
    readonly dataBounds: () => { readonly xMin: number; readonly xMax: number };
    /** Re-render the adapter after a gesture mutates the window. */
    readonly requestRender: () => void;
    /** Override the wheel zoom sensitivity (default {@link DEFAULT_ZOOM_STEP}). */
    readonly zoomStep?: number;
};

/**
 * Apply one wheel notch: zoom the controller about the world-x under the
 * cursor, then request a render. Pure on `(offsetX, deltaY)` so it is unit
 * tested without a DOM event.
 *
 * @since 1.6
 * @stable
 * @example
 *     declare const h: InteractionHandlers;
 *     onWheelCore(h, 50, -120); // zoom in about pixel x=50
 */
export function onWheelCore(h: InteractionHandlers, offsetX: number, deltaY: number): void {
    const factor = Math.exp(deltaY * (h.zoomStep ?? DEFAULT_ZOOM_STEP));
    const { xMin, xMax } = h.dataBounds();
    h.controller.zoomAt(h.pxToWorldX(offsetX), factor, xMin, xMax);
    h.requestRender();
}

/**
 * Apply one drag step: pan the controller by the pixel delta converted to
 * world x (dragging right reveals earlier data), then request a render.
 * Pure on `dxPx`.
 *
 * @since 1.6
 * @stable
 * @example
 *     declare const h: InteractionHandlers;
 *     onDragCore(h, 12); // pan left by 12 px
 */
export function onDragCore(h: InteractionHandlers, dxPx: number): void {
    const { xMin, xMax } = h.dataBounds();
    h.controller.panBy(-dxPx * h.worldXPerPx(), xMin, xMax);
    h.requestRender();
}

/**
 * Apply a double-click: reset the controller to auto-follow, then request a
 * render.
 *
 * @since 1.6
 * @stable
 * @example
 *     declare const h: InteractionHandlers;
 *     onDblCore(h);
 */
export function onDblCore(h: InteractionHandlers): void {
    h.controller.reset();
    h.requestRender();
}

/**
 * Wire wheel-zoom, drag-pan, and double-click-reset on `el`, driving the
 * supplied {@link InteractionHandlers}. Returns a detach function that
 * removes every listener (call it from the adapter's `dispose`). The
 * `addEventListener` plumbing is the only DOM-bound part; the decision
 * logic lives in {@link onWheelCore} / {@link onDragCore} / {@link
 * onDblCore}, which are unit tested directly.
 *
 * @since 1.6
 * @stable
 * @example
 *     declare const el: HTMLElement;
 *     declare const h: InteractionHandlers;
 *     const detach = attachInteraction(el, h);
 *     detach();
 */
/* v8 ignore start -- DOM event plumbing; the pure cores above carry the coverage */
export function attachInteraction(el: HTMLElement, h: InteractionHandlers): () => void {
    let dragging = false;
    let lastX = 0;

    const onWheel = (e: WheelEvent): void => {
        e.preventDefault();
        onWheelCore(h, e.offsetX, e.deltaY);
    };
    const onPointerDown = (e: PointerEvent): void => {
        dragging = true;
        lastX = e.clientX;
        el.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent): void => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        onDragCore(h, dx);
    };
    const onPointerUp = (e: PointerEvent): void => {
        dragging = false;
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const onDblClick = (): void => {
        onDblCore(h);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("dblclick", onDblClick);

    return (): void => {
        el.removeEventListener("wheel", onWheel);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("dblclick", onDblClick);
    };
}
/* v8 ignore stop */
