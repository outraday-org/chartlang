// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/gl-context.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

/**
 * Per-axis hardware ceiling for canvas backbuffers. Safari's WebGL2
 * implementation rejects allocations beyond 16384 × 16384; Chrome /
 * Firefox allow more but 16384 is the safe lower bound. A backbuffer
 * write that would exceed this is a runaway-resize-loop bug — see
 * {@link resolveBackbufferSize}.
 *
 * @since 0.1
 * @stable
 * @example
 *     MAX_CANVAS_PX === 16384;
 */
export const MAX_CANVAS_PX = 16384;

/**
 * The exact WebGL2 context-attribute bag. `antialias: true` turns on MSAA
 * on the default framebuffer — the core of the "smooth" look the adapter
 * brings over the canvas/SVG adapters. The bag is frozen + exported so a
 * test can assert it is byte-for-byte this set.
 *
 * @since 0.1
 * @stable
 * @example
 *     CONTEXT_OPTIONS.antialias === true;
 */
export const CONTEXT_OPTIONS: WebGLContextAttributes = Object.freeze({
    alpha: true,
    antialias: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
});

/**
 * Thrown when `getContext("webgl2")` returns null. Carries a remediation
 * hint so the surface that mounts the chart can explain the failure to the
 * user.
 *
 * @since 0.1
 * @stable
 * @example
 *     try {
 *         throw new WebGl2UnsupportedError();
 *     } catch (e) {
 *         (e as WebGl2UnsupportedError).name === "WebGl2UnsupportedError";
 *     }
 */
export class WebGl2UnsupportedError extends Error {
    constructor(message?: string) {
        super(
            message ??
                "WebGL2 is required for the WebGL chart adapter. Update your browser or enable hardware acceleration. See https://caniuse.com/webgl2.",
        );

        this.name = "WebGl2UnsupportedError";
    }
}

/**
 * Result of the SINGLE device-px rounding site. `widthPx` / `heightPx`
 * are the rounded, `MAX_CANVAS_PX`-clamped backbuffer dimensions;
 * `exceeded` is `true` when the unclamped device size tripped the ceiling
 * (a runaway-resize-loop signal the caller throws on).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const r: BackbufferSize;
 *     void r.widthPx;
 */
export type BackbufferSize = {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly exceeded: boolean;
};

/**
 * The ONE device-px rounding site: round CSS px × dpr to integer
 * backbuffer dimensions and clamp each axis to {@link MAX_CANVAS_PX}.
 * Pure — no GL, no DOM — so the rounding + clamp contract is unit-tested
 * headlessly. {@link createGlContext}'s `resize` is the only caller.
 *
 * @since 0.1
 * @stable
 * @example
 *     resolveBackbufferSize(640, 480, 2); // { widthPx: 1280, heightPx: 960, exceeded: false }
 */
export function resolveBackbufferSize(
    cssWidth: number,
    cssHeight: number,
    dpr: number,
): BackbufferSize {
    const rawWidth = Math.round(cssWidth * dpr);

    const rawHeight = Math.round(cssHeight * dpr);

    const exceeded = rawWidth > MAX_CANVAS_PX || rawHeight > MAX_CANVAS_PX;

    return {
        exceeded,
        heightPx: Math.min(rawHeight, MAX_CANVAS_PX),
        widthPx: Math.min(rawWidth, MAX_CANVAS_PX),
    };
}

/**
 * A live WebGL2 context bundle. The `dpr` / `cssWidth` / `cssHeight`
 * fields are mutable so {@link GlContext.resize} can update them in place
 * on resize without the allocation a fresh object would cost in the hot
 * path.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: GlContext;
 *     ctx.resize(800, 600, 1);
 */
export type GlContext = {
    readonly gl: WebGL2RenderingContext;
    readonly canvas: HTMLCanvasElement;
    /** Snapshot of `devicePixelRatio` at creation; updated by `resize`. */
    dpr: number;
    /** CSS-pixel size; backbuffer is `dpr * cssWidth × dpr * cssHeight`. */
    cssWidth: number;
    cssHeight: number;
    resize: (cssWidth: number, cssHeight: number, dpr: number) => void;
    dispose: () => void;
};

/**
 * Create a WebGL2 rendering context on the supplied canvas. Throws
 * {@link WebGl2UnsupportedError} when the browser cannot provide one.
 *
 * "Translate, not transcribe": invinite's `tcLog` observability, the DEV
 * `wrapGlForTracking` proxy, the rerender-storm channel, and the
 * double-DPR forensic guards are dropped — the chartlang surface is the
 * WebGL2 lifecycle only. The kept contract: the {@link CONTEXT_OPTIONS}
 * MSAA bag, the single device-px rounding site ({@link
 * resolveBackbufferSize}), the {@link MAX_CANVAS_PX} clamp (a hard throw
 * on a runaway resize), the resize short-circuit, and the dispose that
 * resets the backbuffer WITHOUT calling `loseContext()` (so a same-canvas
 * remount can recompile cleanly — see the dispose comment).
 *
 * Browser-only: this resolves a real GL context and reads canvas layout,
 * so it is exercised by the demo / react-starter build, not by the node
 * unit tests (which cover the pure {@link resolveBackbufferSize} +
 * {@link CONTEXT_OPTIONS} instead).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const canvas: HTMLCanvasElement;
 *     const ctx = createGlContext(canvas);
 *     ctx.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
 *     // … render …
 *     ctx.dispose();
 */
