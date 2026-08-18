// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RuntimeDiagnostic } from "@invinite-org/chartlang-adapter-kit";

import type { MutableRunnerEmissions } from "../runtimeContext.js";
import type { DepOutputStore } from "./DepOutputStore.js";

/**
 * View of a `DepRunner` the emission filter reads. Carries the
 * dep-specific slot-id prefix, the declared output titles (for NaN
 * padding), and the runner's own emission queue.
 *
 * @since 0.7
 * @stable
 * @example
 *     const v: DepRunnerLike = {
 *         kind: "dep",
 *         localId: "fastTrend",
 *         slotIdPrefix: "dep:fastTrend/",
 *         declaredOutputs: ["line"],
 *         emissions: { plots: [], drawings: [], alerts: [], alertConditions: [], orders: [], logs: [], diagnostics: [], fromBar: 0, toBar: 0 },
 *     };
 *     void v;
 */
export type DepRunnerLike = Readonly<{
    readonly kind: "dep";
    readonly localId: string;
    readonly slotIdPrefix: string;
    readonly declaredOutputs: ReadonlyArray<string>;
    readonly emissions: MutableRunnerEmissions;
}>;

/**
 * View of a `SiblingRunner` the emission filter reads. Same shape as
 * `DepRunnerLike` but keyed by the sibling's exported binding name and
 * with a different slot-id prefix.
 *
 * @since 0.7
 * @stable
 * @example
 *     const v: SiblingRunnerLike = {
 *         kind: "sibling",
 *         exportName: "slowTrend",
 *         slotIdPrefix: "export:slowTrend/",
 *         declaredOutputs: ["line"],
 *         emissions: { plots: [], drawings: [], alerts: [], alertConditions: [], orders: [], logs: [], diagnostics: [], fromBar: 0, toBar: 0 },
 *     };
 *     void v;
 */
export type SiblingRunnerLike = Readonly<{
    readonly kind: "sibling";
    readonly exportName: string;
    readonly slotIdPrefix: string;
    readonly declaredOutputs: ReadonlyArray<string>;
    readonly emissions: MutableRunnerEmissions;
}>;

function prefixSlotId(slotId: string, prefix: string): string {
    return `${prefix}${slotId}`;
}

function prefixNullableSlotId(slotId: string | null, prefix: string): string | null {
    return slotId === null ? null : prefixSlotId(slotId, prefix);
}

function resetEmissions(emissions: MutableRunnerEmissions): void {
    emissions.plots = [];
    emissions.drawings = [];
    emissions.alerts = [];
    emissions.alertConditions = [];
    emissions.orders = [];
    emissions.logs = [];
    emissions.diagnostics = [];
}

function producerIdOf(runner: DepRunnerLike | SiblingRunnerLike): string {
    return runner.kind === "dep" ? runner.localId : runner.exportName;
}

/**
 * Apply the dep / sibling emission policy. Captures titled plots into
 * the shared {@link DepOutputStore}, drops every private-dep emission
 * except diagnostics (visuals AND orders), prefixes sibling plots /
 * alerts / orders with `export:<exportName>/`, and namespaces every
 * diagnostic with the runner's slot-id prefix. Always resets the
 * runner's queue at the end so the next bar starts clean.
 *
 * Per-bar NaN padding: for every declared output that the runner did
 * NOT call `plot(value, { title: "<output>" })` on this bar, the
 * filter appends a NaN to the store so the consumer's series stays
 * continuous (NaN gaps where the producer skipped).
 *
 * @since 0.7
 * @stable
 * @example
 *     // import { applyDepEmissionPolicy } from "@invinite-org/chartlang-runtime";
 *     // applyDepEmissionPolicy(dep, parentEmissions, depOutputStore);
 */
export function applyDepEmissionPolicy(
    runner: DepRunnerLike | SiblingRunnerLike,
    parentEmissions: MutableRunnerEmissions,
    depOutputStore: DepOutputStore,
): void {
    const producerId = producerIdOf(runner);
    const declared = new Set(runner.declaredOutputs);
    const pushedTitles = new Set<string>();

    for (const plot of runner.emissions.plots) {
        const title = plot.title;
        if (declared.has(title)) {
            depOutputStore.push(producerId, title, plot.value ?? Number.NaN);
            pushedTitles.add(title);
        } else if (runner.kind === "dep") {
            // Untitled / unknown-title plot in a private dep — surface as
            // a diagnostic; the visual is still dropped.
            const diag: RuntimeDiagnostic = {
                kind: "diagnostic",
                severity: "warning",
                code: "dep-output-not-titled",
                message:
                    title === ""
                        ? `dep "${runner.localId}" emitted an untitled plot`
                        : `dep "${runner.localId}" emitted plot with undeclared title "${title}"`,
                slotId: prefixSlotId(plot.slotId, runner.slotIdPrefix),
                bar: plot.bar,
            };
            parentEmissions.diagnostics.push(diag);
        }

        if (runner.kind === "sibling") {
            parentEmissions.plots.push({
                ...plot,
                slotId: prefixSlotId(plot.slotId, runner.slotIdPrefix),
            });
        }
    }

    if (runner.kind === "sibling") {
        for (const drawing of runner.emissions.drawings) {
            parentEmissions.drawings.push(drawing);
        }
        for (const alert of runner.emissions.alerts) {
            parentEmissions.alerts.push({
                ...alert,
                slotId: prefixSlotId(alert.slotId, runner.slotIdPrefix),
            });
        }
        // Orders follow the ALERT side of this policy, not the drawing side: the
        // slot id is prefixed so the parent can attribute the callsite, while
        // `dedupeKey` is left exactly as emitted — it embeds the ORIGINAL,
        // unprefixed slot id, and rewriting it would break host idempotency
        // across a remount. A PRIVATE dep needs no arm here at all: nothing
        // forwards, and `resetEmissions` below is the drop (a data dependency
        // must not trade through its consumer; only diagnostics escape).
        for (const order of runner.emissions.orders) {
            parentEmissions.orders.push({
                ...order,
                slotId: prefixSlotId(order.slotId, runner.slotIdPrefix),
            });
        }
        const siblingConditions = runner.emissions.alertConditions ?? [];
        if (siblingConditions.length > 0) {
            const target = parentEmissions.alertConditions ?? [];
            parentEmissions.alertConditions = target;
            for (const condition of siblingConditions) {
                target.push(condition);
            }
        }
        for (const log of runner.emissions.logs) {
            parentEmissions.logs.push(log);
        }
    }

    for (const diag of runner.emissions.diagnostics) {
        parentEmissions.diagnostics.push({
            ...diag,
            slotId: prefixNullableSlotId(diag.slotId, runner.slotIdPrefix),
        });
    }

    for (const title of declared) {
        if (!pushedTitles.has(title)) {
            depOutputStore.push(producerId, title, Number.NaN);
        }
    }

    resetEmissions(runner.emissions);
}
