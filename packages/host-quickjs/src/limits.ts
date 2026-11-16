// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { QuickJsHostLimits } from "./types.js";

/**
 * Phase-5 default QuickJS hard limits. Frozen so consumers cannot mutate the
 * singleton; per-host overrides are merged by `createQuickJsHost` in Task 7.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { DEFAULT_QUICKJS_LIMITS } from "@invinite-org/chartlang-host-quickjs";
 *     const heap = DEFAULT_QUICKJS_LIMITS.maxHeapBytes;
 *     void heap;
 */
export const DEFAULT_QUICKJS_LIMITS: QuickJsHostLimits = Object.freeze({
    maxHeapBytes: 64 * 1024 * 1024,
    maxStepMs: 1,
    maxLoadTimeoutMs: 30_000,
    maxSteps: Number.POSITIVE_INFINITY,
});

/**
 * Interrupt checkpoints QuickJS runs between two polls of the interrupt
 * handler: the engine's `JS_INTERRUPT_COUNTER_INIT`, decremented on every
 * backward jump and function call. The host charges this many steps per poll
 * against `QuickJsHostLimits.maxSteps`, so the budget is enforced at this
 * granularity — an abort lands within one poll of the limit.
 *
 * @since 1.8
 * @stable
 * @example
 *     import { QUICKJS_STEPS_PER_INTERRUPT_POLL } from "@invinite-org/chartlang-host-quickjs";
 *     // A budget of 500 polls:
 *     const maxSteps = 500 * QUICKJS_STEPS_PER_INTERRUPT_POLL;
 *     void maxSteps;
 */
export const QUICKJS_STEPS_PER_INTERRUPT_POLL = 10_000;
