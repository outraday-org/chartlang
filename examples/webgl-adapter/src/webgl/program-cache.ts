// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/program-cache.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

/**
 * Disposable shape every GL program in this adapter implements — the
 * registry only needs `dispose()` to release a cached instance.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: DisposableProgram = { dispose: () => {} };
 *     void p;
 */
export type DisposableProgram = { dispose: () => void };

// One lazy program registry per WebGL2 context. The cache key is the gl
// context itself, so program lifetime is tied to the canvas: once the
// canvas is GC'd the WeakMap entry (and every program in it) is
// unreachable.
//
// "Translate, not transcribe": invinite's `program-cache.ts` is a typed
// record naming ten concrete program classes (CandleBodiesProgram, …)
// that land in later tasks. Here it is the GENERIC `getProgram(gl, key,
// factory)` form — the per-`gl` lifetime + same-canvas-remount contract
// is the port; the program-set coupling is dropped. Each later task
// registers its program under a string key.
const cacheByGl: WeakMap<WebGL2RenderingContext, Map<string, DisposableProgram>> = new WeakMap();

/**
 * Lazily instantiate (and cache) a program under `key` for the given gl
 * context. The first call for a `(gl, key)` pair runs `factory()` and
 * stores the result; subsequent calls with the same `(gl, key)` return
 * the SAME instance, so a program is compiled once per context and reused
 * across panes. A different gl context gets its own fresh instance (the
 * same-canvas StrictMode remount path).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     declare function makeLineProgram(): { dispose: () => void };
 *     const a = getProgram(gl, "line-strip", makeLineProgram);
 *     const b = getProgram(gl, "line-strip", makeLineProgram);
 *     a === b; // true — same instance per (gl, key)
 *     void [a, b];
 */
export function getProgram<T extends DisposableProgram>(
    gl: WebGL2RenderingContext,
    key: string,
    factory: () => T,
): T {
    let byKey = cacheByGl.get(gl);

    if (byKey === undefined) {
        byKey = new Map();

        cacheByGl.set(gl, byKey);
    }

    const existing = byKey.get(key);

    if (existing !== undefined) {
        // Stored as the base `DisposableProgram`; the caller's `key`
        // identifies the concrete type, so the narrowing is theirs to own.
        return existing as T;
    }

    const fresh = factory();

    byKey.set(key, fresh);

    return fresh;
}

/**
 * Evict the cached program under `(gl, key)` WITHOUT disposing it — the
 * caller (a program's own `dispose()`, via its `clearCacheSlot` hook) has
 * already released the GL resources and only needs the stale instance
 * removed so the next `getProgram(gl, key, …)` recompiles a fresh one.
 * Idempotent; a miss is a no-op. (`clearProgramCache` is the bulk
 * dispose-and-drop; this is the surgical single-key evict.)
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     evictProgram(gl, "candle-bodies");
 */
export function evictProgram(gl: WebGL2RenderingContext, key: string): void {
    const byKey = cacheByGl.get(gl);

    if (byKey === undefined) return;

    byKey.delete(key);

    if (byKey.size === 0) {
        cacheByGl.delete(gl);
    }
}

/**
 * Dispose every program cached for `gl` and drop the context's registry
 * entry, so a same-canvas remount recompiles cleanly. Called from the
 * renderer's `dispose()` (later tasks). A gl with no cached programs is a
 * no-op.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     clearProgramCache(gl);
 */
export function clearProgramCache(gl: WebGL2RenderingContext): void {
    const byKey = cacheByGl.get(gl);

    if (byKey === undefined) return;

    for (const program of byKey.values()) {
        program.dispose();
    }

    cacheByGl.delete(gl);
}
