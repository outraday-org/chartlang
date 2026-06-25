// Ported from invinite src/components/trading-chart/webgl/programs/base-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's engine/model (MIT, Uber / vis.gl),
// re-implemented in-tree — NOT an npm dependency on luma.gl. invinite's
// `import.meta.env.DEV` shared-pool hash check + `tcLog` were dropped (the
// former is Vite-only / undefined under node vitest; see buffer-pool.ts).

import { BufferPool } from "../buffer-pool.js";
import type { PooledBuffer, UploadHint } from "../buffer-pool.js";
import { Program } from "../program.js";
import type { Vao } from "../vao.js";

/**
 * Immutable shader / introspection contract a subclass passes to
 * `super(gl, spec)`. The per-instance state (VAO cache, buffer pool) lives
 * on the {@link BaseProgram} instance, not here.
 *
 * @since 0.1
 * @stable
 * @example
 *     const spec: BaseProgramSpec = {
 *         vsSource: "#version 300 es\nvoid main(){gl_Position=vec4(0.);}",
 *         fsSource: "#version 300 es\nprecision mediump float;\nout vec4 o;\nvoid main(){o=vec4(1.);}",
 *         attributes: [],
 *         uniforms: [],
 *         poolKeySuffix: "bodies",
 *     };
 *     void spec;
 */
export type BaseProgramSpec = {
    readonly vsSource: string;
    readonly fsSource: string;
    readonly attributes: ReadonlyArray<string>;
    readonly uniforms: ReadonlyArray<string>;
    /**
     * Suffix appended to the descriptor's `id` to form the per-pane pool key
     * (`${descriptor.id}:${poolKeySuffix}`). Subclasses with a non-canonical
     * draw flow (e.g. line-strip's shared instance buffer, Task 7) override
     * `draw` via {@link BaseProgram.drawOverride} and may ignore this.
     */
    readonly poolKeySuffix: string;
};

/**
 * The draw-arg shape every program receives from the renderer's dispatch
 * seam. `viewportWidthPx` / `viewportHeightPx` feed the `project32`
 * device-px snapping shader (the bar programs consume them); `dpr` scales
 * the CSS-px widths to device-px. `paneKey` is the consumer key threaded
 * into `bufferPool.acquire(...)` so the consumer registry attributes slot
 * ownership to the pane (sibling panes sharing a content-keyed slot free it
 * only on the LAST release).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: DrawArgs<{ id: string; rowCount?: number }>;
 *     void args.projection;
 */
export type DrawArgs<TDescriptor> = {
    readonly descriptor: TDescriptor;
    readonly projection: Float32Array;
    readonly viewportWidthPx: number;
    readonly viewportHeightPx: number;
    readonly dpr: number;
    readonly paneKey: string;
};

/**
 * Minimal contract every program descriptor satisfies: a stable `id` for
 * pool / VAO keying + an optional `rowCount` (the instance count of the
 * canonical `drawArraysInstanced` call). `rowCount` is optional so a
 * subclass with a fully-overridden `draw` (line-strip packs by `pointCount`,
 * Task 7) can declare a descriptor that omits it.
 *
 * @since 0.1
 * @stable
 * @example
 *     const d: BaseDescriptor = { id: "overlay:candle-bodies", rowCount: 3 };
 *     void d;
 */
export type BaseDescriptor = {
    readonly id: string;
    readonly rowCount?: number;
};

// Read an optional dirty-range hint off a descriptor without an `any` cast.
// Our Task-4 descriptors do not carry `dirtyOffset`/`dirtyLength` yet, so
// this resolves to `-1` and every upload is a full `bufferData`. The
// partial-upload path is kept (correctness contract, forward-compatible) but
// is v8-ignored: no test drives a hint through the example adapter.
type MaybeDirty = { readonly dirtyOffset?: unknown; readonly dirtyLength?: unknown };

