// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AtrOpts,
    BbOpts,
    BbResult,
    EmaOpts,
    MacdOpts,
    MacdResult,
    RsiOpts,
    Series,
    SmaOpts,
    StdevOpts,
} from "@invinite-org/chartlang-core";

import { atr } from "./atr";
import { bb } from "./bb";
import { crossover } from "./crossover";
import { crossunder } from "./crossunder";
import { ema } from "./ema";
import { macd } from "./macd";
import { rsi } from "./rsi";
import { sma } from "./sma";
import type { ScalarOrSeries } from "./sourceValue";
import { stdev } from "./stdev";

/**
 * The runtime-facing surface of the `ta` namespace. Each method takes
 * a compiler-injected `slotId` as its first argument, then the user-
 * facing arguments core's `TaNamespace` types. The compiler (Task 2)
 * inlines the slot id as a string literal at every callsite so the
 * runtime can look up its per-callsite hidden state in
 * `RuntimeContext.stream.taSlots`. Script authors never see the slot
 * arg — they import `ta` and call `ta.ema(close, 20)`; the bundled
 * output becomes `runtime.ta.ema("slot-id", close, 20)`.
 *
 * @formula  N/A — type surface, see per-primitive JSDoc
 * @since 0.1
 * @experimental
 * @example
 *     // import type { RuntimeTaNamespace } from "@invinite-org/chartlang-runtime";
 *     // const fn: RuntimeTaNamespace["ema"] = (slotId, src, length) =>
 *     //     ({ current: NaN, length: 0 }) as never;
 */
export type RuntimeTaNamespace = {
    sma(slotId: string, source: ScalarOrSeries, length: number, opts?: SmaOpts): Series<number>;
    ema(slotId: string, source: ScalarOrSeries, length: number, opts?: EmaOpts): Series<number>;
    stdev(slotId: string, source: ScalarOrSeries, length: number, opts?: StdevOpts): Series<number>;
    bb(slotId: string, source: ScalarOrSeries, length: number, opts?: BbOpts): BbResult;
    rsi(slotId: string, source: ScalarOrSeries, length: number, opts?: RsiOpts): Series<number>;
    macd(slotId: string, source: ScalarOrSeries, opts?: MacdOpts): MacdResult;
    atr(slotId: string, length: number, opts?: AtrOpts): Series<number>;
    crossover(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries): Series<boolean>;
    crossunder(slotId: string, a: ScalarOrSeries, b: ScalarOrSeries): Series<boolean>;
};

/**
 * Frozen registry of every Phase-1 `ta.*` primitive. Exactly 9 entries
 * — matches `STATEFUL_PRIMITIVES` minus `plot` / `hline` / `alert`
 * (those land in Task 8). Task 9's worker boot iterates this map to
 * wire the worker's compiled-script globals; the conformance suite
 * (Task 12) reads it to assert primitive coverage.
 *
 * @formula  N/A — frozen registry, see per-primitive JSDoc
 * @since 0.1
 * @experimental
 * @example
 *     // import { TA_REGISTRY } from "@invinite-org/chartlang-runtime";
 *     // const keys = Object.keys(TA_REGISTRY);
 */
export const TA_REGISTRY = Object.freeze({
    sma,
    ema,
    stdev,
    bb,
    rsi,
    macd,
    atr,
    crossover,
    crossunder,
} as const);

/**
 * The script-facing `ta` constant the compiler binds against. Equal
 * by identity to {@link TA_REGISTRY}; typed as the slot-aware
 * {@link RuntimeTaNamespace} so downstream consumers (the host-worker
 * boot, the conformance harness) get the runtime signature.
 *
 * @formula  N/A — script-facing namespace, see per-primitive JSDoc
 * @since 0.1
 * @experimental
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const out = ta.ema("slot-id", { current: 12 }, 20);
 */
export const ta: RuntimeTaNamespace = TA_REGISTRY;
