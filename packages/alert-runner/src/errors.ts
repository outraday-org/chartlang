// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Machine-readable cause of an {@link AlertRunnerError}.
 *
 * - `"invalid-argument"` — a malformed option, bar, interval or offset.
 * - `"invalid-inputs"` — the user inputs do not match the manifest
 *   (`details` lists every problem).
 * - `"load-failed"` — the compiled module did not load in the sandbox.
 * - `"warm-up-not-allowed"` — `warmUp` after a restore or after the first bar.
 * - `"stale-bar"` — a pre-close bar at or before the last folded bar.
 * - `"unknown-interval"` — a secondary interval the manifest never requested.
 * - `"snapshot-unavailable"` — the sandbox could not capture its state.
 * - `"aborted"` — a guest call hit `maxSteps` or `maxStepMs`
 *   (`reason` says which); the runner is failed.
 * - `"out-of-memory"` — the guest exhausted `maxHeapBytes`; the runner is failed.
 * - `"runner-failed"` — a call after a fatal error.
 * - `"disposed"` — a call after `dispose()`.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AlertRunnerErrorCode } from "@invinite-org/chartlang-alert-runner";
 *     const code: AlertRunnerErrorCode = "aborted";
 *     void code;
 */
export type AlertRunnerErrorCode =
    | "invalid-argument"
    | "invalid-inputs"
    | "load-failed"
    | "warm-up-not-allowed"
    | "stale-bar"
    | "unknown-interval"
    | "snapshot-unavailable"
    | "aborted"
    | "out-of-memory"
    | "runner-failed"
    | "disposed";

/**
 * The one error type the alert runner throws. `code` is the stable part;
 * `message` is for humans. `reason` is set on `"aborted"` (and on the
 * `"runner-failed"` refusals that follow it): `"steps"` for the deterministic
 * budget, `"time"` for the wall clock. `details` carries the problem list of
 * `"invalid-inputs"`.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { AlertRunnerError } from "@invinite-org/chartlang-alert-runner";
 *
 *     try {
 *         await runner.onBarClose(bar);
 *     } catch (err) {
 *         if (err instanceof AlertRunnerError && err.code === "aborted") {
 *             runner.dispose();
 *         }
 *     }
 */
export class AlertRunnerError extends Error {
    readonly code: AlertRunnerErrorCode;
    readonly reason: "time" | "steps" | undefined;
    readonly details: ReadonlyArray<string>;

    constructor(
        code: AlertRunnerErrorCode,
        message: string,
        extra: Readonly<{
            reason?: "time" | "steps" | undefined;
            details?: ReadonlyArray<string>;
            cause?: unknown;
        }> = {},
    ) {
        super(message, extra.cause === undefined ? undefined : { cause: extra.cause });
        this.name = "AlertRunnerError";
        this.code = code;
        this.reason = extra.reason;
        this.details = extra.details ?? [];
    }
}
