// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/buffer-pool.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it, vi } from "vitest";

import { BufferPool, beginRendererFrame } from "./buffer-pool.js";

type StubGl = {
    ARRAY_BUFFER: number;
    ELEMENT_ARRAY_BUFFER: number;
    DYNAMIC_DRAW: number;
    createBuffer: ReturnType<typeof vi.fn>;
    deleteBuffer: ReturnType<typeof vi.fn>;
    bindBuffer: ReturnType<typeof vi.fn>;
    bufferData: ReturnType<typeof vi.fn>;
    bufferSubData: ReturnType<typeof vi.fn>;
};

function makeStubGl(): { stub: StubGl; gl: WebGL2RenderingContext } {
    let nextHandle = 1;

    const stub: StubGl = {
        ARRAY_BUFFER: 0x8892,
        bindBuffer: vi.fn(),
        bufferData: vi.fn(),
        bufferSubData: vi.fn(),
        createBuffer: vi.fn(() => ({ handle: nextHandle++ })),
        deleteBuffer: vi.fn(),
        DYNAMIC_DRAW: 0x88e8,
        ELEMENT_ARRAY_BUFFER: 0x8893,
    };

    return { gl: stub as unknown as WebGL2RenderingContext, stub };
}

const PANE_A = "lane-1:main";

