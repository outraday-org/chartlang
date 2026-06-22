// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { feedKey } from "@invinite-org/chartlang-core";

import type { Bar } from "@invinite-org/chartlang-core";
import type { CandleEvent } from "../types.js";

/**
 * How a {@link mockCandleSource} surfaces the supplied bars:
 *
 * - `history` — yields one warm-up batch with every bar.
 * - `stream` — yields one `close` event per bar in array order.
 * - `history-then-stream` — yields one history batch containing all
 *   but the last `streamTail` bars, then a `close` event per
 *   remaining bar. Lets a consumer paint a chart instantly from
 *   the warm-up batch and still receive per-bar ticks afterwards.
 *
 * @since 0.5
 * @stable
 * @example
 *     const m: MockCandleSourceMode = "history-then-stream";
 */
export type MockCandleSourceMode = "history" | "stream" | "history-then-stream";

/**
 * Options accepted by {@link mockCandleSource}. `interval` mirrors the
 * `Bar.interval` field; `mode` defaults to `"history"`. `streamTail`
 * applies only when `mode === "history-then-stream"` and defaults to
 * `1` — the smallest non-zero value, leaving a single tail bar to
 * stream after the warm-up batch. `streamTail` is clamped to
 * `[0, bars.length]`.
 *
 * `symbol` drives the secondary-stream wire: when set, every emitted event
 * is tagged with `streamKey: feedKey(symbol, interval)` so the mock can
 * drive a different-symbol scenario through the standard wire. Omit it for
 * the main stream — events then carry no `streamKey`, byte-identical to the
 * single-symbol baseline.
 *
 * @since 0.5
 * @stable
 * @example
 *     const o: MockCandleSourceOpts = {
 *         interval: "1D",
 *         mode: "history-then-stream",
 *         streamTail: 20,
 *         symbol: "AMEX:SPY",
 *     };
 */
export type MockCandleSourceOpts = {
    readonly interval: string;
    readonly mode?: MockCandleSourceMode;
    readonly streamTail?: number;
    readonly symbol?: string;
};

const DEFAULT_STREAM_TAIL = 1;

/**
 * Wrap a static `Bar[]` array in an `AsyncIterable<CandleEvent>` the
 * runtime + conformance tests can drive directly.
 *
 * - `"history"` (default) — yields exactly one
 *   `{ kind: "history", bars }` event.
 * - `"stream"` — yields one `{ kind: "close", bar }` per bar in array
 *   order.
 * - `"history-then-stream"` — yields a single
 *   `{ kind: "history", bars }` event for all but the trailing
 *   `streamTail` bars (default `1`), then one `{ kind: "close", bar }`
 *   per remaining bar. With `streamTail` clamped to `[0, bars.length]`,
 *   `streamTail === 0` degenerates to a pure history batch and
 *   `streamTail >= bars.length` yields an empty history batch followed
 *   by a close-per-bar.
 *
 * A `symbol` opt tags every event with `streamKey: feedKey(symbol, interval)`
 * so the mock can drive a different-symbol secondary stream. Omitting it
 * leaves events untagged (main stream), byte-identical to the baseline.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *
 *     const source = mockCandleSource([], { interval: "1D" });
 *     for await (const e of source) {
 *         void e;
 *     }
 */
export function mockCandleSource(
    bars: ReadonlyArray<Bar>,
    opts: MockCandleSourceOpts = { interval: "1D" },
): AsyncIterable<CandleEvent> {
    const mode: MockCandleSourceMode = opts.mode ?? "history";
    const streamTail = clampTail(opts.streamTail ?? DEFAULT_STREAM_TAIL, bars.length);
    // Only a present symbol widens the wire to a secondary stream; an omitted
    // symbol leaves `streamKey` off so the main-stream output stays
    // byte-identical to the single-symbol baseline.
    const tag: { readonly streamKey?: string } =
        opts.symbol === undefined ? {} : { streamKey: feedKey(opts.symbol, opts.interval) };
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
            if (mode === "history") {
                yield { kind: "history", bars, ...tag };
                return;
            }
            if (mode === "stream") {
                for (const bar of bars) {
                    yield { kind: "close", bar, ...tag };
                }
                return;
            }
            // history-then-stream
            const splitAt = bars.length - streamTail;
            yield { kind: "history", bars: bars.slice(0, splitAt), ...tag };
            for (let i = splitAt; i < bars.length; i += 1) {
                yield { kind: "close", bar: bars[i], ...tag };
            }
        },
    };
}

function clampTail(value: number, total: number): number {
    if (!Number.isFinite(value) || value < 0) return 0;
    if (value > total) return total;
    return Math.floor(value);
}
