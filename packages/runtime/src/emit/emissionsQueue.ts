// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertEmission,
    type AlertConditionEmission,
    type LogEmission,
    type PlotEmission,
    type RuntimeDiagnostic,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";

import type { MutableRunnerEmissions } from "../runtimeContext";

/**
 * Push a `PlotEmission` onto the runner's mutable plot queue. The
 * payload is first validated through Task 4's `validateEmission`; on
 * failure a `malformed-emission` diagnostic is pushed and the plot is
 * dropped. On success, the queue is searched backwards for a
 * `(slotId, bar)` match — if found, the existing entry is replaced
 * in place (last-write-wins per PLAN §7.4). Otherwise the new emission
 * is appended.
 *
 * @since 0.1
 * @example
 *     // import { pushPlot } from "@invinite-org/chartlang-runtime/emit";
 *     // pushPlot(queue, plotEmission);
 */
export function pushPlot(queue: MutableRunnerEmissions, e: PlotEmission): void {
    const result = validateEmission(e);
    if (!result.ok) {
        pushDiagnostic(queue, {
            kind: "diagnostic",
            severity: "warning",
            code: "malformed-emission",
            message: result.message,
            slotId: e.slotId,
            bar: e.bar,
        });
        return;
    }
    for (let i = queue.plots.length - 1; i >= 0; i -= 1) {
        const existing = queue.plots[i];
        if (existing.slotId === e.slotId && existing.bar === e.bar) {
            queue.plots[i] = e;
            return;
        }
    }
    queue.plots.push(e);
}

/**
 * Push an `AlertEmission` onto the runner's mutable alert queue. Same
 * validate-then-dedup contract as {@link pushPlot}: a `(slotId, bar)`
 * collision replaces the existing entry; a validation failure pushes
 * a `malformed-emission` diagnostic and drops the alert.
 *
 * @since 0.1
 * @example
 *     // import { pushAlert } from "@invinite-org/chartlang-runtime/emit";
 *     // pushAlert(queue, alertEmission);
 */
export function pushAlert(queue: MutableRunnerEmissions, e: AlertEmission): void {
    const result = validateEmission(e);
    if (!result.ok) {
        pushDiagnostic(queue, {
            kind: "diagnostic",
            severity: "warning",
            code: "malformed-emission",
            message: result.message,
            slotId: e.slotId,
            bar: e.bar,
        });
        return;
    }
    for (let i = queue.alerts.length - 1; i >= 0; i -= 1) {
        const existing = queue.alerts[i];
        if (existing.slotId === e.slotId && existing.bar === e.bar) {
            queue.alerts[i] = e;
            return;
        }
    }
    queue.alerts.push(e);
}

/**
 * Push an `AlertConditionEmission` onto the runner's mutable queue after
 * adapter-kit validation. Unlike `alert`, alert conditions intentionally
 * preserve both `fired: true` and `fired: false` transitions for UI state.
 *
 * @since 0.5
 * @example
 *     // import { pushAlertCondition } from "@invinite-org/chartlang-runtime/emit";
 *     // pushAlertCondition(queue, emission);
 */
export function pushAlertCondition(
    queue: MutableRunnerEmissions,
    e: AlertConditionEmission,
): void {
    const result = validateEmission(e);
    if (!result.ok) {
        pushDiagnostic(queue, {
            kind: "diagnostic",
            severity: "warning",
            code: "malformed-emission",
            message: result.message,
            slotId: null,
            bar: e.bar,
        });
        return;
    }
    const target = queue.alertConditions ?? [];
    queue.alertConditions = target;
    target.push(e);
}

/**
 * Push a `LogEmission` onto the runner's mutable queue after adapter-kit
 * validation. Logs preserve order and are not deduped.
 *
 * @since 0.5
 * @example
 *     // import { pushLog } from "@invinite-org/chartlang-runtime/emit";
 *     // pushLog(queue, emission);
 */
export function pushLog(queue: MutableRunnerEmissions, e: LogEmission): void {
    const result = validateEmission(e);
    if (!result.ok) {
        pushDiagnostic(queue, {
            kind: "diagnostic",
            severity: "warning",
            code: "malformed-emission",
            message: result.message,
            slotId: null,
            bar: e.bar,
        });
        return;
    }
    queue.logs.push(e);
}

/**
 * Append a `RuntimeDiagnostic` to the runner's diagnostic queue. No
 * validation — diagnostics are the failure sink, so recursively
 * validating them would loop. Every other emission path routes
 * through here when something goes wrong.
 *
 * @since 0.1
 * @example
 *     // import { pushDiagnostic } from "@invinite-org/chartlang-runtime/emit";
 *     // pushDiagnostic(queue, { kind: "diagnostic", severity: "warning",
 *     //     code: "unsupported-plot-kind", message: "drop",
 *     //     slotId: "x.ts:1:1#0", bar: 0 });
 */
export function pushDiagnostic(queue: MutableRunnerEmissions, d: RuntimeDiagnostic): void {
    queue.diagnostics.push(d);
}
