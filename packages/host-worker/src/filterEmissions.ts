// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertEmission,
    type AlertConditionEmission,
    type DrawingEmission,
    type LogEmission,
    type OrderEmission,
    type PlotEmission,
    type RunnerEmissions,
    type RuntimeDiagnostic,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";

// Keep the validated items of one channel and turn every rejection into a
// `malformed-emission` diagnostic. `slotIdOf` is the only thing that differs
// per channel: an emission the compiler gave a slot id attributes its
// diagnostic to that slot, an emission without one reports `null`.
// host-quickjs carries the same helper for the same five channels
// (`createQuickJsHost.ts::partitionValidated`) — the two hosts are separate
// published packages, so the shape is mirrored rather than shared, and
// cross-host parity is what the conformance suite pins.
function partitionValidated<T extends { readonly bar: number }>(
    items: ReadonlyArray<T>,
    diagnostics: Array<RuntimeDiagnostic>,
    slotIdOf: (item: T) => string | null,
): Array<T> {
    return items.filter((item) => {
        const result = validateEmission(item);
        if (result.ok) {
            return true;
        }
        diagnostics.push({
            kind: "diagnostic",
            severity: "warning",
            code: result.code,
            message: result.message,
            slotId: slotIdOf(item),
            bar: item.bar,
        });
        return false;
    });
}

/**
 * Walk a `RunnerEmissions` snapshot and replace any plot / alert /
 * alert-condition / log / order that fails adapter-kit's `validateEmission`
 * with a `malformed-emission` diagnostic. Drawings pass through unchanged in
 * Phase 1 (no `draw.*` primitives ship yet); diagnostics are appended to
 * (never validated against — recursive validation would loop).
 *
 * The boot calls this on every `drain()` before posting `emissions` back to
 * the host; the trust boundary for the postMessage wire format is here.
 *
 * @since 0.1
 * @stable
 * @example
 *     // const out = filterEmissions(runner.drain());
 *     // postMessage({ kind: "emissions", nonce, emissions: out });
 *     const fn: typeof filterEmissions = filterEmissions;
 *     void fn;
 */
export function filterEmissions(raw: RunnerEmissions): RunnerEmissions {
    const diagnostics: Array<RuntimeDiagnostic> = [...raw.diagnostics];
    const plots: Array<PlotEmission> = partitionValidated(raw.plots, diagnostics, (p) => p.slotId);
    const alerts: Array<AlertEmission> = partitionValidated(
        raw.alerts,
        diagnostics,
        (a) => a.slotId,
    );
    const alertConditions: Array<AlertConditionEmission> = partitionValidated(
        raw.alertConditions,
        diagnostics,
        () => null,
    );
    // Orders carry a compiler-injected slot id, so a malformed one is
    // attributable and takes the ALERT side of this set rather than the
    // null-slot alert-condition / log side.
    const orders: Array<OrderEmission> = partitionValidated(
        raw.orders,
        diagnostics,
        (o) => o.slotId,
    );
    const logs: Array<LogEmission> = partitionValidated(raw.logs, diagnostics, () => null);
    const drawings: Array<DrawingEmission> = [...raw.drawings];
    return {
        plots,
        drawings,
        alerts,
        alertConditions,
        orders,
        logs,
        diagnostics,
        fromBar: raw.fromBar,
        toBar: raw.toBar,
    };
}
