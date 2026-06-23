// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptScaffold } from "../transform/ir.js";
import { BAR_INDEX_SENTINEL } from "./emitHelpers.js";

/**
 * Which chartlang surfaces a converted scaffold references, derived once by
 * {@link scanUsage}. Both the import-minimization pass ({@link
 * import("./emitImports.js").emitImports}) and the `compute` destructure
 * ({@link import("./emitCompute.js").emitCompute}) read this single flag set
 * so the emitted import list and the destructured parameter list never drift.
 *
 * @since 0.1
 * @stable
 * @example
 *     const flags: UsageFlags = {
 *         draw: true,
 *         state: false,
 *         ta: false,
 *         plot: false,
 *         hline: false,
 *         bgcolor: false,
 *         barcolor: false,
 *         alert: false,
 *         input: false,
 *         request: false,
 *         barstate: true,
 *         time: false,
 *         session: false,
 *         drawingHandle: true,
 *         barIndex: false,
 *     };
 *     void flags;
 */
export type UsageFlags = Readonly<{
    draw: boolean;
    state: boolean;
    ta: boolean;
    plot: boolean;
    hline: boolean;
    bgcolor: boolean;
    barcolor: boolean;
    alert: boolean;
    input: boolean;
    request: boolean;
    barstate: boolean;
    time: boolean;
    session: boolean;
    drawingHandle: boolean;
    barIndex: boolean;
}>;

// The full corpus of generated source the usage scan walks: every input
// descriptor, every state-slot initializer, and every compute statement.
function corpusOf(scaffold: ScriptScaffold): string {
    return [
        ...scaffold.inputs.map((entry) => entry.code),
        ...scaffold.stateSlots.map((slot) => slot.initExpr),
        ...scaffold.computeBody.statements,
    ].join("\n");
}

/**
 * Scan a populated {@link ScriptScaffold} once to decide which chartlang
 * surfaces it references. `draw`/`state` are forced on when the scaffold
 * carries handle/ring/state allocations (the codegen-owned preamble uses
 * them) even if no statement names them directly; `DrawingHandle` is needed
 * whenever any handle slot or ring is emitted (the helper signatures
 * reference it). Everything else is a substring scan over the generated
 * source corpus — every compute statement and input descriptor is already a
 * final chartlang source string, so a textual scan is exact.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { scanUsage } from "./usage.js";
 *     declare const scaffold: import("../transform/ir.js").ScriptScaffold;
 *     scanUsage(scaffold).draw; // boolean
 */
export function scanUsage(scaffold: ScriptScaffold): UsageFlags {
    const corpus = corpusOf(scaffold);
    const hasHandles = scaffold.handleSlots.length > 0;
    const hasRings = scaffold.handleRings.length > 0;
    const hasState = scaffold.stateSlots.length > 0;
    // The `DrawingHandle` type import is needed only by the helper signatures —
    // the non-compact slot helper and the ring helper. A compact handle slot
    // lowers to a bare `const <name> = draw.<kind>(…)` with no type annotation,
    // so a script whose every handle slot is compact never names `DrawingHandle`.
    const hasNonCompactHandle = scaffold.handleSlots.some((slot) => !slot.compact);
    return {
        draw: hasHandles || hasRings || corpus.includes("draw."),
        state: hasState || corpus.includes("state."),
        ta: corpus.includes("ta."),
        plot: /\bplot\b/.test(corpus),
        hline: /\bhline\b/.test(corpus),
        bgcolor: /\bbgcolor\b/.test(corpus),
        barcolor: /\bbarcolor\b/.test(corpus),
        alert: /\balert\b/.test(corpus),
        input: corpus.includes("input."),
        request: corpus.includes("request."),
        barstate: corpus.includes("barstate."),
        // `time.` / `session.` only match the calendar/session accessor
        // namespaces — `bar.time` is a trailing-dot-free scalar and a `{ time:
        // … }` object key reads `time:`, so neither false-positives here.
        time: corpus.includes("time."),
        session: corpus.includes("session."),
        drawingHandle: hasNonCompactHandle || hasRings,
        barIndex: corpus.includes(`${BAR_INDEX_SENTINEL}(`),
    };
}
