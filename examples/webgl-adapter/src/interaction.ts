// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { type ViewController, attachInteraction } from "@invinite-org/chartlang-adapter-kit";

/**
 * The minimal projection slice {@link attachChartInteraction} reads each
 * gesture: the current overlay pane's world x-window + its plot-area pixel
 * width. The factory supplies a `getViewport` closure returning the LATEST
 * value (it changes every frame as the window pans / zooms and as the canvas
 * resizes), so the px↔world math always uses the current scale — exactly how
 * canvas2d / uplot close over their last overlay `Viewport`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const v: InteractionViewport = { xMin: 0, xMax: 100, pxWidth: 800 };
 *     void v;
 */
export type InteractionViewport = {
    readonly xMin: number;
    readonly xMax: number;
    readonly pxWidth: number;
};

/**
 * Map a plot-area pixel x to a world x for the supplied frame viewport. Pure —
 * the closure {@link attachChartInteraction} hands the shared
 * `attachInteraction` as `pxToWorldX`. A zero-width viewport returns `xMin`
 * (no projection possible) rather than dividing by zero.
 *
 * @since 0.1
 * @stable
 * @example
 *     pxToWorldX({ xMin: 0, xMax: 100, pxWidth: 800 }, 400); // 50
 */
export function pxToWorldX(view: InteractionViewport, px: number): number {
    if (view.pxWidth <= 0) return view.xMin;
    return view.xMin + (px / view.pxWidth) * (view.xMax - view.xMin);
}

/**
 * World-x units per pixel for the supplied frame viewport — the pan-delta scale
 * `attachInteraction` reads as `worldXPerPx`. A zero-width viewport returns `0`
 * (a pan with no scale is a no-op) rather than dividing by zero.
 *
 * @since 0.1
 * @stable
 * @example
 *     worldXPerPx({ xMin: 0, xMax: 100, pxWidth: 800 }); // 0.125
 */
export function worldXPerPx(view: InteractionViewport): number {
    if (view.pxWidth <= 0) return 0;
    return (view.xMax - view.xMin) / view.pxWidth;
}

/**
 * Options for {@link attachChartInteraction}. `controller` is the shared
 * adapter-kit {@link ViewController} the gestures mutate (the SAME one
 * `buildFrame` resolves its window from); `getViewport` returns the current
 * overlay frame; `dataBounds` returns the live world x-extent (grows as bars
 * stream in); `requestRender` re-runs the frame after a gesture.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const o: AttachChartInteractionOpts;
 *     void o;
 */
export type AttachChartInteractionOpts = {
    readonly controller: ViewController;
    readonly getViewport: () => InteractionViewport;
    readonly dataBounds: () => { readonly xMin: number; readonly xMax: number };
    readonly requestRender: () => void;
    readonly zoomStep?: number;
};

/**
 * Wire wheel-zoom / drag-pan / double-click-reset on a chart canvas to the
 * shared {@link ViewController}, returning a detach fn (call it from
 * `dispose`). This is the ONE interaction contract across adapters — it does
 * NOT fork invinite's `ChartController`; it builds the shared
 * {@link import("@invinite-org/chartlang-adapter-kit").InteractionHandlers}
 * (closing over the live {@link InteractionViewport} via {@link pxToWorldX} /
 * {@link worldXPerPx}) and delegates to `attachInteraction`. So
 * `initialVisibleBars` auto-follow + held-window semantics match canvas2d /
 * uplot exactly. `requestRender` repaints after each gesture (the run loop only
 * repaints on candle events).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { attachChartInteraction } from "chartlang-example-webgl-adapter";
 *     import { createViewController } from "@invinite-org/chartlang-adapter-kit";
 *     declare const canvas: HTMLCanvasElement;
 *     const detach = attachChartInteraction(canvas, {
 *         controller: createViewController(),
 *         getViewport: () => ({ xMin: 0, xMax: 100, pxWidth: 800 }),
 *         dataBounds: () => ({ xMin: 0, xMax: 100 }),
 *         requestRender: () => {},
 *     });
 *     detach();
 */
export function attachChartInteraction(
    el: HTMLElement,
    opts: AttachChartInteractionOpts,
): () => void {
    return attachInteraction(el, {
        controller: opts.controller,
        pxToWorldX: (px) => pxToWorldX(opts.getViewport(), px),
        worldXPerPx: () => worldXPerPx(opts.getViewport()),
        dataBounds: opts.dataBounds,
        requestRender: opts.requestRender,
        ...(opts.zoomStep !== undefined ? { zoomStep: opts.zoomStep } : {}),
    });
}
