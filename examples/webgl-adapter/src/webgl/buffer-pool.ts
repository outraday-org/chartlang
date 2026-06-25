// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/buffer-pool.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Dropped from the pinned source (DEV-forensic / bus coupling): the `tcLog`
// observability hook and the `import.meta.env.DEV`-gated GPU-byte counter
// (`readAndResetUploadedBytes`) — `import.meta.env` is a Vite construct,
// undefined under the node vitest this adapter runs in, and the counter is
// bench-only. The module-scope frame counter is kept (it drives the
// same-frame upload-once gate, which is a correctness contract). See CLAUDE.md.

import type { VaoBuffer } from "./vao.js";

/**
 * A reusable `Float32Array` + GL buffer pair owned by a {@link BufferPool}
 * slot. Structurally satisfies Task-2's {@link VaoBuffer} (it exposes
 * `readonly glBuffer`), so a `PooledBuffer` feeds `new Vao(gl, layouts)`
 * directly.
 *
 * `cpu` / `capacity` / `length` / `uploadedLength` / `lastUploadedFrame` are
 * mutable: the pool mutates them in place so the `cpu` reference can be
 * cached across frames (identity is preserved while capacity suffices).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const b: PooledBuffer;
 *     b.cpu[0] = 1; // fill, then pool.upload(b)
 *     void b.glBuffer;
 */
export type PooledBuffer = VaoBuffer & {
    readonly id: string;
    /**
     * Float32Array-backed scratch slot. Grows on demand; existing array
     * identity is preserved when capacity is sufficient so callers can hold
     * the reference across frames without re-acquiring every tick.
     */
    cpu: Float32Array;
    /** Capacity in floats (`=== cpu.length`). */
    capacity: number;
    /** Length of the live data on this buffer (`≤ capacity`). */
    length: number;
    /**
     * Last `length` uploaded to the GPU. `0` on fresh acquire and reset to
     * `0` on capacity-grow (forces a fresh full upload because the GL buffer
     * shape changed). Read by {@link BufferPool.upload} to route between a
     * full `bufferData` (size changed / first upload / no hint) and a
     * partial `bufferSubData` (steady-state tail mutation).
     */
    uploadedLength: number;
    /**
     * Frame id of the most recent upload (`0` until the first frame). The
     * renderer bumps {@link beginRendererFrame} at the top of each draw;
     * shared-slot consumers read this to skip the redundant upload when a
     * sibling already uploaded the same content-keyed slot this frame.
     */
    lastUploadedFrame: number;
};

/**
 * Optional dirty-range hint for {@link BufferPool.upload}. When supplied,
 * the pool issues `gl.bufferSubData` over only the mutated floats.
 * `dirtyLength === 0` means "clean — skip the upload". Values are in floats
 * (not bytes); the pool converts the byte stride. The size-change predicate
 * (`uploadedLength !== length`) takes precedence: any logical-length change
 * falls through to a full `bufferData` regardless of the hint.
 *
 * @since 0.1
 * @stable
 * @example
 *     const hint: UploadHint = { dirtyOffset: 8, dirtyLength: 4 };
 *     void hint;
 */
export type UploadHint = { readonly dirtyOffset: number; readonly dirtyLength: number } | undefined;

/**
 * Optional flags for {@link BufferPool.acquire}. `scratch` flips the
 * same-frame upload-once short-circuit off for the slot, so a second
 * consumer writing legitimately divergent bytes still uploads.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: AcquireOptions = { scratch: true };
 *     void opts;
 */
export type AcquireOptions = { readonly scratch?: boolean };

/**
 * Per-slot ledger pairing a {@link PooledBuffer} with the set of consumer
 * keys currently holding it live. The GL buffer is freed only when the
 * consumer set drains, so a shared content-keyed slot survives one pane's
 * unmount as long as another pane still consumes it.
 *
 * `scratch` opts the slot out of the same-frame upload-once short-circuit:
 * content-keyed slots (whose `id` encodes their content) keep
 * `scratch === false` because every consumer writes byte-identical data;
 * heterogeneous shared slots set `scratch: true`.
 */
type SlotEntry = {
    readonly pooled: PooledBuffer;
    readonly consumers: Set<string>;
    readonly scratch: boolean;
};

/**
 * Module-scope frame counter shared by every {@link BufferPool} instance.
 * The renderer calls {@link beginRendererFrame} at the top of each draw to
 * bump it; every `upload(pooled)` within that frame compares
 * `pooled.lastUploadedFrame` against the counter and short-circuits when
 * they match. Module scope (not per-pool) saves the renderer from
 * discovering every program's pool to begin-frame on each.
 */
let CURRENT_FRAME = 0;

/**
 * Bump the shared frame counter. Called once at the top of each render
 * pass before any `upload(...)`, enabling the same-frame upload-once gate
 * for shared slots.
 *
 * @since 0.1
 * @stable
 * @example
 *     beginRendererFrame();
 *     // ...programs upload their pooled buffers...
 */
export function beginRendererFrame(): void {
    CURRENT_FRAME += 1;
}

