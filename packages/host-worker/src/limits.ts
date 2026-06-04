// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { HostLimits } from "./types";

/**
 * Phase-1 default `HostLimits`. `maxCpuMsPerStep` is the only enforced cap;
 * `maxHeapBytes` is advisory (no per-worker heap API exists in browsers
 * today) and `maxRingBufferBars` is forwarded for runtime sizing decisions.
 * Frozen so consumers cannot mutate the singleton.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { DEFAULT_LIMITS } from "@invinite-org/chartlang-host-worker";
 *     const cpu = DEFAULT_LIMITS.maxCpuMsPerStep; // 50
 *     void cpu;
 */
export const DEFAULT_LIMITS: HostLimits = Object.freeze({
    maxHeapBytes: 64 * 1024 * 1024,
    maxCpuMsPerStep: 50,
    maxRingBufferBars: 5_000,
});

/**
 * Wall-clock measurement around `fn`. Returns `result` (always — Phase-1
 * enforcement is measurement, not preemption) and `overshoot` (the observed
 * elapsed ms when over budget, `0` otherwise). The worker boot uses this to
 * post `step-overshoot` to the host; Phase 5's QuickJS host swaps this seam
 * for real `setInterruptHandler`-based preemption.
 *
 * Re-throws if `fn` rejects — overshoot detection does not swallow errors.
 *
 * @since 0.1
 * @experimental
 * @example
 *     // const { result, overshoot } = await watchStep(async () => 42, 100);
 *     // result === 42; overshoot === 0;
 *     const fn: typeof watchStep = watchStep;
 *     void fn;
 */
export async function watchStep<T>(
    fn: () => Promise<T>,
    maxMs: number,
): Promise<{ readonly result: T; readonly overshoot: number }> {
    const start = performance.now();
    const result = await fn();
    const elapsed = performance.now() - start;
    return { result, overshoot: elapsed > maxMs ? elapsed : 0 };
}
