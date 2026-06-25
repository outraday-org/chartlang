// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/buffer-pool.shared.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it, vi } from "vitest";

import { BufferPool } from "./buffer-pool.js";

type StubGl = {
    ARRAY_BUFFER: number;
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
        createBuffer: vi.fn(() => {
            const handle = { handle: nextHandle };

            nextHandle += 1;

            return handle;
        }),
        deleteBuffer: vi.fn(),
        DYNAMIC_DRAW: 0x88e8,
    };

    return { gl: stub as unknown as WebGL2RenderingContext, stub };
}

const SHARED_ID = "AAPL:1d:webgl-candle-bodies:bodies";

const PANE_A = "lane-1:main";

const PANE_B = "lane-2:main";

const PANE_C = "lane-3:main";

describe("BufferPool — consumer-registry contract", () => {
    it("two consumers acquiring the same id share one PooledBuffer (and one GL buffer)", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const fromA = pool.acquire(SHARED_ID, 24, PANE_A);

        const fromB = pool.acquire(SHARED_ID, 24, PANE_B);

        expect(fromA).toBe(fromB);

        expect(fromA.cpu).toBe(fromB.cpu);

        expect(fromA.glBuffer).toBe(fromB.glBuffer);

        expect(stub.createBuffer).toHaveBeenCalledTimes(1);

        const consumers = pool.getConsumersForTests(SHARED_ID);

        expect(consumers).not.toBeNull();

        expect(consumers?.size).toBe(2);

        expect(consumers?.has(PANE_A)).toBe(true);

        expect(consumers?.has(PANE_B)).toBe(true);
    });

    it("releasing one consumer keeps the buffer alive for the remaining consumers", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        pool.acquire(SHARED_ID, 24, PANE_A);

        pool.acquire(SHARED_ID, 24, PANE_B);

        const freed = pool.disposeByConsumer(PANE_A);

        expect(freed).toEqual([]);

        expect(stub.deleteBuffer).not.toHaveBeenCalled();

        const consumers = pool.getConsumersForTests(SHARED_ID);

        expect(consumers?.size).toBe(1);

        expect(consumers?.has(PANE_B)).toBe(true);
    });

    it("releasing the last consumer frees the GL buffer once and reports the freed slot id", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        const acquired = pool.acquire(SHARED_ID, 24, PANE_A);

        pool.acquire(SHARED_ID, 24, PANE_B);

        pool.disposeByConsumer(PANE_A);

        const freed = pool.disposeByConsumer(PANE_B);

        expect(freed).toEqual([SHARED_ID]);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(1);

        expect(stub.deleteBuffer).toHaveBeenCalledWith(acquired.glBuffer);

        expect(pool.getConsumersForTests(SHARED_ID)).toBeNull();
    });

    it("disposeByConsumer releases every slot the consumer holds", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        // Pane A consumes two slots; pane B shares the first.
        pool.acquire(SHARED_ID, 24, PANE_A);

        pool.acquire(SHARED_ID, 24, PANE_B);

        pool.acquire("AAPL:1d:overlay-sma:hash:line", 60, PANE_A);

        // Releasing pane A: shared slot survives (B still consumes), the
        // A-only slot frees.
        const freed = pool.disposeByConsumer(PANE_A);

        expect(freed).toEqual(["AAPL:1d:overlay-sma:hash:line"]);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(1);

        expect(pool.getConsumersForTests(SHARED_ID)?.size).toBe(1);
    });

    it("16 consumers on the same content-key collapse to one buffer", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        for (let i = 0; i < 16; i += 1) {
            pool.acquire(SHARED_ID, 24, `lane-${i + 1}:main`);
        }

        expect(stub.createBuffer).toHaveBeenCalledTimes(1);

        expect(pool.getConsumersForTests(SHARED_ID)?.size).toBe(16);

        // Release 15 of them; buffer must survive while one consumer remains.
        for (let i = 0; i < 15; i += 1) {
            pool.disposeByConsumer(`lane-${i + 1}:main`);
        }

        expect(stub.deleteBuffer).not.toHaveBeenCalled();

        const lastFreed = pool.disposeByConsumer("lane-16:main");

        expect(lastFreed).toEqual([SHARED_ID]);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(1);
    });

    it("disposeByPrefix retains its bulk-prune semantics for full-symbol cleanup", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        pool.acquire("AAPL:1d:bodies", 24, PANE_A);

        pool.acquire("AAPL:1d:wicks", 16, PANE_A);

        pool.acquire("MSFT:1d:bodies", 24, PANE_B);

        const freed = pool.disposeByPrefix("AAPL:1d:");

        expect(freed.sort()).toEqual(["AAPL:1d:bodies", "AAPL:1d:wicks"]);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(2);

        expect(pool.getConsumersForTests("MSFT:1d:bodies")).not.toBeNull();
    });

    it("re-acquiring after a full-consumer release re-creates the buffer (clean lifecycle)", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        pool.acquire(SHARED_ID, 24, PANE_A);

        pool.disposeByConsumer(PANE_A);

        expect(stub.deleteBuffer).toHaveBeenCalledTimes(1);

        const reAcquired = pool.acquire(SHARED_ID, 24, PANE_C);

        expect(stub.createBuffer).toHaveBeenCalledTimes(2);

        expect(reAcquired.uploadedLength).toBe(0);
    });

    it("disposeByConsumer / disposeByPrefix are no-ops after a full dispose", () => {
        const { gl, stub } = makeStubGl();

        const pool = new BufferPool(gl);

        pool.acquire(SHARED_ID, 24, PANE_A);

        pool.dispose();

        stub.deleteBuffer.mockClear();

        expect(pool.disposeByConsumer(PANE_A)).toEqual([]);

        expect(pool.disposeByPrefix("AAPL")).toEqual([]);

        expect(stub.deleteBuffer).not.toHaveBeenCalled();
    });
});
