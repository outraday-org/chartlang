// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The budget a {@link QuickJsStepAbortedError} was raised for: `"time"` is the
 * wall-clock deadline (`maxStepMs` for a push, `maxLoadTimeoutMs` for a load),
 * `"steps"` the deterministic `maxSteps` instruction budget.
 *
 * @since 1.8
 * @stable
 * @example
 *     import type { QuickJsAbortReason } from "@invinite-org/chartlang-host-quickjs";
 *     const reason: QuickJsAbortReason = "steps";
 *     void reason;
 */
export type QuickJsAbortReason = "time" | "steps";

/**
 * Thrown when the QuickJS runtime stopped a host call before it could produce a
 * reply — the step or load budget expired, or the guest job queue aborted.
 *
 * Distinct from an ordinary script error: the guest is left mid-computation, so
 * the host that raised this is **poisoned** and refuses further work. Dispose it
 * and build a new one; its accumulated `ta` state is truncated and every value
 * derived from it would be silently wrong.
 *
 * @since 1.6
 * @stable
 * @example
 *     import { QuickJsStepAbortedError } from "@invinite-org/chartlang-host-quickjs";
 *
 *     try {
 *         await host.drain();
 *     } catch (err) {
 *         if (err instanceof QuickJsStepAbortedError) {
 *             // err.reason is "time", "steps", or undefined
 *             host.dispose();
 *         }
 *     }
 */
export class QuickJsStepAbortedError extends Error {
    /**
     * Which budget the interrupt enforced when it cut the call short:
     * `"time"` for the wall-clock `maxStepMs` / `maxLoadTimeoutMs` deadline,
     * `"steps"` for the deterministic `maxSteps` budget. `undefined` when the
     * abort did not come from the interrupt handler (a job queue that stopped
     * on its own, an error constructed by a caller).
     *
     * @since 1.8
     */
    readonly reason: QuickJsAbortReason | undefined;

    constructor(message: string, reason?: QuickJsAbortReason) {
        super(message);
        this.name = "QuickJsStepAbortedError";
        this.reason = reason;
    }
}
