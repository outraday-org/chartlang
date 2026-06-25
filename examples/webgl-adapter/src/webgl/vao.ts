// Ported from invinite src/components/trading-chart/webgl/vao.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import type { AttributeBinding } from "./program.js";

/**
 * Minimal structural buffer a {@link Vao} layout binds. Task 3's
 * `BufferPool` `PooledBuffer` (which also exposes a `readonly glBuffer:
 * WebGLBuffer`) structurally satisfies this, so the pool can be passed to
 * `new Vao(gl, layouts)` with no edit here — this seam keeps Task 2 free
 * of a forward import on the unwritten buffer-pool module.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const b: VaoBuffer;
 *     void b.glBuffer;
 */
export type VaoBuffer = { readonly glBuffer: WebGLBuffer };

/**
 * One attribute's vertex-array layout: which {@link AttributeBinding} to
 * wire, the {@link VaoBuffer} it reads from, the byte `stride` / `offset`
 * into that buffer, and an optional instancing `divisor` (`> 0` ⇒
 * per-instance).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const l: AttributeLayout;
 *     void l.attribute;
 */
export type AttributeLayout = {
    readonly attribute: AttributeBinding;
    readonly buffer: VaoBuffer;
    readonly stride: number;
    readonly offset: number;
    readonly divisor?: number;
};

/**
 * Wraps `gl.createVertexArray` so all the per-attribute setup
 * (`vertexAttribPointer` + `enableVertexAttribArray` + optional
 * `vertexAttribDivisor`) is captured once at construction. Subsequent
 * {@link Vao.bind} calls only re-bind the VAO handle, so a draw call is a
 * single `bindVertexArray` rather than re-specifying every attribute.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     declare const layouts: ReadonlyArray<AttributeLayout>;
 *     const vao = new Vao(gl, layouts);
 *     vao.bind();
 *     // gl.drawArrays(...)
 *     vao.unbind();
 *     vao.dispose();
 */
export class Vao {
    readonly gl: WebGL2RenderingContext;
    readonly layouts: ReadonlyArray<AttributeLayout>;
    readonly glVao: WebGLVertexArrayObject;

    private disposed = false;

    constructor(gl: WebGL2RenderingContext, layouts: ReadonlyArray<AttributeLayout>) {
        this.gl = gl;

        this.layouts = layouts;

        const vao = gl.createVertexArray();

        if (vao === null) {
            throw new Error("Vao: gl.createVertexArray returned null");
        }

        this.glVao = vao;

        gl.bindVertexArray(vao);

        for (const layout of layouts) {
            const { attribute, buffer, divisor, offset, stride } = layout;

            // Skip inactive attributes — `gl.getAttribLocation` returns
            // -1 when an attribute is declared in the shader source but
            // either stripped by the GLSL optimizer (declared `in` but
            // unused in `main()`) or never declared at all. Calling
            // `gl.enableVertexAttribArray(-1)` interprets the signed
            // value as `0xFFFFFFFF`, far past `gl.MAX_VERTEX_ATTRIBS`,
            // raising `INVALID_VALUE` every frame.
            if (attribute.location < 0) continue;

            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.glBuffer);

            gl.enableVertexAttribArray(attribute.location);

            gl.vertexAttribPointer(
                attribute.location,
                attribute.size,
                attribute.type,
                false,
                stride,
                offset,
            );

            if (divisor !== undefined && divisor > 0) {
                gl.vertexAttribDivisor(attribute.location, divisor);
            }
        }

        gl.bindVertexArray(null);
    }

    /** Bind this VAO as the current vertex array. */
    bind(): void {
        this.gl.bindVertexArray(this.glVao);
    }

    /** Unbind any vertex array (binds the null VAO). */
    unbind(): void {
        this.gl.bindVertexArray(null);
    }

    /** Delete the underlying vertex array. Idempotent. */
    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;

        this.gl.deleteVertexArray(this.glVao);
    }
}
