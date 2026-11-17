// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";

import type { AlertRunnerCompiledScript } from "./types.js";

/**
 * Whether a runtime snapshot round trip reproduces a script's state exactly.
 * `"exact"`: restore + replay equals a cold run. `"lossy"`: the script holds
 * state the runtime snapshot does not capture, so a restore would silently
 * reset it (a `ta.crossover` would miss its first bar, a `ta.atr` would
 * re-warm from nothing).
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { SnapshotFidelity } from "@invinite-org/chartlang-alert-runner";
 *     const fidelity: SnapshotFidelity = "exact";
 *     void fidelity;
 */
export type SnapshotFidelity = "exact" | "lossy";

/**
 * Options of {@link snapshotFidelityOf}.
 *
 * @since 1.1
 * @stable
 * @example
 *     import type { SnapshotFidelityOpts } from "@invinite-org/chartlang-alert-runner";
 *     const opts: SnapshotFidelityOpts = { externalSeries: true };
 *     void opts;
 */
export type SnapshotFidelityOpts = Readonly<{
    /** The runner feeds `input.externalSeries` inputs. */
    externalSeries?: boolean;
}>;

/**
 * Slot-bearing primitives whose state the runtime snapshot captures
 * (`packages/runtime/src/persistentStateStore.runtime.ts` +
 * `ta/persistence.ts`): the three persisted `ta.*` kinds, every `state.*`
 * slot, the stateless emitters, the `order.*` position and the data form of
 * `request.security` (its ring rides `streams`). Every other slot-bearing
 * primitive — any other `ta.*`, `draw.*`, `request.lowerTf` — is lossy.
 * `alertRunner.fidelity.test.ts` pins this set against a real snapshot.
 */
const PERSISTED: ReadonlySet<string> = new Set([
    "ta.sma",
    "ta.ema",
    "ta.rsi",
    "plot",
    "hline",
    "bgcolor",
    "barcolor",
    "plotcandle",
    "plotbar",
    "alert",
    "order.buy",
    "order.sell",
    "order.close",
    "state.float",
    "state.int",
    "state.bool",
    "state.string",
    "state.series",
    "state.color",
    "state.boolSeries",
    "state.stringSeries",
    "state.tick.float",
    "state.tick.int",
    "state.tick.bool",
    "state.tick.string",
    "state.array",
    "state.map",
    "request.security",
]);

/** Last name segment → every stateful primitive spelled that way. */
const BY_CALLEE: ReadonlyMap<string, ReadonlyArray<string>> = (() => {
    const map = new Map<string, string[]>();
    for (const entry of STATEFUL_PRIMITIVES) {
        if (!entry.slot) continue;
        const callee = entry.name.slice(entry.name.lastIndexOf(".") + 1);
        map.set(callee, [...(map.get(callee) ?? []), entry.name]);
    }
    return map;
})();

// A compiler-injected callsite id is the first argument of every slot-bearing
// call: `ta2.crossover("x.chart.ts:4:7#0", …)`, `alert2("x.chart.ts:4:35#0", …)`.
const SLOT_CALL = /([A-Za-z_$][\w$]*)\(\s*"[^"\n]*:\d+:\d+#\d+"/g;

/**
 * Classify a compiled script's snapshot fidelity by its slot-bearing calls
 * (the compiler injects a callsite id into each). A callee whose name could
 * be any non-persisted primitive makes the script `"lossy"`, and so does an
 * expression-form `request.security` (its per-callsite runner state lives on
 * a secondary stream the snapshot does not walk). Conservative by design: a
 * false `"lossy"` costs a warm-up, a false `"exact"` would deliver wrong
 * alerts after a restore.
 *
 * `opts.externalSeries: true` (@since 1.1) — the runner feeds
 * `input.externalSeries` inputs — always gives `"lossy"`: the external-series
 * rings are not part of the runtime snapshot, so a restore would read `NaN`
 * history. The host rebuilds such a runner by warm-up (replay).
 *
 * @since 1.0
 * @stable
 * @example
 *     import { snapshotFidelityOf } from "@invinite-org/chartlang-alert-runner";
 *     declare const compiled: Parameters<typeof snapshotFidelityOf>[0];
 *     const storable = snapshotFidelityOf(compiled) === "exact";
 *     void storable;
 */
export function snapshotFidelityOf(
    compiled: AlertRunnerCompiledScript,
    opts: SnapshotFidelityOpts = {},
): SnapshotFidelity {
    if (opts.externalSeries === true) return "lossy";
    if ((compiled.manifest.securityExpressions ?? []).length > 0) return "lossy";
    for (const match of compiled.moduleSource.matchAll(SLOT_CALL)) {
        const candidates = BY_CALLEE.get(match[1] as string) ?? [];
        if (candidates.some((name) => !PERSISTED.has(name))) return "lossy";
    }
    return "exact";
}
