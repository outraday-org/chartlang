// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Diagnostic } from "../index.js";
import type { NameAllocator } from "./nameAllocator.js";

/**
 * The value-format hint a converted script binds to, narrowed to the subset
 * Pine's `format.*` enum maps onto. `format.inherit` resolves to `null`
 * (chartlang default) with a warning. The wider chartlang `ValueFormat`
 * (`"compact"`) has no Pine source.
 *
 * @since 0.1
 * @stable
 * @example
 *     const f: ScaffoldFormat = "percent";
 *     void f;
 */
export type ScaffoldFormat = "price" | "percent" | "volume";

/**
 * The scale-axis side a converted script binds to, narrowed to the subset
 * Pine's `scale.*` enum maps onto. `scale.none` resolves to `null` with a
 * warning. The wider chartlang `ScaleAxis` (`"price"`/`"new"`) has no Pine
 * source.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: ScaffoldScale = "right";
 *     void s;
 */
export type ScaffoldScale = "left" | "right";

/**
 * The chartlang `draw.*` per-bucket budget carried from Pine's
 * `max_*_count` indicator args. Mirrors core's `DrawingCounts` buckets but
 * every field is optional — only the buckets the converter populated appear,
 * and Task 16 codegen emits the partial object verbatim.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m: MaxDrawingsIR = { lines: 20, labels: 50 };
 *     void m;
 */
export type MaxDrawingsIR = {
    lines?: number;
    labels?: number;
    boxes?: number;
    polylines?: number;
    other?: number;
};

/**
 * One `inputs` schema entry the converted script declares. `code` is the
 * chartlang TypeScript source string for the input descriptor (emitted
 * verbatim by Task 16 codegen), keyed by the Pine `input.*` call's bound
 * variable `name`. Populated by Task 9.
 *
 * @since 0.1
 * @stable
 * @example
 *     const i: InputDeclarationIR = { name: "length", code: 'input.int(14, { title: "Length" })' };
 *     void i;
 */
export type InputDeclarationIR = Readonly<{
    name: string;
    code: string;
}>;

/**
 * One scalar `state.*` slot the converted compute body persists across bars.
 * `name` is the chartlang local the slot binds to; `initExpr` is the
 * chartlang source for the initial value. Populated by Tasks 10/15 for
 * `var`/`varip` scalars folded out of the Pine body.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: StateSlotIR = { name: "count", initExpr: "0" };
 *     void s;
 */
export type StateSlotIR = Readonly<{
    name: string;
    initExpr: string;
}>;

/**
 * One module-level single drawing-handle slot (Camp A): a persistent handle
 * the compute body mutates each bar. `name` is the chartlang local; `kind`
 * is the chartlang `draw.*` family. Populated by Task 10.
 *
 * `compact` marks a slot the Camp A lowerer reduced to the bare
 * persistent-handle form — `const <name> = draw.<kind>(…); <name>.update(…)` —
 * exploiting the runtime's callsite-persistence (each `draw.*` callsite keys
 * its drawing state by slot id and re-emits `update` on cross-bar re-entry).
 * A compact slot needs NO `useDrawingHandleSlot` helper and NO module-level
 * allocation: codegen omits the helper iff EVERY handle slot is compact.
 * Slots that do not cleanly match the single-create idiom (a `*.delete`, a
 * `varip` handle, or a `null` draw kind such as `table`) stay non-compact and
 * keep the general `current()`/`set()` slot machinery.
 *
 * @since 0.1
 * @stable
 * @example
 *     const h: HandleSlotIR = { name: "lvlLine", kind: "line", compact: true };
 *     void h;
 */
export type HandleSlotIR = Readonly<{
    name: string;
    kind: string;
    compact: boolean;
}>;

/**
 * One module-level bounded drawing-handle ring buffer (Camp B): a fixed-cap
 * collection the compute body pushes into with FIFO eviction. `name` is the
 * chartlang local; `kind` is the chartlang `draw.*` family; `cap` is the
 * extracted ring capacity. Populated by Task 11.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: HandleRingIR = { name: "pivots", kind: "label", cap: 20 };
 *     void r;
 */
export type HandleRingIR = Readonly<{
    name: string;
    kind: string;
    cap: number;
}>;

/**
 * The converted `compute({...}) { ... }` body as an ordered list of
 * chartlang TypeScript source statements. Tasks 10–15 append `string`
 * statements (each one source line / block) via
 * {@link appendComputeStatement}; Task 16 codegen joins and indents them.
 * The array is mutable so the transform pipeline can accumulate.
 *
 * @since 0.1
 * @stable
 * @example
 *     const body: ComputeBodyIR = { statements: ["draw.line(a, b);"] };
 *     void body;
 */
export type ComputeBodyIR = {
    statements: string[];
};

/**
 * The whole converted script as a mutable IR: the chosen chartlang
 * constructor, the resolved `defineIndicator`/`defineDrawing` options, and
 * the (initially empty) collections Tasks 9–15 append to via the scaffold
 * mutators. The top-level record is `Readonly` (fields are not reassigned),
 * but each collection is a mutable array the mutators push into. Task 16
 * codegen reads this and emits the final `.chart.ts` source string.
 *
 * @since 0.1
 * @stable
 * @example
 *     const s: ScriptScaffold = {
 *         constructor: "defineIndicator",
 *         apiVersion: 1,
 *         name: "Hello",
 *         shortName: null,
 *         overlay: true,
 *         format: null,
 *         precision: null,
 *         scale: null,
 *         maxDrawings: { lines: 50 },
 *         maxBarsBack: null,
 *         inputs: [],
 *         stateSlots: [],
 *         handleSlots: [],
 *         handleRings: [],
 *         computeBody: { statements: [] },
 *         diagnostics: [],
 *     };
 *     void s;
 */
export type ScriptScaffold = Readonly<{
    constructor: "defineIndicator" | "defineDrawing";
    apiVersion: 1;
    name: string;
    shortName: string | null;
    overlay: boolean | null;
    format: ScaffoldFormat | null;
    precision: number | null;
    scale: ScaffoldScale | null;
    maxDrawings: MaxDrawingsIR;
    maxBarsBack: number | null;
    inputs: InputDeclarationIR[];
    stateSlots: StateSlotIR[];
    handleSlots: HandleSlotIR[];
    handleRings: HandleRingIR[];
    computeBody: ComputeBodyIR;
    diagnostics: readonly Diagnostic[];
    /**
     * Scope-aware identifier allocator for every SYNTHESIZED name in the
     * generated output (drawing handles, state/ring locals, the bar-index
     * bridge, the drawing-handle helper). Seeded in `transformDeclaration` with
     * the source's reserved identifiers; every name-generation site routes
     * through it so synthesized names are readable and never collide. The
     * reference is `readonly`; the allocator's internal sets mutate as the
     * transforms claim names.
     */
    names: NameAllocator;
}>;