describe("BufferPool", () => {
    it("preserves the backing Float32Array identity when length stays within capacity", () => {
        const { gl } = makeStubGl();

        const pool = new BufferPool(gl);

        const first = pool.acquire("candles", 100, PANE_A);

        const cpuRef = first.cpu;

        const initialCapacity = first.capacity;

        const second = pool.acquire("candles", 50, PANE_A);

        expect(second).toBe(first);

        expect(second.cpu).toBe(cpuRef);

        expect(second.capacity).toBe(initialCapacity);

        expect(second.length).toBe(50);
    });

    it("initialises uploadedLength to 0 on a fresh acquire", () => {
        const { gl } = makeStubGl();

        const pool = new BufferPool(gl);

        const acquired = pool.acquire("candles", 100, PANE_A);

        expect(acquired.uploadedLength).toBe(0);
    });

    it("grows the backing array (next power of two) when length exceeds capacity", () => {
        const { gl } = makeStubGl();

        const pool = new BufferPool(gl);

        const first = pool.acquire("series", 10, PANE_A);

        expect(first.capacity).toBe(16);

        // Fill the live prefix so we can check the copy preserves it.
        for (let i = 0; i < 10; i += 1) {
            first.cpu[i] = i + 1;
        }

        const grown = pool.acquire("series", 20, PANE_A);

        expect(grown).toBe(first);

        expect(grown.capacity).toBe(32);

        expect(grown.length).toBe(20);

        for (let i = 0; i < 10; i += 1) {
            expect(grown.cpu[i]).toBe(i + 1);
        }
    });

    it("resets length on re-acquire so callers know what to fill", () => {
        const { gl } = makeStubGl();

        const pool = new BufferPool(gl);

        const acquired = pool.acquire("vol", 64, PANE_A);

        expect(acquired.length).toBe(64);

        const reused = pool.acquire("vol", 8, PANE_A);

        expect(reused.length).toBe(8);
    });

    it("throws when gl.createBuffer returns null", () => {
        const { gl, stub } = makeStubGl();

        stub.createBuffer.mockReturnValueOnce(null);

        const pool = new BufferPool(gl);

        expect(() => pool.acquire("nope", 4, PANE_A)).toThrow(/createBuffer returned null/);
    });

    it("uploads using the full DYNAMIC_DRAW path and the supplied length", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const pooled = pool.acquire("upload", 4, PANE_A);

        pooled.cpu.set([1, 2, 3, 4]);

        pool.upload(pooled);

        expect(stub.bindBuffer).toHaveBeenCalledWith(stub.ARRAY_BUFFER, pooled.glBuffer);

        expect(stub.bufferData).toHaveBeenCalledWith(
            stub.ARRAY_BUFFER,
            pooled.cpu,
            stub.DYNAMIC_DRAW,
            0,
            4,
        );

        // Full upload sets uploadedLength to length so the next call can
        // route through bufferSubData.
        expect(pooled.uploadedLength).toBe(4);
    });

    it("uploads to a caller-supplied target (e.g. ELEMENT_ARRAY_BUFFER for indices)", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const pooled = pool.acquire("indices", 4, PANE_A);

        pool.upload(pooled, stub.ELEMENT_ARRAY_BUFFER);

        expect(stub.bindBuffer).toHaveBeenCalledWith(stub.ELEMENT_ARRAY_BUFFER, pooled.glBuffer);

        expect(stub.bufferData).toHaveBeenCalledWith(
            stub.ELEMENT_ARRAY_BUFFER,
            pooled.cpu,
            stub.DYNAMIC_DRAW,
            0,
            4,
        );
    });

    it("routes a steady-state dirty-range hint through bufferSubData", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const pooled = pool.acquire("tail", 8, PANE_A);

        // First upload is full (uploadedLength was 0).
        pool.upload(pooled);

        // Re-acquire at the same length so uploadedLength === length, then
        // upload only the tail with a hint.
        pool.acquire("tail", 8, PANE_A);

        pool.upload(pooled, undefined, { dirtyLength: 2, dirtyOffset: 6 });

        expect(stub.bufferSubData).toHaveBeenCalledWith(
            stub.ARRAY_BUFFER,
            6 * Float32Array.BYTES_PER_ELEMENT,
            pooled.cpu,
            6,
            2,
        );

        // Partial upload leaves uploadedLength untouched.
        expect(pooled.uploadedLength).toBe(8);
    });

    it("skips the GL call entirely when the dirty-range hint reports a clean buffer", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const pooled = pool.acquire("clean", 8, PANE_A);

        pool.upload(pooled);

        pool.acquire("clean", 8, PANE_A);

        stub.bufferData.mockClear();

        pool.upload(pooled, undefined, { dirtyLength: 0, dirtyOffset: 0 });

        expect(stub.bufferData).not.toHaveBeenCalled();

        expect(stub.bufferSubData).not.toHaveBeenCalled();
    });

    it("falls back to a full bufferData when the length changed despite a hint", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const pooled = pool.acquire("grow", 4, PANE_A);

        pool.upload(pooled);

        // Re-acquire larger (still within capacity-16) so length !== uploadedLength.
        pool.acquire("grow", 6, PANE_A);

        stub.bufferData.mockClear();

        pool.upload(pooled, undefined, { dirtyLength: 1, dirtyOffset: 5 });

        expect(stub.bufferData).toHaveBeenCalledWith(
            stub.ARRAY_BUFFER,
            pooled.cpu,
            stub.DYNAMIC_DRAW,
            0,
            6,
        );

        expect(stub.bufferSubData).not.toHaveBeenCalled();

        expect(pooled.uploadedLength).toBe(6);
    });

    it("resets uploadedLength to 0 when capacity grows so the next upload re-runs bufferData", () => {
        const { gl } = makeStubGl();

        const pool = new BufferPool(gl);

        const acquired = pool.acquire("series", 4, PANE_A);

        pool.upload(acquired);

        expect(acquired.uploadedLength).toBe(4);

        const grown = pool.acquire("series", 32, PANE_A);

        expect(grown.uploadedLength).toBe(0);
    });

    it("dispose deletes every pooled GL buffer", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const a = pool.acquire("a", 4, PANE_A);

        const b = pool.acquire("b", 8, PANE_A);

        pool.dispose();

        expect(stub.deleteBuffer).toHaveBeenCalledWith(a.glBuffer);

        expect(stub.deleteBuffer).toHaveBeenCalledWith(b.glBuffer);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(2);
    });

    it("dispose(id) frees one slot but leaves the pool usable for later acquires", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const a = pool.acquire("a", 4, PANE_A);

        pool.acquire("b", 8, PANE_A);

        pool.dispose("a");

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(1);

        expect(stub.deleteBuffer).toHaveBeenCalledWith(a.glBuffer);

        expect(pool.getSlotCountForTests()).toBe(1);

        // Still usable.
        const c = pool.acquire("c", 4, PANE_A);

        expect(c).toBeDefined();

        expect(pool.getSlotCountForTests()).toBe(2);
    });

    it("dispose(id) is a no-op for an unknown id and after full dispose", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        pool.acquire("a", 4, PANE_A);

        pool.dispose("missing");

        expect(stub.deleteBuffer).not.toHaveBeenCalled();

        pool.dispose();

        stub.deleteBuffer.mockClear();

        pool.dispose("a");

        pool.dispose();

        expect(stub.deleteBuffer).not.toHaveBeenCalled();
    });

    it("release frees the slot only when the last consumer drops", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        pool.acquire("shared", 4, PANE_A);

        pool.acquire("shared", 4, "lane-2:main");

        expect(pool.release("shared", PANE_A)).toBe(false);

        expect(stub.deleteBuffer).not.toHaveBeenCalled();

        expect(pool.release("shared", "lane-2:main")).toBe(true);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(1);

        // release on an unknown id / after disposed returns false.
        expect(pool.release("shared", PANE_A)).toBe(false);
    });

    it("gates a redundant same-frame upload for a shared non-scratch slot", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        // Two consumers → shared, non-scratch → upload-once gate active.
        const pooled = pool.acquire("shared-content", 4, PANE_A);

        pool.acquire("shared-content", 4, "lane-2:main");

        beginRendererFrame();

        pool.upload(pooled);

        const callsAfterFirst = stub.bufferData.mock.calls.length;

        // Second consumer's upload in the SAME frame short-circuits.
        pool.upload(pooled);

        expect(stub.bufferData.mock.calls.length).toBe(callsAfterFirst);
    });

    it("does NOT gate a same-frame upload for a scratch slot (divergent bytes)", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const pooled = pool.acquire("scratch-multiplex", 4, PANE_A, { scratch: true });

        pool.acquire("scratch-multiplex", 4, "lane-2:main", { scratch: true });

        beginRendererFrame();

        pool.upload(pooled);

        const first = stub.bufferData.mock.calls.length;

        pool.upload(pooled);

        // Scratch slot uploads every time even within one frame.
        expect(stub.bufferData.mock.calls.length).toBeGreaterThan(first);
    });
});