/**
 * Read the current frame counter. Test-only seam for asserting the
 * same-frame upload-once gate without exposing module state.
 *
 * @since 0.1
 * @stable
 * @example
 *     const before = getCurrentRendererFrameForTests();
 *     beginRendererFrame();
 *     getCurrentRendererFrameForTests() === before + 1;
 */
export function getCurrentRendererFrameForTests(): number {
    return CURRENT_FRAME;
}

function nextPow2(n: number): number {
    if (n <= 1) return 1;

    let value = 1;

    while (value < n) {
        value *= 2;
    }

    return value;
}

/**
 * Pool of reusable `Float32Array` + GL buffer pairs keyed by string id.
 *
 * Grow strategy: when `requiredFloats` exceeds the current capacity the
 * backing `Float32Array` is reallocated to the next power of two and the
 * live prefix copied in. Identity is preserved when capacity already
 * suffices — callers may cache the `cpu` reference across frames as long as
 * they re-acquire each frame.
 *
 * Consumer registry: `acquire(id, floats, consumerKey)` records the consumer
 * in a per-slot set; `disposeByConsumer(consumerKey)` removes it from every
 * slot, freeing the GL buffer of any slot whose set drains. Sibling panes
 * mirroring the same content produce identical `id` strings, collapsing N
 * consumers' GL state to one buffer / one upload.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const pool = new BufferPool(gl);
 *     const slot = pool.acquire("series", 64, "pane-1");
 *     slot.cpu[0] = 1;
 *     pool.upload(slot);
 *     pool.dispose();
 */
export class BufferPool {
    readonly gl: WebGL2RenderingContext;

    private readonly slots: Map<string, SlotEntry>;
    private disposed = false;

    constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;

