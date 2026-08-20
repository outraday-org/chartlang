// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "inputs gated",
    apiVersion: 1,
    inputs: {
        lvl: input.price(2),
    },
    compute({ inputs, plot }) {
        plot(inputs.lvl);
    },
});
`;

// The gated `price` input resolves to its literal default `2` on every bar, so
// the series is the constant 2 over the five replayed golden bars. The hash is
// deliberately gate-INVARIANT — the harness passes no input overrides, so the
// declined key resolves to the same `2` with or without the gate — which is
// what makes the paired `diagnostic-code-present` assertion the load-bearing
// one. Re-pin via the runner's "expected vs actual" message like every other
// hash.
const GATED_DEFAULT_HASH = "278aaf7486e661e63f84b49945c305d44fc2ddcb46017d9f0b785050fe747afb";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "unsupported-input-kind" },
    // The gate keys its dedup on a set of its own, and a gated key never
    // reaches `matchesDescriptor` — so no coercion diagnostic is possible for
    // it. A shared dedup set would show up here as one code swallowing the
    // other on some hosts and not others.
    { kind: "diagnostic-code-absent", code: "input-coercion-failed" },
    // The script still runs: the gated input took its default.
    { kind: "plot-hash", sha256: GATED_DEFAULT_HASH },
]);

/**
 * `inputs` capability gate — a manifest input whose `kind` is absent from the
 * adapter's declared {@link Capabilities.inputs} set resolves to its default
 * and pushes one `unsupported-input-kind` diagnostic per key per mount.
 *
 * `capabilitiesOverride` pins a NON-EMPTY set that simply omits `price`, which
 * is the stronger shape: it proves the gate is real membership testing rather
 * than an "empty set" special case, and it keeps the scenario byte-stable if
 * the six bundled example adapters (all of which currently declare an EMPTY
 * `inputs` set) ever fill theirs in — the same "pin it per scenario, never
 * inherit it" discipline the `order-*` scenarios use for `orders`.
 *
 * `historyReseed` is **load-bearing and not decoration**: input resolution is
 * MOUNT-time, and the per-bar close loop calls `resetBarEmissions` before the
 * first `compute`, which discards the mount queue. `history` pushes hoist it
 * (`execution/onHistory.ts`), so a `history`-driven mode is the only way this
 * harness can observe ANY mount-time diagnostic — the pre-existing
 * `input-coercion-failed` is unobservable here for exactly the same reason,
 * which is why no scenario has ever asserted its presence. The re-seed also
 * proves the dedup set is rebuilt with the context: the replay re-warns
 * exactly once rather than zero times (a surviving set) or twice (a leaked
 * queue). `reseedFeeds` is empty — this script has no external series.
 *
 * @since 1.12
 * @stable
 * @example
 *     import { INPUTS_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void INPUTS_GATED_SCENARIO;
 */
export const INPUTS_GATED_SCENARIO: Scenario = Object.freeze({
    id: "inputs-gated",
    title: "input kind declined by the adapter's inputs capability set",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    capabilitiesOverride: { inputs: new Set(["interval"]) },
    historyReseed: { bars: 5, reseedFeeds: {} },
    assertions: ASSERTIONS,
});
