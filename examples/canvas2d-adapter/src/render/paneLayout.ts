// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

const PRICE_PANE_FRACTION = 0.8;

/**
 * Pixel-space rectangle for one rendered pane. Origin is the canvas
 * top-left; `y` grows downward. Read-only so layout consumers cannot
 * mutate a shared entry.
 *
 * @since 0.2
 * @stable
 * @example
 *     const rect: PaneRect = { x: 0, y: 0, w: 800, h: 280 };
 *     void rect;
 */
export type PaneRect = Readonly<{
    x: number;
    y: number;
    w: number;
    h: number;
}>;

/**
 * One pane in a computed layout: its pane key (`"overlay"` or a
 * subpane key) paired with the pixel rect it occupies.
 *
 * @since 0.2
 * @stable
 * @example
 *     const entry: PaneLayoutEntry = {
 *         paneKey: "overlay",
 *         rect: { x: 0, y: 0, w: 800, h: 280 },
 *     };
 *     void entry;
 */
export type PaneLayoutEntry = Readonly<{
    paneKey: string;
    rect: PaneRect;
}>;

/**
 * Split a canvas into one overlay (price) pane and N uniform
 * subpanes. The overlay pane gets the top 80%; subpanes share the
 * bottom 20% in `paneOrder` order. With zero subpanes the overlay
 * pane uses the full height. The last subpane absorbs the rounding
 * remainder so the rendered band fills the canvas exactly.
 *
 * @since 0.2
 * @stable
 * @example
 *     const layout = computePaneLayout(
 *         ["overlay", "rsi"],
 *         { width: 800, height: 400 },
 *     );
 *     // layout[0].rect.h === 320
 *     // layout[1].rect.h === 80
 *     void layout;
 */
export function computePaneLayout(
    paneOrder: ReadonlyArray<string>,
    canvas: { readonly width: number; readonly height: number },
): ReadonlyArray<PaneLayoutEntry> {
    const subpaneKeys = paneOrder.filter((k) => k !== "overlay");
    if (subpaneKeys.length === 0) {
        return Object.freeze([
            {
                paneKey: "overlay",
                rect: { x: 0, y: 0, w: canvas.width, h: canvas.height },
            },
        ]);
    }
    const priceHeight = Math.floor(canvas.height * PRICE_PANE_FRACTION);
    const subpaneBand = canvas.height - priceHeight;
    const subpaneHeight = Math.floor(subpaneBand / subpaneKeys.length);
    const entries: PaneLayoutEntry[] = [
        {
            paneKey: "overlay",
            rect: { x: 0, y: 0, w: canvas.width, h: priceHeight },
        },
    ];
    let y = priceHeight;
    subpaneKeys.forEach((paneKey, i) => {
        const last = i === subpaneKeys.length - 1;
        const h = last ? canvas.height - y : subpaneHeight;
        entries.push({
            paneKey,
            rect: { x: 0, y, w: canvas.width, h },
        });
        y += h;
    });
    return Object.freeze(entries);
}