function readDirty(descriptor: BaseDescriptor): { offset: number; length: number } {
    const maybe = descriptor as BaseDescriptor & MaybeDirty;
    const offset = typeof maybe.dirtyOffset === "number" ? maybe.dirtyOffset : -1;
    const length = typeof maybe.dirtyLength === "number" ? maybe.dirtyLength : -1;
    return { length, offset };
}

/**
 * Abstract GL-program lifecycle. Owns a {@link Program} + {@link BufferPool}
 * + a `vaoCache: Map<poolKey, Vao>` + a `disposed` flag, and runs the
 * canonical `pack → acquire → upload → buildVao (first per-pane miss) →
 * setUniforms → onBeforeDraw? → bind → drawCall → unbind` flow. Subclasses
 * implement the program-specific `pack` / `buildVao` / `setUniforms` /
 * `clearCacheSlot`; optional hooks (`onBeforeDraw` / `drawOverride` /
 * `prunePaneOverride` / `cleanupExtras`) let a divergent program replace
 * pieces of the orchestration without re-implementing it. Kept general so
 * Task 7's line-strip program extends it cleanly.
 *
 * @since 0.1
 * @stable
 * @example
 *     // Subclasses call `super(gl, spec)` and implement the abstract members;
 *     // see candle-bodies-program.ts for a concrete instanced-quad program.
 *     declare const spec: BaseProgramSpec;
 *     void spec;
 */
export abstract class BaseProgram<TDescriptor extends BaseDescriptor> {
    readonly gl: WebGL2RenderingContext;

    protected readonly program: Program;
    protected readonly bufferPool: BufferPool;
    protected readonly vaoCache: Map<string, Vao>;
    protected readonly poolKeySuffix: string;
    private disposedFlag = false;

    protected constructor(gl: WebGL2RenderingContext, spec: BaseProgramSpec) {
        this.gl = gl;
        this.program = new Program(
            gl,
            spec.vsSource,
            spec.fsSource,
            spec.attributes,
            spec.uniforms,
        );
        this.bufferPool = new BufferPool(gl);
        this.vaoCache = new Map();
        this.poolKeySuffix = spec.poolKeySuffix;
    }

    /** Public read of the private `disposed` flag — lets the program-cache / renderer null-guard. */
    get isDisposed(): boolean {
        return this.disposedFlag;
    }

    /** Subclass returns the Float32 view to upload (typically a subarray of the descriptor's `rows`). */
    protected abstract pack(descriptor: TDescriptor): Float32Array;

    /** Subclass builds the VAO bindings on the first per-pane miss. */
    protected abstract buildVao(pooled: PooledBuffer, descriptor: TDescriptor): Vao;

    /** Subclass writes program-specific uniforms (after `program.use()`). */
    protected abstract setUniforms(args: DrawArgs<TDescriptor>): void;

    /** Subclass clears its own slot in the per-`gl` program cache (dispose hook). */
    protected abstract clearCacheSlot(): void;

    /**
     * Default draw call: TRIANGLE_STRIP, 4 corners, instance count =
     * `descriptor.rowCount`. Subclasses with a different instance shape
     * override.
     */
    protected drawCall(args: DrawArgs<TDescriptor>): void {
        const instanceCount = args.descriptor.rowCount ?? 0;
        this.gl.drawArraysInstanced(this.gl.TRIANGLE_STRIP, 0, 4, instanceCount);
    }

    /**
     * Optional hook fired immediately before `vao.bind()` + draw. Subclasses
     * use this to set blend state (the candle programs enable
     * `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`) after `setUniforms` but before the
     * draw call.
     */
    protected onBeforeDraw?(args: DrawArgs<TDescriptor>): void;

    /**
     * Optional override that fully replaces the canonical `draw` pipeline.
     * Used by a subclass whose draw shape diverges fundamentally from the
     * pack → upload → per-pane VAO → draw orchestration (Task 7's line-strip
     * shared VAO + segment-count draw).
     */
    protected drawOverride?(args: DrawArgs<TDescriptor>): void;

