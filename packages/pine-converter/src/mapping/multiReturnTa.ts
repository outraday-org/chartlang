// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * How one Pine positional argument of a multi-return `ta.*` call maps onto the
 * chartlang call: passed through as a chartlang positional, folded into the
 * trailing opts object under `key`, or dropped (Pine concept with no chartlang
 * equivalent — e.g. `ta.kc`'s `source`/`useTrueRange`, `ta.dmi`'s adx
 * smoothing). `drop` raises a `multi-return-arg-dropped` info at the call site.
 *
 * @since 0.1
 * @stable
 * @example
 *     const a: MultiReturnArg = { kind: "opt", key: "fastLength" };
 *     void a;
 */
export type MultiReturnArg =
    | Readonly<{ kind: "positional" }>
    | Readonly<{ kind: "opt"; key: string }>
    | Readonly<{ kind: "drop" }>;

/**
 * The lowering of a Pine multi-return `ta.*` constructor. `args` describes the
 * Pine positional layout in order; `fields` is the chartlang result field for
 * each Pine TUPLE POSITION (Pine return order — which can differ from
 * chartlang's own field order, e.g. Bollinger's `[middle, upper, lower]`), or
 * `null` when Pine returns a value chartlang's result type does not expose
 * (e.g. `ta.dmi`'s ADX).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { MULTI_RETURN_TA_MAP } from "@invinite-org/chartlang-pine-converter";
 *     const m = MULTI_RETURN_TA_MAP.get("ta.macd");
 *     void m?.fields; // ["macd", "signal", "hist"]
 */
export type MultiReturnTaMapping = Readonly<{
    pine: string;
    chartlang: string;
    args: readonly MultiReturnArg[];
    fields: readonly (string | null)[];
}>;

const POSITIONAL: MultiReturnArg = { kind: "positional" };
const DROP: MultiReturnArg = { kind: "drop" };
const opt = (key: string): MultiReturnArg => ({ kind: "opt", key });

const entry = (mapping: MultiReturnTaMapping): readonly [string, MultiReturnTaMapping] => [
    mapping.pine,
    mapping,
];

/**
 * Pine v6 multi-output `ta.*` constructors → their chartlang
 * record-returning equivalents. Keyed by the dotted Pine name; consumed by the
 * tuple-destructuring transform to emit `const __x_result = <fn>(<args>)` plus
 * per-element `result.<field>.current` aliases. Every non-null `fields` name is
 * a real key of the corresponding `core` `*Result` type (cross-checked by
 * `multiReturnTa.test.ts`). Add a Pine multi-return = add one row.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { multiReturnTaLookup } from "@invinite-org/chartlang-pine-converter";
 *     multiReturnTaLookup("ta.macd")?.chartlang; // "ta.macd"
 */
export const MULTI_RETURN_TA_MAP: ReadonlyMap<string, MultiReturnTaMapping> = new Map<
    string,
    MultiReturnTaMapping
>([
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.macd
    // Pine `[macd, signal, hist] = ta.macd(source, fast, slow, sig)`.
    entry({
        pine: "ta.macd",
        chartlang: "ta.macd",
        args: [POSITIONAL, opt("fastLength"), opt("slowLength"), opt("signalLength")],
        fields: ["macd", "signal", "hist"],
    }),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.bb
    // Pine `[middle, upper, lower] = ta.bb(source, length, mult)`; chartlang's
    // own field order is {upper, middle, lower} — the table maps by Pine
    // position so the transform never reasons about the swap.
    entry({
        pine: "ta.bb",
        chartlang: "ta.bb",
        args: [POSITIONAL, POSITIONAL, opt("multiplier")],
        fields: ["middle", "upper", "lower"],
    }),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.kc
    // Pine `[middle, upper, lower] = ta.kc(source, length, mult, useTrueRange)`;
    // chartlang `ta.keltner` hard-codes the source (close) and has no
    // true-range toggle, so both are dropped.
    entry({
        pine: "ta.kc",
        chartlang: "ta.keltner",
        args: [DROP, opt("length"), opt("multiplier"), DROP],
        fields: ["middle", "upper", "lower"],
    }),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.dmi
    // Pine `[diplus, diminus, adx] = ta.dmi(diLength, adxSmoothing)`; chartlang
    // `DmiResult` exposes only {plusDi, minusDi} (ADX lives in `ta.adx`), so the
    // 3rd output has no field and the adx-smoothing arg is dropped.
    entry({
        pine: "ta.dmi",
        chartlang: "ta.dmi",
        args: [POSITIONAL, DROP],
        fields: ["plusDi", "minusDi", null],
    }),
    // docs: https://www.tradingview.com/pine-script-reference/v6/#fun_ta.supertrend
    // Pine `[supertrend, direction] = ta.supertrend(factor, atrPeriod)`; the
    // factor is the multiplier and atrPeriod the length (opts are keyed, so the
    // Pine arg order is preserved without reordering logic).
    entry({
        pine: "ta.supertrend",
        chartlang: "ta.supertrend",
        args: [opt("multiplier"), opt("length")],
        fields: ["line", "direction"],
    }),
]);

/**
 * Resolve a Pine `ta.*` member against {@link MULTI_RETURN_TA_MAP}, or `null`
 * when it is not a recognised multi-return constructor.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { multiReturnTaLookup } from "@invinite-org/chartlang-pine-converter";
 *     multiReturnTaLookup("ta.sma"); // null
 */
export const multiReturnTaLookup = (key: string): MultiReturnTaMapping | null =>
    MULTI_RETURN_TA_MAP.get(key) ?? null;
