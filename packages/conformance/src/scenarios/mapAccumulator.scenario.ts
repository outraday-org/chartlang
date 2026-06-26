// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: a per-rounded-price volume profile built with the persistent
 * keyed collection `state.map<number, number>(32)`. Each bar buckets
 * `bar.volume.current` under the rounded close (FIFO-evicting the oldest key
 * once 32 distinct levels are tracked), then plots the CURRENT level's
 * accumulated volume (`levels.get(key) ?? 0`) and the number of tracked levels
 * (`levels.size`). Both series are derived `number`s that flow into the existing
 * `plot` hole, so the scenario needs NO new wire primitive and NO per-adapter
 * code: `pnpm conformance` replays it through every adapter and asserts the plot
 * hashes are byte-stable.
 */
const SOURCE = `import { defineIndicator, plot, state } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Map accumulator",
    apiVersion: 1,
    overlay: true,
    compute({ bar, state, plot }) {
        const levels = state.map<number, number>(32);
        const key = Math.round(bar.close.current);
        levels.set(key, (levels.get(key) ?? 0) + bar.volume.current);
        plot(levels.get(key) ?? 0, { title: "Volume at level" });
        plot(levels.size, { title: "Levels tracked" });
    },
});
`;

// The accumulated-volume series and the tracked-level count are finite from
// bar 0 (each `get` is `?? 0`-guarded; `size` starts at 1) and deterministic
// over the shared golden bars, so each plot pins to its own SHA-256. The hash is
// IDENTICAL across all conformance adapters — that is the byte-stable proof for
// the pure-compute `state.map` keyed-collection surface (no new wire primitive,
// no per-adapter code). Re-pin via the runner's "expected vs actual" message
// only if the golden bars change.
const VALUE_AT_LEVEL_HASH = "9aa49424df6a3918b77bf32eb02459c209e1d6abf175ac921628bd3889b993a1";
const LEVELS_TRACKED_HASH = "3fca90e02f6a9a04a0a8bc3260a7fc39ccbe2603d7bb74e2fe28a25728c72212";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:map-accumulator>.chart.ts:11:9#0",
        sha256: VALUE_AT_LEVEL_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:map-accumulator>.chart.ts:12:9#0",
        sha256: LEVELS_TRACKED_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * `state.map` keyed-accumulation scenario. Proves the persistent bounded keyed
 * collection (`state.map<number, number>(32)`) compiles, allocates, accumulates
 * per-key across bars with FIFO eviction, survives the close/commit discipline,
 * and emits byte-stable finite series — the all-adapter proof for the
 * `state.map` surface (derived values ride the existing `plot` hole; no new wire
 * primitive, no per-adapter code).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MAP_ACCUMULATOR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // MAP_ACCUMULATOR_SCENARIO.id === "map-accumulator"
 *     void MAP_ACCUMULATOR_SCENARIO;
 */
export const MAP_ACCUMULATOR_SCENARIO: Scenario = Object.freeze({
    id: "map-accumulator",
    title: "state.map per-level volume accumulation is byte-stable across adapters",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
