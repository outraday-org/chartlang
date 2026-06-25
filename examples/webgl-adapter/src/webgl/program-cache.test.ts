// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/program-cache.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it, vi } from "vitest";

import { clearProgramCache, getProgram } from "./program-cache.js";

// The cache only keys on object identity, so a bare object cast to the gl
// type is a sufficient WeakMap key — no real GL context is needed.
function fakeGl(): WebGL2RenderingContext {
    return {} as unknown as WebGL2RenderingContext;
}

describe("getProgram", () => {
    it("returns the same instance for the same (gl, key) and runs the factory once", () => {
        const gl = fakeGl();

        const factory = vi.fn(() => ({ dispose: vi.fn() }));

        const first = getProgram(gl, "line-strip", factory);

        const second = getProgram(gl, "line-strip", factory);

        expect(second).toBe(first);

        expect(factory).toHaveBeenCalledTimes(1);
    });

    it("returns distinct instances for different keys on the same gl", () => {
        const gl = fakeGl();

        const a = getProgram(gl, "candle-bodies", () => ({ dispose: vi.fn() }));

        const b = getProgram(gl, "candle-wicks", () => ({ dispose: vi.fn() }));

        expect(a).not.toBe(b);
    });

    it("returns a fresh instance per gl context (same key)", () => {
        const glA = fakeGl();

        const glB = fakeGl();

        const factory = vi.fn(() => ({ dispose: vi.fn() }));

        const a = getProgram(glA, "line-strip", factory);

        const b = getProgram(glB, "line-strip", factory);

        expect(a).not.toBe(b);

        expect(factory).toHaveBeenCalledTimes(2);
    });
});

describe("clearProgramCache", () => {
    it("disposes every cached program and drops the gl entry so the next get recompiles", () => {
        const gl = fakeGl();

        const disposeA = vi.fn();

        const disposeB = vi.fn();

        getProgram(gl, "a", () => ({ dispose: disposeA }));

        getProgram(gl, "b", () => ({ dispose: disposeB }));

        clearProgramCache(gl);

        expect(disposeA).toHaveBeenCalledTimes(1);

        expect(disposeB).toHaveBeenCalledTimes(1);

        // After clearing, a fresh factory runs again for the same key.
        const factory = vi.fn(() => ({ dispose: vi.fn() }));

        getProgram(gl, "a", factory);

        expect(factory).toHaveBeenCalledTimes(1);
    });

    it("is a no-op for a gl with no cached programs", () => {
        expect(() => clearProgramCache(fakeGl())).not.toThrow();
    });
});
