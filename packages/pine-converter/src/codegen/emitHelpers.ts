// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";

/**
 * The readable, collision-safe identifiers for the codegen-synthesized
 * helpers. Allocated ONCE per scaffold ({@link allocateHelperNames}) from the
 * scaffold's {@link import("../transform/nameAllocator.js").NameAllocator} so
 * the bar-index bridge, the drawing-handle slot helper, and the ring helper
 * never collide with a translated Pine identifier. The closure-internal locals
 * (`handle`/`buffer`/…) are fixed readable names — they live inside the helper
 * function bodies, not the user-visible `compute` scope, so they cannot clash.
 *
 * @since 0.1
 * @stable
 * @example
 *     const names: HelperNames = {
 *         barCount: "barCount",
 *         barIndex: "barIndex",
 *         handleSlotType: "HandleSlot",
 *         useHandleSlot: "useDrawingHandleSlot",
 *         handleRingType: "HandleRing",
 *         useHandleRing: "useDrawingHandleRing",
 *     };
 *     void names;
 */
export type HelperNames = Readonly<{
    barCount: string;
    barIndex: string;
    handleSlotType: string;
    useHandleSlot: string;
    handleRingType: string;
    useHandleRing: string;
}>;

/**
 * The internal sentinel the static identifier map lowers `bar_index` reads
 * onto (`mapping/builtinIdentifiers.ts`). It is RENAMED to the allocated
 * readable `HelperNames.barIndex` before output ({@link renameBarIndexSentinel}),
 * so it never reaches the generated `.chart.ts`. `usage.ts` keys its
 * bridge-needed flag on this constant. The matching counter sentinel is
 * `<sentinel>Count`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { BAR_INDEX_SENTINEL } from "./emitHelpers.js";
 *     BAR_INDEX_SENTINEL; // "__barIndexBridge"
 */
export const BAR_INDEX_SENTINEL = "__barIndexBridge";
const BAR_COUNT_SENTINEL = `${BAR_INDEX_SENTINEL}Count`;

/**
 * Allocate the readable helper identifiers for a scaffold from its shared name
 * allocator, in a FIXED order so the output is deterministic. Allocated last
 * (after every per-Pine-symbol handle/state/ring name) so the generic helper
 * names yield to user identifiers — a Pine `var barIndex` forces the bridge to
 * `barIndex2`, never a `__`-prefixed fallback.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { allocateHelperNames } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     allocateHelperNames(scaffold).barIndex; // "barIndex" (or "barIndex2" on a clash)
 */
export function allocateHelperNames(scaffold: ScriptScaffold): HelperNames {
    // Memoized so `emit(scaffold)` is deterministic across repeated calls — a
    // second invocation replays the first allocation instead of suffixing.
    return {
        barCount: scaffold.names.allocateMemoized("barCount", "barCount"),
        barIndex: scaffold.names.allocateMemoized("barIndex", "barIndex"),
        handleSlotType: scaffold.names.allocateMemoized("handleSlotType", "HandleSlot"),
        useHandleSlot: scaffold.names.allocateMemoized("useHandleSlot", "useDrawingHandleSlot"),
        handleRingType: scaffold.names.allocateMemoized("handleRingType", "HandleRing"),
        useHandleRing: scaffold.names.allocateMemoized("useHandleRing", "useDrawingHandleRing"),
    };
}

/**
 * Rewrite the internal `bar_index` bridge sentinels ({@link BAR_INDEX_SENTINEL}
 * + its counter) in a generated line to the allocated readable names. The
 * static identifier map emits the sentinel at transform time (before the name
 * is allocated); this single string pass — applied to every emitted line —
 * substitutes the real `HelperNames.barIndex` / `.barCount`, so the sentinels
 * never reach output. Word-boundary anchored so it never touches a substring.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { renameBarIndexSentinel } from "./emitHelpers.js";
 *     declare const names: import("./emitHelpers.js").HelperNames;
 *     renameBarIndexSentinel("draw.line(__barIndexBridge())", names);
 */
export function renameBarIndexSentinel(line: string, names: HelperNames): string {
    return line
        .replace(new RegExp(`\\b${BAR_COUNT_SENTINEL}\\b`, "g"), names.barCount)
        .replace(new RegExp(`\\b${BAR_INDEX_SENTINEL}\\b`, "g"), names.barIndex);
}

/**
 * The `bar_index` bridge lines emitted at the top of `compute` when the body
 * references the bar-index sentinel. Pine's `bar_index` is the running bar
 * count; chartlang has no equivalent, so the converter maintains a `barCount`
 * incremented once per new bar and exposes it through a `barIndex()` accessor
 * (the shape the coordinate resolver lowers `bar_index` reads onto). Names come
 * from {@link allocateHelperNames} so they never collide with a Pine variable.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitBarIndexPreamble, allocateHelperNames } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitBarIndexPreamble(allocateHelperNames(scaffold))[0]; // "let barCount = 0;"
 */
export function emitBarIndexPreamble(names: HelperNames): string[] {
    return [
        `let ${names.barCount} = 0;`,
        `const ${names.barIndex} = (): number => ${names.barCount};`,
        `if (barstate.isnew) ${names.barCount} += 1;`,
    ];
}