    /**
     * Optional override replacing the default `vaoCache` walk for
     * `prunePane`. Used by a subclass whose per-pane state carries extra GL
     * resources to release in lockstep with the pool slot.
     */
    protected prunePaneOverride?(paneKey: string): void;

    /**
     * Optional override called from `dispose()` after the base class releases
     * the shared resources. Subclasses use it to release subclass-specific
     * resources (the static unit-quad buffer the candle programs own).
     */
    protected cleanupExtras?(): void;

    /**
     * Run the program for one descriptor + pane. The canonical flow; a
     * subclass's `drawOverride` short-circuits it entirely. A `disposed`
     * program or a zero-row descriptor is a no-op.
     */
    /* v8 ignore start -- gl.* draw flow is browser-only; the example adapter is not coverage-gated */
    draw(args: DrawArgs<TDescriptor>): void {
        if (this.disposedFlag) return;

        if (this.drawOverride !== undefined) {
            this.drawOverride(args);
            return;
        }

        const { descriptor, paneKey } = args;
        if ((descriptor.rowCount ?? 0) === 0) return;

        const poolKey = `${descriptor.id}:${this.poolKeySuffix}`;
        const packed = this.pack(descriptor);
        const pooled = this.bufferPool.acquire(poolKey, packed.length, paneKey);

        // Dirty-range routing (correctness parity with invinite). Our Task-4
        // descriptors carry no dirty range yet, so `useHint` is always false
        // and every upload is a full `bufferData`; the partial branch is kept
        // forward-compatible.
        const { offset: dirtyOffset, length: dirtyLength } = readDirty(descriptor);
        const useHint =
            dirtyOffset >= 0 &&
            dirtyLength > 0 &&
            pooled.uploadedLength === pooled.length &&
            pooled.uploadedLength > 0;

        if (useHint) {
            pooled.cpu.set(packed.subarray(dirtyOffset, dirtyOffset + dirtyLength), dirtyOffset);
            const hint: UploadHint = { dirtyLength, dirtyOffset };
            this.bufferPool.upload(pooled, this.gl.ARRAY_BUFFER, hint);
        } else {
            pooled.cpu.set(packed, 0);
            this.bufferPool.upload(pooled);
        }

        let vao = this.vaoCache.get(poolKey);
        if (vao === undefined) {
            vao = this.buildVao(pooled, descriptor);
            this.vaoCache.set(poolKey, vao);
        }

        this.program.use();
        this.setUniforms(args);
        this.onBeforeDraw?.(args);
        vao.bind();
        this.drawCall(args);
        vao.unbind();
    }

    /**
     * Release every slot + VAO this `paneKey` consumed. The consumer-registry
     * release returns the slot ids whose consumer set drained; the matching
     * VAO references the now-deleted GL buffer and MUST be disposed in
     * lockstep. A subclass with extra per-pane GL state overrides via
     * {@link BaseProgram.prunePaneOverride}.
     */
    prunePane(paneKey: string): void {
        if (this.disposedFlag) return;

        if (this.prunePaneOverride !== undefined) {
            this.prunePaneOverride(paneKey);
            return;
        }

        const freed = this.bufferPool.disposeByConsumer(paneKey);
        for (const slotId of freed) {
            const vao = this.vaoCache.get(slotId);
            if (vao === undefined) continue;
            vao.dispose();
            this.vaoCache.delete(slotId);
        }
    }
    /* v8 ignore stop */

    /**
     * Release all GL resources: every cached VAO, the buffer pool, the
     * program, plus any subclass extras (`cleanupExtras`), then clear the
     * per-`gl` program-cache slot. Idempotent — a second call is a no-op.
     */
    dispose(): void {
        if (this.disposedFlag) return;
        this.disposedFlag = true;

        for (const vao of this.vaoCache.values()) {
            vao.dispose();
        }
        this.vaoCache.clear();
        this.bufferPool.dispose();
        this.program.dispose();
        this.cleanupExtras?.();
        this.clearCacheSlot();
    }
}
