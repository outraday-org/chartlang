// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";

/**
 * The `bar_index` bridge lines emitted at the top of `compute` when the body
 * references `__bar_index()`. Pine's `bar_index` is the running bar count;
 * chartlang has no equivalent, so the converter maintains a `__barCount`
 * incremented once per new bar and exposes it through a `__bar_index()`
 * accessor (the shape the coordinate resolver lowers `bar_index` reads onto).
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitBarIndexPreamble } from "./emitHelpers.js";
 *     emitBarIndexPreamble()[0]; // "let __barCount = 0;"
 */
export function emitBarIndexPreamble(): string[] {
    return [
        "let __barCount = 0;",
        "const __bar_index = (): number => __barCount;",
        "if (barstate.isnew) __barCount += 1;",
    ];
}

/**
 * The `__BAR_INTERVAL_MS` const, emitted only when a future `bar_index + N`
 * anchor lowered to `bar.time + N * __BAR_INTERVAL_MS`. The interval is left
 * at `0` as a sentinel the caller overrides; the converter cannot infer the
 * chart's bar spacing, so a future anchor needs the host to supply it.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitBarIntervalConst } from "./emitHelpers.js";
 *     emitBarIntervalConst(); // "const __BAR_INTERVAL_MS = 0;"
 */
export function emitBarIntervalConst(): string {
    return "const __BAR_INTERVAL_MS = 0;";
}

/**
 * The Camp A single drawing-handle slot helper: a `current()`/`set()` cell
 * holding one persistent {@link import("@invinite-org/chartlang-core").DrawingHandle}.
 * Emitted inside `compute` (where `draw` is in scope) only when the scaffold
 * carries at least one handle slot. The `K` type parameter mirrors the
 * `useDrawingHandleSlot<"line">()` call site so the allocation reads as the
 * drawing kind it tracks.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitHandleSlotHelper } from "./emitHelpers.js";
 *     emitHandleSlotHelper()[0]; // "type __HandleSlot<K extends string> = {"
 */
export function emitHandleSlotHelper(): string[] {
    return [
        "type __HandleSlot<K extends string> = {",
        "kind?: K;",
        "current(): DrawingHandle | null;",
        "set(h: DrawingHandle | null): void;",
        "};",
        "function useDrawingHandleSlot<K extends string>(): __HandleSlot<K> {",
        "let __h: DrawingHandle | null = null;",
        "return { current: () => __h, set: (next) => { __h = next; } };",
        "}",
    ];
}

/**
 * The Camp B bounded drawing-handle ring helper: a fixed-cap FIFO of handles
 * with `push`/`at`/`size`. `push` removes the evicted handle when the ring is
 * full (mirroring Pine's `array.shift` + `*.delete` eviction the transform
 * elides). Emitted inside `compute` only when the scaffold carries at least
 * one ring.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitHandleRingHelper } from "./emitHelpers.js";
 *     emitHandleRingHelper()[0]; // "type __HandleRing<K extends string> = {"
 */
export function emitHandleRingHelper(): string[] {
    return [
        "type __HandleRing<K extends string> = {",
        "kind?: K;",
        "push(h: DrawingHandle | null): void;",
        "at(i: number): DrawingHandle | null;",
        "size(): number;",
        "};",
        "function useDrawingHandleRing<K extends string>(cap: number): __HandleRing<K> {",
        "const __buf: (DrawingHandle | null)[] = [];",
        "let __head = 0;",
        "return {",
        "push: (h) => {",
        "if (__buf.length < cap) {",
        "__buf.push(h);",
        "} else {",
        "const __evicted = __buf[__head];",
        "if (__evicted !== null && __evicted !== undefined) __evicted.remove();",
        "__buf[__head] = h;",
        "__head = (__head + 1) % cap;",
        "}",
        "},",
        "at: (i) => (__buf.length < cap ? __buf[i] : __buf[(__head + i) % cap]) ?? null,",
        "size: () => __buf.length,",
        "};",
        "}",
    ];
}

/**
 * The module-state / handle / ring allocation lines, emitted after the helper
 * definitions at the top of `compute`. Each scalar `state.*` slot becomes
 * `const <name> = <initExpr>;` (the initializer is the full factory source the
 * transform produced); each handle slot becomes
 * `const <name> = useDrawingHandleSlot<"<kind>">();`; each ring becomes
 * `const <name> = useDrawingHandleRing<"<kind>">(<cap>);`. Iteration follows
 * scaffold insertion order so the output is deterministic.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { emitSlotAllocations } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitSlotAllocations(scaffold); // ["const __count_state = state.int(0);", …]
 */
export function emitSlotAllocations(scaffold: ScriptScaffold): string[] {
    const lines: string[] = [];
    for (const slot of scaffold.stateSlots) {
        lines.push(`const ${slot.name} = ${slot.initExpr};`);
    }
    for (const slot of scaffold.handleSlots) {
        lines.push(`const ${slot.name} = useDrawingHandleSlot<${JSON.stringify(slot.kind)}>();`);
    }
    for (const ring of scaffold.handleRings) {
        lines.push(
            `const ${ring.name} = useDrawingHandleRing<${JSON.stringify(ring.kind)}>(${ring.cap});`,
        );
    }
    return lines;
}
