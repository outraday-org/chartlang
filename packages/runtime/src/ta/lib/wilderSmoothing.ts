// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// New helper extracted from invinite/src/components/trading-chart/indicators/
//   rsi.ts and atr.ts Wilder smoothing loops
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * One step of Wilder's α = 1/length smoothing. Returns the updated
 * running average given the prior average and a new sample:
 * `prev * (length − 1) / length + sample / length`. RSI's avgGain /
 * avgLoss recurrence and ATR's Wilder ATR recurrence both fold onto
 * this helper so a single line carries the math.
 *
 * @formula  out = prev * (length − 1) / length + sample / length
 * @since 0.1
 * @stable
 * @example
 *     // import { wilderStep } from "./wilderSmoothing";
 *     // const nextAvg = wilderStep(prevAvg, gain, 14);
 */
export function wilderStep(prev: number, sample: number, length: number): number {
    return (prev * (length - 1) + sample) / length;
}
