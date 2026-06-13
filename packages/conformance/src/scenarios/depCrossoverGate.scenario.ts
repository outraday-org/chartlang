// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

// Private dep: a titled fast EMA the default consumes via .output("line").
const fast = defineIndicator({
    name: "fast ema",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 5), { title: "line" });
    },
});

// Drawn named export: a slow EMA that the default ALSO consumes. Being a
// sibling drawn export, its titled output must also reach the dep-output
// store for the default's crossover to see real numbers.
export const slow = defineIndicator({
    name: "slow ema",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 20), { title: "line" });
    },
});

// Default consumer: emits a plot ONLY on the bar where the consumed fast
// series crosses over the consumed slow series. Before the
// manifest.outputs fix both producer reads returned NaN every bar, so
// ta.crossover never fired and this plot stream was empty — the
// regression this scenario guards.
export default defineIndicator({
    name: "crossover gate consumer",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        const fastLine = fast.output("line");
        const slowLine = slow.output("line");
        const crossed = ta.crossover(fastLine, slowLine);
        if (crossed.current) {
            plot(fastLine.current - slowLine.current, { title: "cross" });
        }
    },
});
`;

// Slot id of the consumer's crossover-gated `plot(..., { title: "cross" })`
// under the inline sourcePath the runner pins. Scoping the hash to this
// slot isolates the consumer's emissions from the drawn `slow` sibling's
// per-bar plots so the assertion measures crossover firings directly.
const CROSS_SLOT_ID = "<inline:dep-crossover-gate>.chart.ts:39:13#0";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: CROSS_SLOT_ID,
        sha256: "e89916c796be2dfc3b1833e004231f3e5a16a088c4590e41cae2306d881147f0",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "dep-error" },
    { kind: "diagnostic-code-absent", code: "dep-output-not-titled" },
]);

/**
 * Phase-7 regression scenario — the test that would have caught the
 * `manifest.outputs` composition bug. A private dep and a drawn sibling
 * both expose a titled `line` output; the default consumes both and
 * emits a plot ONLY when the consumed fast series crosses over the
 * consumed slow series. While the producers' `manifest.outputs` was
 * `undefined` the dep-output store allocated no ring buffer, both
 * `.output("line")` reads returned NaN, `ta.crossover` never fired, and
 * this plot stream was empty (the SHA-256 of `[]`). The pinned hash is
 * non-empty, so a regression that drops `manifest.outputs` fails this
 * assertion immediately.
 *
 * @since 0.7
 * @stable
 * @example
 *     import { DEP_CROSSOVER_GATE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEP_CROSSOVER_GATE_SCENARIO;
 */
export const DEP_CROSSOVER_GATE_SCENARIO: Scenario = Object.freeze({
    id: "dep-crossover-gate",
    title: "Consumed producer outputs drive a crossover-gated plot",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 500,
    assertions: ASSERTIONS,
});
