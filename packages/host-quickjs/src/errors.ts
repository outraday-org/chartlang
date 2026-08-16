// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

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
 *             host.dispose();
 *         }
 *     }
 */
export class QuickJsStepAbortedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "QuickJsStepAbortedError";
    }
}
