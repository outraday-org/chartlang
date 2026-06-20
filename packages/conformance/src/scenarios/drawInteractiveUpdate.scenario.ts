// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// `defineDrawing` + cross-bar handle update scenario for Task 20.
// Captures the handle returned by `draw.horizontalLine(...)` at
// module scope on bar 0 and calls `handle.update({ price: bar.close })`
// on every subsequent bar — the bundled goldenBars stream contains
// 10 000 bars, so the runtime should buffer 1 `op: "create"` followed
// by 9 999 `op: "update"` emissions. The pinned `drawing-hash`
// captures the full sequence; handle-id stability is implicit in the
// hash (every emission carries the same `handleId`).
//
// Module-level `let` is preserved across bars because the compiled
// script is imported once and its `compute(ctx)` is invoked per bar.
// Matches the chartlang cross-bar handle idiom pinned in
// `packages/runtime/src/emit/draw/handle.ts:78-104`.
const INLINE_SOURCE = `import { defineDrawing } from "@invinite-org/chartlang-core";
import type { DrawingHandle } from "@invinite-org/chartlang-core";

let handle: DrawingHandle | null = null;

export default defineDrawing({
    name: "draw interactive horizontalLine update",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (handle === null) {
            handle = draw.horizontalLine(bar.close.current);
            return;
        }
        handle.update({ price: bar.close.current });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "797d159809da91f43fc32149998da9e5d71b011134564d42c3e5da2027c22e6f",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Interactive `DrawingHandle.update` conformance scenario. Bar 0
 * creates a `draw.horizontalLine(bar.close)` and captures the handle
 * in module-level state; bars 1+ call `handle.update({ price:
 * bar.close })`. Pinned `drawing-hash` covers the full ~10 000
 * emission stream (1 `create` + ~9 999 `update`s) and pins the
 * handle-id stability across bars.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_INTERACTIVE_UPDATE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_INTERACTIVE_UPDATE_SCENARIO;
 */
export const DRAW_INTERACTIVE_UPDATE_SCENARIO: Scenario = Object.freeze({
    id: "draw-interactive-update",
    title: "defineDrawing — handle.update({ price }) across bars",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
