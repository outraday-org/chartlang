// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * A visible window into the world x axis (bar times in UTC ms). The two
 * self-scaled adapters (canvas2d, konva) resolve one per frame from a
 * {@link ViewController} and feed `xMin`/`xMax` into their `Viewport`.
 *
 * @since 1.6
 * @stable
 * @example
 *     const win: XWindow = { xMin: 0, xMax: 100 };
 *     void win;
 */
export type XWindow = { readonly xMin: number; readonly xMax: number };

/**
 * Construction options for {@link createViewController}. `minSpan` is the
 * smallest world-x span a zoom-in can reach (so the window never collapses
 * to a point); `maxSpanFactor` is the largest span a zoom-out can reach as
 * a multiple of the current data span (default `1` ⇒ cannot zoom out past
 * "all data visible").
 *
 * @since 1.6
 * @stable
 * @example
 *     const opts: ViewControllerOpts = { minSpan: 1, maxSpanFactor: 1 };
 *     void opts;
 */
export type ViewControllerOpts = {
    readonly minSpan?: number;
    readonly maxSpanFactor?: number;
};

/**
 * Stateful, library-agnostic pan/zoom controller for an adapter that
 * computes its own x scale every frame. It holds a user x-window plus a
 * `userInteracted` flag: until the user wheels or drags, {@link
 * ViewController.resolveXWindow} returns the full data range (auto-follow
 * live bars); after the first interaction it returns the held window
 * (re-clamped as data grows), so live frames stop snapping the view back.
 *
 * All transforms are pure functions of the current state + the supplied
 * data bounds — there is no DOM or library coupling. The example adapters
 * wire DOM events to {@link ViewController.zoomAt} / {@link
 * ViewController.panBy} / {@link ViewController.reset} via {@link
 * attachInteraction}.
 *
 * @since 1.6
 * @stable
 * @example
 *     const view = createViewController();
 *     view.resolveXWindow(0, 100); // { xMin: 0, xMax: 100 } (auto-follow)
 *     view.panBy(10, 0, 100);
 *     view.userInteracted; // true
 */
export type ViewController = {
    /** `true` once the user has zoomed or panned (auto-follow is paused). */
    readonly userInteracted: boolean;
    /**
     * The x-window to render this frame: `[dataXMin, dataXMax]` while not
     * interacted (auto-follow), else the held window clamped into the
     * current data bounds.
     */
    resolveXWindow(dataXMin: number, dataXMax: number): XWindow;
    /** Zoom by `factor` (`<1` in, `>1` out) about a world-x pivot. */
    zoomAt(pivotX: number, factor: number, dataXMin: number, dataXMax: number): void;
    /** Pan the window by a signed world-x delta. */
    panBy(deltaWorldX: number, dataXMin: number, dataXMax: number): void;
    /** Clear the held window + flag so the view auto-follows again. */
    reset(): void;
};

const DEFAULT_MIN_SPAN = 1;
const DEFAULT_MAX_SPAN_FACTOR = 1;

// Clamp a candidate window: bound its span to [minSpan, maxSpan] (maxSpan =
// dataSpan * maxSpanFactor), then shift it to sit inside [dataMin, dataMax]
// when it fits, or pin it to the full data range when it is at least as wide
// as the data. The single clamp shared by zoom / pan / resolve.
function clampWindow(
    win: XWindow,
    dataMin: number,
    dataMax: number,
    minSpan: number,
    maxSpanFactor: number,
): XWindow {
    const dataSpan = Math.max(0, dataMax - dataMin);
    const maxSpan = dataSpan * maxSpanFactor;
    let span = win.xMax - win.xMin;
    if (maxSpan > 0 && span > maxSpan) span = maxSpan;
    if (span < minSpan) span = minSpan;
    const center = (win.xMin + win.xMax) / 2;
    let xMin = center - span / 2;
    let xMax = center + span / 2;
    if (span <= dataSpan) {
        if (xMin < dataMin) {
            xMax += dataMin - xMin;
            xMin = dataMin;
        }
        if (xMax > dataMax) {
            xMin -= xMax - dataMax;
            xMax = dataMax;
        }
        return { xMin, xMax };
    }
    return { xMin: dataMin, xMax: dataMax };
}

