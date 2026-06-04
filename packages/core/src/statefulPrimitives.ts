// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Frozen set of fully-qualified call names the compiler injects callsite
 * ids into (PLAN.md §5.5). Phase 1 ships exactly these 12. Phase 2+ extends
 * via `Object.freeze(new Set([...PHASE_1, ...]))` in this file — the
 * registry stays the single source of truth for both the compiler
 * (callsite-id transformer) and the runtime (slot-store keying).
 *
 * @since 0.1
 * @example
 *     import { STATEFUL_PRIMITIVES } from "@invinite-org/chartlang-core";
 *     if (STATEFUL_PRIMITIVES.has("ta.ema")) {
 *         // compiler injects an id here
 *     }
 */
export const STATEFUL_PRIMITIVES: ReadonlySet<string> = Object.freeze(
    new Set<string>([
        "ta.sma",
        "ta.ema",
        "ta.stdev",
        "ta.bb",
        "ta.rsi",
        "ta.macd",
        "ta.atr",
        "ta.crossover",
        "ta.crossunder",
        "plot",
        "hline",
        "alert",
    ]),
);