/**
 * The Camp A single drawing-handle slot helper: a `current()`/`set()` cell
 * holding one persistent {@link import("@invinite-org/chartlang-core").DrawingHandle}.
 * Emitted inside `compute` (where `draw` is in scope) only when the scaffold
 * carries a non-compact handle slot. The `K` type parameter mirrors the
 * `useDrawingHandleSlot<"line">()` call site so the allocation reads as the
 * drawing kind it tracks. The type/function names come from
 * {@link allocateHelperNames}; the closure cell `handle` is a fixed readable
 * body-local.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitHandleSlotHelper, allocateHelperNames } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitHandleSlotHelper(allocateHelperNames(scaffold))[0]; // "type HandleSlot<K extends string> = {"
 */
export function emitHandleSlotHelper(names: HelperNames): string[] {
    return [
        `type ${names.handleSlotType}<K extends string> = {`,
        "kind?: K;",
        "current(): DrawingHandle | null;",
        "set(h: DrawingHandle | null): void;",
        "};",
        `function ${names.useHandleSlot}<K extends string>(): ${names.handleSlotType}<K> {`,
        "let handle: DrawingHandle | null = null;",
        "return { current: () => handle, set: (next) => { handle = next; } };",
        "}",
    ];
}

/**
 * The Camp B bounded drawing-handle ring helper: a fixed-cap FIFO of handles
 * with `push`/`at`/`size`. `push` removes the evicted handle when the ring is
 * full (mirroring Pine's `array.shift` + `*.delete` eviction the transform
 * elides). Emitted inside `compute` only when the scaffold carries at least
 * one ring. The type/function names come from {@link allocateHelperNames}; the
 * closure locals (`buffer`/`head`/`evicted`) are fixed readable body-locals.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitHandleRingHelper, allocateHelperNames } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitHandleRingHelper(allocateHelperNames(scaffold))[0]; // "type HandleRing<K extends string> = {"
 */
export function emitHandleRingHelper(names: HelperNames): string[] {
    return [
        `type ${names.handleRingType}<K extends string> = {`,
        "kind?: K;",
        "push(h: DrawingHandle | null): void;",
        "at(i: number): DrawingHandle | null;",
        "size(): number;",
        "};",
        `function ${names.useHandleRing}<K extends string>(cap: number): ${names.handleRingType}<K> {`,
        "const buffer: (DrawingHandle | null)[] = [];",
        "let head = 0;",
        "return {",
        "push: (h) => {",
        "if (buffer.length < cap) {",
        "buffer.push(h);",
        "} else {",
        "const evicted = buffer[head];",
        "if (evicted !== null && evicted !== undefined) evicted.remove();",
        "buffer[head] = h;",
        "head = (head + 1) % cap;",
        "}",
        "},",
        "at: (i) => (buffer.length < cap ? buffer[i] : buffer[(head + i) % cap]) ?? null,",
        "size: () => buffer.length,",
        "};",
        "}",
    ];
}

/**
 * The module-state / handle / ring allocation lines, emitted after the helper
 * definitions at the top of `compute`. Each scalar `state.*` slot becomes
 * `const <name> = <initExpr>;` (the initializer is the full factory source the
 * transform produced); each NON-compact handle slot becomes
 * `const <name> = useDrawingHandleSlot<"<kind>">();` (the helper name from
 * `names.useHandleSlot`); each ring becomes
 * `const <name> = useDrawingHandleRing<"<kind>">(<cap>);` (`names.useHandleRing`).
 * Iteration follows scaffold insertion order so the output is deterministic. A
 * COMPACT handle slot allocates nothing here — its `const <name> =
 * draw.<kind>(…)` create call (emitted by Camp A) IS the allocation.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { emitSlotAllocations, allocateHelperNames } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     emitSlotAllocations(scaffold, allocateHelperNames(scaffold)); // ["const count = state.int(0);", …]
 */
export function emitSlotAllocations(scaffold: ScriptScaffold, names: HelperNames): string[] {
    const lines: string[] = [];
    for (const slot of scaffold.stateSlots) {
        lines.push(`const ${slot.name} = ${slot.initExpr};`);
    }
    for (const slot of scaffold.handleSlots) {
        if (slot.compact) {
            continue;
        }
        lines.push(`const ${slot.name} = ${names.useHandleSlot}<${JSON.stringify(slot.kind)}>();`);
    }
    for (const ring of scaffold.handleRings) {
        lines.push(
            `const ${ring.name} = ${names.useHandleRing}<${JSON.stringify(ring.kind)}>(${ring.cap});`,
        );
    }
    return lines;
}

/**
 * Whether the scaffold carries any NON-compact handle slot — the only case
 * that needs the `useDrawingHandleSlot` helper definition + the `DrawingHandle`
 * type import. A compact handle slot lowers to a bare `const <name> =
 * draw.<kind>(…)` (no helper, no type annotation), so a script whose every
 * handle slot is compact omits the helper entirely.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { hasNonCompactHandleSlot } from "./emitHelpers.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     hasNonCompactHandleSlot(scaffold); // boolean
 */
export function hasNonCompactHandleSlot(scaffold: ScriptScaffold): boolean {
    return scaffold.handleSlots.some((slot) => !slot.compact);
}
