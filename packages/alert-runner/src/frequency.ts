// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertFrequency,
    AlertRunnerPhase,
    AlertSuppression,
    AlertSuppressionReason,
    FrequencyGateState,
} from "./types.js";

/**
 * What the gate needs to know about one emission.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { GateCandidate } from "@invinite-org/chartlang-alert-runner";
 *     const c: GateCandidate = { kind: "alert", id: "x.chart.ts:3:9#0", time: 0 };
 *     void c;
 */
export type GateCandidate = Readonly<{ kind: "alert" | "condition"; id: string; time: number }>;

/**
 * The verdict for one evaluation: the candidates delivered (in input order)
 * and the ones held back with their reason.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { GateVerdict, GateCandidate } from "@invinite-org/chartlang-alert-runner";
 *     declare const verdict: GateVerdict<GateCandidate>;
 *     void verdict.delivered.length;
 */
export type GateVerdict<T extends GateCandidate> = Readonly<{
    delivered: ReadonlyArray<T>;
    suppressed: ReadonlyArray<AlertSuppression>;
}>;

/**
 * The frequency gate: decides which emissions of an evaluation deliver.
 * Compute is never gated — the caller pushes every bar regardless — only
 * delivery is.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { createFrequencyGate } from "@invinite-org/chartlang-alert-runner";
 *     const gate = createFrequencyGate({ frequency: "once_per_bar", intervalMs: 60_000 });
 *     const verdict = gate.evaluate([{ kind: "alert", id: "a", time: 0 }], "close");
 *     void verdict;
 */
export type FrequencyGate = Readonly<{
    evaluate<T extends GateCandidate>(
        candidates: ReadonlyArray<T>,
        phase: AlertRunnerPhase,
    ): GateVerdict<T>;
    /** A JSON-clean copy of the gate's memory, for the snapshot. */
    state(): FrequencyGateState;
    readonly exhausted: boolean;
}>;

/**
 * Build a {@link FrequencyGate}. The rules, per id (`kind:id`):
 *
 * 1. A spent `"once"` gate delivers nothing (`"exhausted"`).
 * 2. A pre-close evaluation under `"once_per_bar_close"` delivers nothing
 *    (`"frequency"`).
 * 3. Under `"once_per_bar"` / `"once_per_bar_close"` one bar delivers once:
 *    an id that already delivered on this bar time is held
 *    (`"already-fired-this-bar"`) — which is what makes a pre-close fire and
 *    the same bar's close one signal.
 * 4. With `cooldownBars > 0`, an id that delivered less than
 *    `cooldownBars × intervalMs` ago is held (`"cooldown"`), in every
 *    frequency.
 *
 * A held emission records nothing, so it can never suppress a later
 * legitimate delivery.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { createFrequencyGate } from "@invinite-org/chartlang-alert-runner";
 *     const gate = createFrequencyGate({
 *         frequency: "every_time",
 *         intervalMs: 3_600_000,
 *         cooldownBars: 3,
 *     });
 *     void gate.state();
 */
export function createFrequencyGate(
    opts: Readonly<{
        frequency: AlertFrequency;
        intervalMs: number;
        cooldownBars?: number;
        state?: FrequencyGateState;
    }>,
): FrequencyGate {
    const lastFired = new Map<string, number>(Object.entries(opts.state?.lastFiredBarTime ?? {}));
    let exhausted = opts.state?.exhausted ?? false;
    const cooldownMs = (opts.cooldownBars ?? 0) * opts.intervalMs;
    const oncePerBar = opts.frequency === "once_per_bar" || opts.frequency === "once_per_bar_close";

    function verdictFor(candidate: GateCandidate): AlertSuppressionReason | null {
        const last = lastFired.get(`${candidate.kind}:${candidate.id}`);
        if (last === undefined) return null;
        if (oncePerBar && last === candidate.time) return "already-fired-this-bar";
        if (cooldownMs > 0 && candidate.time - last < cooldownMs) return "cooldown";
        return null;
    }

    return Object.freeze({
        evaluate<T extends GateCandidate>(
            candidates: ReadonlyArray<T>,
            phase: AlertRunnerPhase,
        ): GateVerdict<T> {
            const blanket: AlertSuppressionReason | null = exhausted
                ? "exhausted"
                : phase === "preClose" && opts.frequency === "once_per_bar_close"
                  ? "frequency"
                  : null;
            const delivered: T[] = [];
            const suppressed: AlertSuppression[] = [];
            for (const candidate of candidates) {
                const reason = blanket ?? verdictFor(candidate);
                if (reason !== null) {
                    suppressed.push({
                        kind: candidate.kind,
                        id: candidate.id,
                        time: candidate.time,
                        reason,
                    });
                    continue;
                }
                delivered.push(candidate);
                lastFired.set(`${candidate.kind}:${candidate.id}`, candidate.time);
            }
            if (opts.frequency === "once" && delivered.length > 0) exhausted = true;
            return { delivered, suppressed };
        },
        state(): FrequencyGateState {
            return { lastFiredBarTime: Object.fromEntries(lastFired), exhausted };
        },
        get exhausted(): boolean {
            return exhausted;
        },
    });
}
