// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// `bar.point` conformance scenario — exercises the offset-anchored
// drawing idiom end-to-end (compiler max-lookback sizing + runtime
// offset → WorldPoint resolution + draw emit). The tracking line spans
// from three bars back (`bar.point(-3, …)`, a real historical timestamp)
// to the current bar (`bar.point(0, …)`); it draws once the buffer is
// warm so the historical anchor resolves to a finite time. The pinned
// `drawing-hash` covers the resolved `{ time, price }` anchors, proving
// `bar.point` lowers to the same persisted WorldPoint frame every run.
const INLINE_SOURCE = `import { defineDrawing } from "@invinite-org/chartlang-core";
export default defineDrawing({
    name: "bar.point tracking line",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000 + 4 * 86_400_000) {
            draw.line(bar.point(-3, bar.close), bar.point(0, bar.close));
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "f53acd1b4193f6ced33ed33ef08186bf293de1292b2e9bdc54469eb291f8a75a",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `bar.point` offset-anchored drawing conformance scenario. Emits one
 * `draw.line` spanning `bar.point(-3, close)` → `bar.point(0, close)` on
 * the fifth bar, so the historical offset resolves to a real retained
 * timestamp. The pinned `drawing-hash` guards the offset → WorldPoint
 * resolution path.
 *
 * @since 0.9
 * @stable
 * @example
 *     import { BAR_POINT_TRACKING_LINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void BAR_POINT_TRACKING_LINE_SCENARIO;
 */
export const BAR_POINT_TRACKING_LINE_SCENARIO: Scenario = Object.freeze({
    id: "bar-point-tracking-line",
    title: "bar.point — offset-anchored tracking line",
    inlineSource: INLINE_SOURCE,
    intervalCount: 5,
    assertions: ASSERTIONS,
});
