// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

import type { AlertFrequency, AlertRunnerEvent, AlertRunnerPhase } from "./types.js";

/**
 * Project one drained batch into candidate events, in drain order: every
 * `alert()` emission, then every `fired: true` condition signal (a
 * `fired: false` signal is a disarm, not an alert).
 *
 * The `dedupeKey` deliberately leaves out the runtime's bar INDEX (which
 * moves with the warm-up length) and uses the bar TIME, so the same signal
 * keeps its key across restarts, restores and history sizes.
 *
 * @since 1.0
 * @internal
 * @example
 *     declare const drained: Parameters<typeof projectEvents>[0];
 *     const events = projectEvents(drained, "close", 0, "every_time");
 *     void events;
 */
export function projectEvents(
    drained: RunnerEmissions,
    phase: AlertRunnerPhase,
    offsetMs: number,
    frequency: AlertFrequency,
): AlertRunnerEvent[] {
    const occurrences = new Map<string, number>();
    const suffix = phase === "preClose" && frequency === "every_time" ? `:pre:${offsetMs}` : "";
    const keyFor = (kind: "alert" | "condition", id: string, time: number): string => {
        const base = `${kind}:${id}:${time}${suffix}`;
        const seen = occurrences.get(base) ?? 0;
        occurrences.set(base, seen + 1);
        return seen === 0 ? base : `${base}#${seen}`;
    };
    const events: AlertRunnerEvent[] = [];
    for (const alert of drained.alerts) {
        events.push({
            kind: "alert",
            id: alert.slotId,
            message: alert.message,
            severity: alert.severity,
            meta: alert.meta,
            bar: alert.bar,
            time: alert.time,
            dedupeKey: keyFor("alert", alert.slotId, alert.time),
            phase,
        });
    }
    for (const signal of drained.alertConditions) {
        if (!signal.fired) continue;
        events.push({
            kind: "condition",
            id: signal.conditionId,
            title: signal.title,
            message: signal.defaultMessage,
            meta: { description: signal.description },
            bar: signal.bar,
            time: signal.time,
            dedupeKey: keyFor("condition", signal.conditionId, signal.time),
            phase,
        });
    }
    return events;
}