export function createGlContext(canvas: HTMLCanvasElement): GlContext {
    const gl = canvas.getContext("webgl2", CONTEXT_OPTIONS);

    if (gl === null) {
        throw new WebGl2UnsupportedError();
    }

    const initialDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

    // Initial CSS-px reads are STRICT: clientWidth/clientHeight only.
    // `canvas.width / canvas.height` are device-pixel backbuffer
    // dimensions from a previous mount (e.g. under React StrictMode
    // same-canvas remount) and DO NOT belong in the CSS-px slot —
    // reading them here under a 0-clientWidth race seeds a runaway
    // backbuffer-doubling cascade.
    const initialCssWidth = canvas.clientWidth;

    const initialCssHeight = canvas.clientHeight;

    let disposed = false;

    const ctx: GlContext = {
        canvas,
        cssHeight: initialCssHeight,
        cssWidth: initialCssWidth,
        dispose: () => {
            if (disposed) return;

            disposed = true;

            // Reset the backbuffer to the HTML default so a same-canvas
            // remount (StrictMode, route swap) cannot read a stale
            // device-px value back into the CSS-px slot.
            try {
                canvas.width = 300;

                canvas.height = 150;
            } catch {
                // canvas may be detached on some unmount paths — ignore.
            }

            // Intentionally NOT calling
            // `gl.getExtension("WEBGL_lose_context")?.loseContext()`. A
            // same-canvas remount re-runs setup against the same DOM
            // canvas; `canvas.getContext("webgl2")` returns the existing
            // context even after `loseContext()` flips it to lost, and a
            // lost gl makes every later `gl.createShader` return null,
            // crashing the renderer's first paint after remount. GL
            // resources are released individually via each program's /
            // buffer's `dispose` (later tasks); GC reclaims the context
            // once the canvas is unreachable.
        },
        dpr: initialDpr,
        gl,
        resize: (nextCssWidth, nextCssHeight, nextDpr) => {
            if (disposed) return;

            const { exceeded, heightPx, widthPx } = resolveBackbufferSize(
                nextCssWidth,
                nextCssHeight,
                nextDpr,
            );

            // Hard invariant: never write a backbuffer dimension above
            // the per-axis hardware ceiling. A write that would exceed it
            // is a runaway-resize-loop bug — throw so the iteration that
            // originates it fails loudly instead of silently producing a
            // black canvas.
            if (exceeded) {
                const deviceW = Math.round(nextCssWidth * nextDpr);

                const deviceH = Math.round(nextCssHeight * nextDpr);

                throw new Error(
                    `[gl-context] Refusing canvas resize ${deviceW}×${deviceH} (MAX_CANVAS_PX=${MAX_CANVAS_PX}). Inputs: cssW=${nextCssWidth}, cssH=${nextCssHeight}, dpr=${nextDpr}. This is a runaway-resize-loop. Check the call stack.`,
                );
            }

            // Short-circuit when neither the backbuffer nor the recorded
            // CSS rect actually change — the per-frame ResizeObserver path
            // may fire with a sub-pixel-jittered width that rounds to the
            // same `widthPx`. Without this guard we mutate the backbuffer
            // + run `gl.viewport` for nothing.
            if (
                canvas.width === widthPx &&
                canvas.height === heightPx &&
                ctx.cssWidth === nextCssWidth &&
                ctx.cssHeight === nextCssHeight &&
                ctx.dpr === nextDpr
            ) {
                return;
            }

            canvas.width = widthPx;

            canvas.height = heightPx;
            // CRITICAL: do NOT write `canvas.style.width / height`. The
            // canvas mounts as `absolute inset-0` from the parent; an
            // explicit `style.*` write overrides that placement and feeds
            // back into the ResizeObserver as a sub-pixel-different rect
            // on the next layout pass — a per-frame resize loop. The
            // backbuffer (`canvas.width / height`) is the ONLY thing the
            // renderer touches; the visible CSS size is owned by the
            // parent's layout rule.

            ctx.cssWidth = nextCssWidth;

            ctx.cssHeight = nextCssHeight;

            ctx.dpr = nextDpr;

            gl.viewport(0, 0, widthPx, heightPx);
        },
    };

    return ctx;
}
