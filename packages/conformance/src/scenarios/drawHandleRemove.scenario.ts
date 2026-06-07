// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// `defineDrawing` + `DrawingHandle.remove` scenario for Task 20.
// Bar 0: emits `draw.text(...)` and captures the handle. Bar 100
// (= bar-0 time + 100 × 86_400_000 ms = 1_708_640_000_000 — the
// goldenBars fixture uses 1-day intervals): calls `handle.remove()`
// and gates further work behind a `removed` flag. The runtime emits
// `op: "create"` on bar 0 then `op: "remove"` on bar 100 with the
// last-known state (per
// `packages/runtime/src/emit/draw/handle.ts:123-130`). The pinned
// `drawing-hash` covers exactly two emissions: the create and the
// remove. No `drawing-budget-exceeded` — 2 ≪ any bucket cap.
const INLINE_SOURCE = `import { defineDrawing } from "@invinite-org/chartlang-core";
import type { DrawingHandle } from "@invinite-org/chartlang-core";

let handle: DrawingHandle | null = null;
let removed = false;

export default defineDrawing({
    name: "draw handle.remove",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (removed) return;
        if (handle === null) {
            handle = draw.text(
                { time: bar.time, price: bar.close },
                "interactive label",
            );
            return;
        }
        if (bar.time === 1_708_640_000_000) {
            handle.remove();
            removed = true;
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "b742d39fe5d03cb211b57bc26f0d24a89f9db966c481279368cc083932394a09",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `DrawingHandle.remove()` conformance scenario. Creates a
 * `draw.text(...)` on bar 0, removes it on bar 100 (= time
 * `1_700_006_000_000` from the goldenBars fixture). Pinned
 * `drawing-hash` captures both the `op: "create"` and `op: "remove"`
 * emissions; `drawing-budget-exceeded` is absent.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_HANDLE_REMOVE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_HANDLE_REMOVE_SCENARIO;
 */
export const DRAW_HANDLE_REMOVE_SCENARIO: Scenario = Object.freeze({
    id: "draw-handle-remove",
    title: "defineDrawing — handle.remove() on bar 100",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
