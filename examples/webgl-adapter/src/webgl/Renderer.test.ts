// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import type { LayerDescriptor, PaneRenderState } from "../layer-descriptor.js";
import { Renderer } from "./Renderer.js";
import type { GlContext } from "./gl-context.js";

// Recording stub `WebGL2RenderingContext` — bare object with `vi.fn()`
// recorders for the calls `Renderer.beginFrame` / `drawPane` make, plus the
// integer enum constants those calls read. The same idiom as the Task-2/3
// stub-`gl` tests (`program` / `vao` / `buffer-pool`). Only the surface the
// renderer touches is implemented.
function stubGl(): WebGL2RenderingContext {
    const gl = {
        SCISSOR_TEST: 0x0c11,
        BLEND: 0x0be2,
        COLOR_BUFFER_BIT: 0x4000,
        SRC_ALPHA: 0x0302,
        ONE_MINUS_SRC_ALPHA: 0x0303,
        ONE: 1,
        disable: vi.fn(),
        enable: vi.fn(),
        clearColor: vi.fn(),
        clear: vi.fn(),
        blendFuncSeparate: vi.fn(),
        viewport: vi.fn(),
        scissor: vi.fn(),
    };
    return gl as unknown as WebGL2RenderingContext;
}

function stubGlContext(gl: WebGL2RenderingContext, cssWidth = 800, cssHeight = 400): GlContext {
    return {
        gl,
        canvas: {} as HTMLCanvasElement,
        dpr: 1,
        cssWidth,
        cssHeight,
        resize: () => {},
        dispose: () => {},
    };
}

const overlayPane: PaneRenderState = {
    paneKey: "overlay",
    window: { xMin: 0, xMax: 100, yMin: 1, yMax: 2 },
    layers: [],
};

describe("Renderer — draw loop", () => {
    it("clears the backbuffer with the X-3 scissor-clear order, then scopes the pane viewport", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        renderer.update([overlayPane]);
        renderer.drawNow();
        // beginFrame: scissor disabled → full clear → scissor + blend on.
        expect(gl.disable).toHaveBeenCalledWith(
            (gl as unknown as { SCISSOR_TEST: number }).SCISSOR_TEST,
        );
        expect(gl.clear).toHaveBeenCalledWith(
            (gl as unknown as { COLOR_BUFFER_BIT: number }).COLOR_BUFFER_BIT,
        );
        expect(gl.enable).toHaveBeenCalledWith(
            (gl as unknown as { SCISSOR_TEST: number }).SCISSOR_TEST,
        );
        expect(gl.enable).toHaveBeenCalledWith((gl as unknown as { BLEND: number }).BLEND);
        expect(gl.blendFuncSeparate).toHaveBeenCalledTimes(1);
        // Per-pane viewport + scissor scoped to the whole canvas (dpr 1).
        expect(gl.viewport).toHaveBeenCalledWith(0, 0, 800, 400);
        expect(gl.scissor).toHaveBeenCalledWith(0, 0, 800, 400);
    });

    it("draws an empty-layers pane gracefully (no dispatch)", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        renderer.update([overlayPane]);
        expect(() => renderer.drawNow()).not.toThrow();
    });

    it("dispatches a still-un-armed layer kind as a graceful no-op (text is overlay-only)", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        // `text` has no program arm — it is overlay-only (painted on the 2D
        // text overlay, never the GL pipeline), so the dispatch `default`
        // swallows it. `candle-*` (Task 6), `line-strip` (Task 7),
        // `vertical-bars` (Task 10), `filled-band` (Task 11), `cursor` /
        // `marker` (Task 12), and `drawing` (Task 13) ARE armed and build a
        // real program, so they cannot exercise the no-op path.
        const text: LayerDescriptor = {
            id: "overlay:axis-label",
            kind: "text",
            x: 0,
            y: 0,
            text: "72.50",
            color: "#ccc",
        };
        renderer.update([{ ...overlayPane, layers: [text] }]);
        expect(() => renderer.drawNow()).not.toThrow();
        // Still clears + scopes the pane even with an (un-armed) descriptor.
        expect(gl.viewport).toHaveBeenCalledTimes(1);
    });

    it("drawNow with no staged/current snapshot is a no-op", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        renderer.drawNow();
        expect(gl.clear).not.toHaveBeenCalled();
    });

    it("scheduleDraw before any update is a no-op (nothing staged)", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        expect(() => renderer.scheduleDraw()).not.toThrow();
    });
});

describe("Renderer — axes hook", () => {
    it("fires onAxes once per pane with the pane's CSS rect + window + ticks", () => {
        const gl = stubGl();
        const onAxes = vi.fn();
        const renderer = new Renderer(stubGlContext(gl), { onAxes });
        renderer.update([{ ...overlayPane, window: { xMin: 0, xMax: 100, yMin: 10, yMax: 110 } }]);
        renderer.drawNow();
        expect(onAxes).toHaveBeenCalledTimes(1);
        const info = onAxes.mock.calls[0][0];
        expect(info.paneKey).toBe("overlay");
        // MVP single-overlay layout spans the whole canvas (800×400).
        expect(info.cssRect).toEqual({ x: 0, y: 0, width: 800, height: 400 });
        expect(info.window).toEqual({ xMin: 0, xMax: 100, yMin: 10, yMax: 110 });
        expect(info.ticks.priceTicks.length).toBeGreaterThan(0);
        expect(info.ticks.timeTicks.length).toBeGreaterThan(0);
    });

    it("does not fire onAxes (nor build a grid) when neither is configured", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        renderer.update([overlayPane]);
        expect(() => renderer.drawNow()).not.toThrow();
        // Still clears + scopes the pane; no axes pass means no extra dispatch.
        expect(gl.viewport).toHaveBeenCalledTimes(1);
    });
});

describe("Renderer — error routing", () => {
    it("routes a per-pane draw error to options.onError instead of throwing", () => {
        const gl = stubGl();
        const boom = new Error("scissor boom");
        // Make the per-pane `scissor` throw to exercise the catch arm.
        (gl.scissor as ReturnType<typeof vi.fn>).mockImplementation(() => {
            throw boom;
        });
        const onError = vi.fn();
        const renderer = new Renderer(stubGlContext(gl), { onError });
        renderer.update([overlayPane]);
        expect(() => renderer.drawNow()).not.toThrow();
        expect(onError).toHaveBeenCalledWith(boom);
    });

    it("rethrows a per-pane draw error when no onError is supplied", () => {
        const gl = stubGl();
        const boom = new Error("scissor boom");
        (gl.scissor as ReturnType<typeof vi.fn>).mockImplementation(() => {
            throw boom;
        });
        const renderer = new Renderer(stubGlContext(gl));
        renderer.update([overlayPane]);
        expect(() => renderer.drawNow()).toThrow("scissor boom");
    });
});

describe("Renderer — dispose", () => {
    it("is idempotent and flips isDisposed", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        expect(renderer.isDisposed).toBe(false);
        renderer.dispose();
        renderer.dispose();
        expect(renderer.isDisposed).toBe(true);
    });

    it("no-ops update / scheduleDraw / drawNow after dispose", () => {
        const gl = stubGl();
        const renderer = new Renderer(stubGlContext(gl));
        renderer.dispose();
        renderer.update([overlayPane]);
        renderer.scheduleDraw();
        renderer.drawNow();
        expect(gl.clear).not.toHaveBeenCalled();
        expect(gl.viewport).not.toHaveBeenCalled();
    });
});
