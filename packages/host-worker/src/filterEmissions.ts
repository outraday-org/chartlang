// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertEmission,
    type DrawingEmission,
    type PlotEmission,
    type RunnerEmissions,
    type RuntimeDiagnostic,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";

/**
 * Walk a `RunnerEmissions` snapshot and replace any plot / alert that fails
 * adapter-kit's `validateEmission` with a `malformed-emission` diagnostic.
 * Drawings pass through unchanged in Phase 1 (no `draw.*` primitives ship
 * yet); diagnostics are appended to (never validated against — recursive
 * validation would loop).
 *
 * The boot calls this on every `drain()` before posting `emissions` back to
 * the host; the trust boundary for the postMessage wire format is here.
 *
 * @since 0.1
 * @experimental
 * @example
 *     // const out = filterEmissions(runner.drain());
 *     // postMessage({ kind: "emissions", nonce, emissions: out });
 *     const fn: typeof filterEmissions = filterEmissions;
 *     void fn;
 */
export function filterEmissions(raw: RunnerEmissions): RunnerEmissions {
    const plots: Array<PlotEmission> = [];
    const drawings: Array<DrawingEmission> = [];
    const alerts: Array<AlertEmission> = [];
    const diagnostics: Array<RuntimeDiagnostic> = [...raw.diagnostics];

    for (const p of raw.plots) {
        const r = validateEmission(p);
        if (r.ok) {
            plots.push(p);
        } else {
            diagnostics.push({
                kind: "diagnostic",
                severity: "warning",
                code: r.code,
                message: r.message,
                slotId: p.slotId,
                bar: p.bar,
            });
        }
    }
    for (const a of raw.alerts) {
        const r = validateEmission(a);
        if (r.ok) {
            alerts.push(a);
        } else {
            diagnostics.push({
                kind: "diagnostic",
                severity: "warning",
                code: r.code,
                message: r.message,
                slotId: a.slotId,
                bar: a.bar,
            });
        }
    }
    for (const d of raw.drawings) {
        drawings.push(d);
    }
    return {
        plots,
        drawings,
        alerts,
        diagnostics,
        fromBar: raw.fromBar,
        toBar: raw.toBar,
    };
}
