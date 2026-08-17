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
    const plots: Array<PlotEmission> = [];
    const drawings: Array<DrawingEmission> = [];
    const alerts: Array<AlertEmission> = [];
    const alertConditions: Array<AlertConditionEmission> = [];
    const orders: Array<OrderEmission> = [];
    const logs: Array<LogEmission> = [];
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
    for (const condition of raw.alertConditions) {
        const r = validateEmission(condition);
        if (r.ok) {
            alertConditions.push(condition);
        } else {
            diagnostics.push({
                kind: "diagnostic",
                severity: "warning",
                code: r.code,
                message: r.message,
                slotId: null,
                bar: condition.bar,
            });
        }
    }
    // Orders carry a compiler-injected slot id, so a malformed one is
    // attributable and follows the ALERT side of this loop set rather than the
    // null-slot alert-condition / log side.
    for (const o of raw.orders) {
        const r = validateEmission(o);
        if (r.ok) {
            orders.push(o);
        } else {
            diagnostics.push({
                kind: "diagnostic",
                severity: "warning",
                code: r.code,
                message: r.message,
                slotId: o.slotId,
                bar: o.bar,
            });
        }
    }
    for (const log of raw.logs) {
        const r = validateEmission(log);
        if (r.ok) {
            logs.push(log);
        } else {
            diagnostics.push({
                kind: "diagnostic",
                severity: "warning",
                code: r.code,
                message: r.message,
                slotId: null,
                bar: log.bar,
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
        alertConditions,
        orders,
        logs,
        diagnostics,
        fromBar: raw.fromBar,
        toBar: raw.toBar,
    };
}
