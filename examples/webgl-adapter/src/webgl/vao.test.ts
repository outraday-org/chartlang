// Ported from invinite src/components/trading-chart/webgl/vao.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it, vi } from "vitest";

import type { AttributeBinding } from "./program.js";
import { type AttributeLayout, Vao, type VaoBuffer } from "./vao.js";

// Stub gl that records the VAO setup call sequence so `Vao` runs
// headlessly in node — the raw `gl.*` calls are exercised browser-only.
function makeStubGl(createVaoResult: WebGLVertexArrayObject | null = { kind: "vao" } as never) {
    const stub = {
        ARRAY_BUFFER: 0x8892,
        FLOAT: 0x1406,
        bindBuffer: vi.fn(),
        bindVertexArray: vi.fn(),
        createVertexArray: vi.fn(() => createVaoResult),
        deleteVertexArray: vi.fn(),
        enableVertexAttribArray: vi.fn(),
        vertexAttribDivisor: vi.fn(),
        vertexAttribPointer: vi.fn(),
    };

    return { gl: stub as unknown as WebGL2RenderingContext, stub };
}

function attribute(location: number): AttributeBinding {
    return { location, name: `a${location}`, size: 2, type: 0x1406 };
}

function buffer(): VaoBuffer {
    return { glBuffer: { kind: "buffer" } as unknown as WebGLBuffer };
}

describe("Vao", () => {
    it("binds the VAO, wires each active layout, then unbinds at construction", () => {
        const { gl, stub } = makeStubGl();

        const layouts: ReadonlyArray<AttributeLayout> = [
            { attribute: attribute(0), buffer: buffer(), offset: 0, stride: 8 },
        ];

        const vao = new Vao(gl, layouts);

        expect(stub.createVertexArray).toHaveBeenCalledTimes(1);

        // bind(vao) at start, bind(null) at end.
        expect(stub.bindVertexArray).toHaveBeenNthCalledWith(1, vao.glVao);

        expect(stub.bindVertexArray).toHaveBeenLastCalledWith(null);

        expect(stub.bindBuffer).toHaveBeenCalledWith(stub.ARRAY_BUFFER, expect.anything());

        expect(stub.enableVertexAttribArray).toHaveBeenCalledWith(0);

        expect(stub.vertexAttribPointer).toHaveBeenCalledWith(0, 2, stub.FLOAT, false, 8, 0);

        // No divisor on this layout.
        expect(stub.vertexAttribDivisor).not.toHaveBeenCalled();
    });

    it("applies vertexAttribDivisor only when divisor > 0", () => {
        const { gl, stub } = makeStubGl();

        new Vao(gl, [
            { attribute: attribute(1), buffer: buffer(), divisor: 1, offset: 0, stride: 16 },
            { attribute: attribute(2), buffer: buffer(), divisor: 0, offset: 0, stride: 16 },
        ]);

        expect(stub.vertexAttribDivisor).toHaveBeenCalledTimes(1);

        expect(stub.vertexAttribDivisor).toHaveBeenCalledWith(1, 1);
    });

    it("skips a layout whose attribute location is -1 (inactive attribute)", () => {
        const { gl, stub } = makeStubGl();

        new Vao(gl, [{ attribute: attribute(-1), buffer: buffer(), offset: 0, stride: 8 }]);

        expect(stub.enableVertexAttribArray).not.toHaveBeenCalled();

        expect(stub.vertexAttribPointer).not.toHaveBeenCalled();

        expect(stub.bindBuffer).not.toHaveBeenCalled();
    });

    it("bind / unbind route to bindVertexArray", () => {
        const { gl, stub } = makeStubGl();

        const vao = new Vao(gl, []);

        stub.bindVertexArray.mockClear();

        vao.bind();

        expect(stub.bindVertexArray).toHaveBeenCalledWith(vao.glVao);

        vao.unbind();

        expect(stub.bindVertexArray).toHaveBeenCalledWith(null);
    });

    it("dispose deletes the vertex array exactly once (idempotent)", () => {
        const { gl, stub } = makeStubGl();

        const vao = new Vao(gl, []);

        vao.dispose();

        vao.dispose();

        expect(stub.deleteVertexArray).toHaveBeenCalledTimes(1);
    });

    it("throws when gl.createVertexArray returns null", () => {
        const { gl } = makeStubGl(null);

        expect(() => new Vao(gl, [])).toThrow(/createVertexArray returned null/);
    });
});