/**
 * Build a {@link ViewController}. Pass `opts` to tune the zoom-in floor
 * (`minSpan`) and zoom-out ceiling (`maxSpanFactor`); both default to a
 * "1 ms floor, all-data ceiling" policy.
 *
 * @since 1.6
 * @stable
 * @example
 *     const view = createViewController({ minSpan: 2, maxSpanFactor: 1 });
 *     view.zoomAt(50, 0.5, 0, 100); // zoom in 2× about x=50
 *     void view.resolveXWindow(0, 100);
 */
export function createViewController(opts?: ViewControllerOpts): ViewController {
    const minSpan = opts?.minSpan ?? DEFAULT_MIN_SPAN;
    const maxSpanFactor = opts?.maxSpanFactor ?? DEFAULT_MAX_SPAN_FACTOR;
    let held: XWindow | undefined;
    let interacted = false;

    const base = (dataMin: number, dataMax: number): XWindow =>
        held ?? { xMin: dataMin, xMax: dataMax };

    return {
        get userInteracted(): boolean {
            return interacted;
        },
        resolveXWindow(dataMin: number, dataMax: number): XWindow {
            if (!interacted || held === undefined) return { xMin: dataMin, xMax: dataMax };
            return clampWindow(held, dataMin, dataMax, minSpan, maxSpanFactor);
        },
        zoomAt(pivotX: number, factor: number, dataMin: number, dataMax: number): void {
            interacted = true;
            const b = base(dataMin, dataMax);
            const span = b.xMax - b.xMin;
            const frac = span === 0 ? 0.5 : (pivotX - b.xMin) / span;
            const newSpan = span * factor;
            const xMin = pivotX - frac * newSpan;
            held = clampWindow(
                { xMin, xMax: xMin + newSpan },
                dataMin,
                dataMax,
                minSpan,
                maxSpanFactor,
            );
        },
        panBy(deltaWorldX: number, dataMin: number, dataMax: number): void {
            interacted = true;
            const b = base(dataMin, dataMax);
            held = clampWindow(
                { xMin: b.xMin + deltaWorldX, xMax: b.xMax + deltaWorldX },
                dataMin,
                dataMax,
                minSpan,
                maxSpanFactor,
            );
        },
        reset(): void {
            held = undefined;
            interacted = false;
        },
    };
}

/**
 * One candidate row for {@link yRangeInWindow}: a world `x` (bar time) plus
 * the low / high values to fold into the y range when `x` is inside the
 * window. Bars pass `{ x: time, lo: low, hi: high }`; a scalar series point
 * passes `lo === hi === value`.
 *
 * @since 1.6
 * @stable
 * @example
 *     const c: WindowYInput = { x: 10, lo: 99, hi: 101 };
 *     void c;
 */
export type WindowYInput = { readonly x: number; readonly lo: number; readonly hi: number };

/**
 * Fold the y range of every candidate whose `x` falls inside `win` — the
 * shared "auto-fit the price scale to the visible window" helper (matching
 * lightweight-charts' auto price scale). Non-finite `lo`/`hi` rows are
 * skipped. Returns `undefined` when no finite in-window candidate is seen,
 * so the caller keeps its own degenerate-range fallback. Horizontal lines
 * (no `x`) are folded in by the caller, not here.
 *
 * @since 1.6
 * @stable
 * @example
 *     const r = yRangeInWindow([{ x: 5, lo: 1, hi: 3 }], { xMin: 0, xMax: 10 });
 *     // r === { yMin: 1, yMax: 3 }
 *     void r;
 */
export function yRangeInWindow(
    candidates: Iterable<WindowYInput>,
    win: XWindow,
): { readonly yMin: number; readonly yMax: number } | undefined {
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const c of candidates) {
        if (c.x < win.xMin || c.x > win.xMax) continue;
        if (!Number.isFinite(c.lo) || !Number.isFinite(c.hi)) continue;
        if (c.lo < yMin) yMin = c.lo;
        if (c.hi > yMax) yMax = c.hi;
    }
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) return undefined;
    return { yMin, yMax };
}