        this.slots = new Map();
    }

    /**
     * Acquire (or reuse) the slot for `id` on behalf of `consumerKey`. Grows
     * the backing array to the next power of two when `requiredFloats`
     * exceeds capacity (preserving the live prefix); otherwise reuses the
     * existing `cpu` identity. Resets `length` to `requiredFloats` so the
     * caller knows the live window to fill.
     */
    acquire(
        id: string,
        requiredFloats: number,
        consumerKey: string,
        options?: AcquireOptions,
    ): PooledBuffer {
        const existing = this.slots.get(id);

        if (existing !== undefined) {
            existing.consumers.add(consumerKey);

            const pooled = existing.pooled;

            if (requiredFloats <= pooled.capacity) {
                pooled.length = requiredFloats;

                return pooled;
            }

            const nextCapacity = nextPow2(requiredFloats);

            const grown = new Float32Array(nextCapacity);

            grown.set(pooled.cpu.subarray(0, pooled.length));

            pooled.cpu = grown;

            pooled.capacity = nextCapacity;

            pooled.length = requiredFloats;

            // Capacity grew → fresh GL buffer shape on next upload. Reset
            // `uploadedLength` so the size-change branch in `upload` routes
            // to a full `bufferData`.
            pooled.uploadedLength = 0;

            return pooled;
        }

        const initialCapacity = nextPow2(Math.max(1, requiredFloats));

        const glBuffer = this.gl.createBuffer();

        if (glBuffer === null) {
            throw new Error(`BufferPool: gl.createBuffer returned null for id "${id}"`);
        }

        const pooled: PooledBuffer = {
            capacity: initialCapacity,
            cpu: new Float32Array(initialCapacity),
            glBuffer,
            id,
            lastUploadedFrame: 0,
            length: requiredFloats,
            uploadedLength: 0,
        };

        const consumers = new Set<string>();

        consumers.add(consumerKey);

        const scratch = options?.scratch === true;

        this.slots.set(id, { consumers, pooled, scratch });

        return pooled;
    }

    /**
     * Upload `pooled.cpu` to the GPU. Defaults to `gl.ARRAY_BUFFER`; pass
     * `gl.ELEMENT_ARRAY_BUFFER` (or another target) for index buffers.
     *
     * Routing:
     *
     * 1. `hint === undefined` OR `uploadedLength === 0` OR
     *    `uploadedLength !== length` → full `gl.bufferData` over
     *    `[0, length)`. Sets `uploadedLength = length`.
     * 2. `hint.dirtyLength === 0` → no GL call (the buffer is clean).
     * 3. Otherwise → `gl.bufferSubData` over the dirty range;
     *    `uploadedLength` stays put.
     *
     * The size-change check is the safety net: any logical-length change
     * (slow-path rebuild, capacity grow, fresh acquire) falls back to a full
     * upload, because the GL buffer's allocated size must match `length`
     * before a partial upload can target it. Shared non-scratch slots
     * short-circuit when already uploaded this frame (the content-key
     * contract guarantees identical bytes).
     */
    upload(pooled: PooledBuffer, target?: number, hint?: UploadHint): void {
        const gl = this.gl;

        const usedTarget = target ?? gl.ARRAY_BUFFER;

        // Same-frame short-circuit for SHARED slots: a prior consumer of this
        // shared slot already pushed bytes to the GPU this frame, and the
        // content-key contract guarantees subsequent consumers' bytes are
        // byte-identical. Single-consumer slots always upload (no sharing to
        // coalesce). `scratch: true` slots opt OUT (divergent bytes per
        // consumer must each upload).
        const entry = this.slots.get(pooled.id);

        const isShared = entry !== undefined && entry.consumers.size > 1;

        const isScratch = entry?.scratch === true;

        if (
            isShared &&
            !isScratch &&
            CURRENT_FRAME > 0 &&
            pooled.lastUploadedFrame === CURRENT_FRAME
        ) {
            return;
        }

        gl.bindBuffer(usedTarget, pooled.glBuffer);

        const sizeChanged = pooled.uploadedLength !== pooled.length;

        if (hint === undefined || sizeChanged || pooled.uploadedLength === 0) {
            gl.bufferData(usedTarget, pooled.cpu, gl.DYNAMIC_DRAW, 0, pooled.length);

            pooled.uploadedLength = pooled.length;

            pooled.lastUploadedFrame = CURRENT_FRAME;

            return;
        }

        if (hint.dirtyLength === 0) return;

        gl.bufferSubData(
            usedTarget,
            hint.dirtyOffset * Float32Array.BYTES_PER_ELEMENT,
            pooled.cpu,
            hint.dirtyOffset,
            hint.dirtyLength,
        );

        pooled.lastUploadedFrame = CURRENT_FRAME;
    }

    /**
     * Release `consumerKey`'s claim on slot `id`. When the slot's consumer
     * set drains, the GL buffer is deleted and the slot removed. Returns
     * `true` iff the slot was freed. The per-id form is the surgical release;
     * {@link BufferPool.disposeByConsumer} releases every slot a consumer
     * holds.
     */
    release(id: string, consumerKey: string): boolean {
        if (this.disposed) return false;

        const entry = this.slots.get(id);

        if (entry === undefined) return false;

        entry.consumers.delete(consumerKey);

        if (entry.consumers.size === 0) {
            this.gl.deleteBuffer(entry.pooled.glBuffer);

            this.slots.delete(id);

            return true;
        }

        return false;
    }

    /**
     * Drop `consumerKey` from every slot that holds it. Slots whose consumer
     * set becomes empty are freed (GL buffer deleted, slot removed). Returns
     * the freed slot ids so the caller (a program's per-pane cleanup) can
     * dispose matching VAOs / per-pane state that referenced the GL buffer.
     */
    disposeByConsumer(consumerKey: string): Array<string> {
        const freed: Array<string> = [];

        if (this.disposed) return freed;

        for (const [slotId, entry] of this.slots) {
            if (!entry.consumers.has(consumerKey)) continue;

            entry.consumers.delete(consumerKey);

            if (entry.consumers.size === 0) {
                this.gl.deleteBuffer(entry.pooled.glBuffer);

                freed.push(slotId);
            }
        }

        for (const slotId of freed) {
            this.slots.delete(slotId);
        }

        return freed;
    }

    /**
     * Bulk-prune (no args) flips the `disposed` flag and deletes every pooled
     * buffer. The per-id form is an incremental release — it deletes the
     * matching slot but does NOT flip `disposed`, so the pool stays usable.
     */
    dispose(): void;
    dispose(id: string): void;
    dispose(id?: string): void {
        if (id === undefined) {
            if (this.disposed) return;

            this.disposed = true;

            for (const entry of this.slots.values()) {
                this.gl.deleteBuffer(entry.pooled.glBuffer);
            }

            this.slots.clear();

            return;
        }

        if (this.disposed) return;

        const entry = this.slots.get(id);

        if (entry === undefined) return;

        this.gl.deleteBuffer(entry.pooled.glBuffer);

        this.slots.delete(id);
    }

    /**
     * Drop every pooled buffer whose id starts with `prefix`. Preserved for
     * full-symbol cleanup (`disposeByPrefix("AAPL:1d:")`) alongside the
     * per-consumer path. Returns the freed slot ids.
     */
    disposeByPrefix(prefix: string): Array<string> {
        const freed: Array<string> = [];

        if (this.disposed) return freed;

        for (const slotId of this.slots.keys()) {
            if (slotId.startsWith(prefix)) freed.push(slotId);
        }

        for (const slotId of freed) {
            const entry = this.slots.get(slotId);

            if (entry === undefined) continue;

            this.gl.deleteBuffer(entry.pooled.glBuffer);

            this.slots.delete(slotId);
        }

        return freed;
    }

    /**
     * Peek into the consumer set for a slot id. Test-only seam for verifying
     * the consumer-registry contract without exposing the internal map.
     */
    getConsumersForTests(id: string): null | ReadonlySet<string> {
        const entry = this.slots.get(id);

        return entry === undefined ? null : entry.consumers;
    }

    /**
     * Slot-count peek for tests / instrumentation.
     */
    getSlotCountForTests(): number {
        return this.slots.size;
    }
}
