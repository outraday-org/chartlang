// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Input for {@link createMultiStreamCandlePump}. Main events are forwarded
 * unchanged; secondary bars are emitted as `close` events tagged with their
 * interval value.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const pump = createMultiStreamCandlePump({
 *         main: mockCandleSource([], { interval: "1m", mode: "stream" }),
 *         secondary: { "1D": [] },
 *     });
 *     void pump;
 */
export type MultiStreamCandlePumpOpts = {
    readonly main: AsyncIterable<CandleEvent>;
    readonly secondary: Readonly<Record<string, ReadonlyArray<Bar>>>;
};

/**
 * Compose a main candle source with interval-keyed secondary candles.
 *
 * The pump keeps main-stream events backwards compatible by leaving
 * `streamKey` absent. Secondary events carry `streamKey = interval` and
 * are yielded before the main event whose timestamp has reached them.
 *
 * A `history` batch is **split and interleaved**: the secondary bars are
 * woven between the history bars so each history bar sees only the
 * secondary candles that closed at or before its own time. Without this,
 * a single monolithic batch would flush every secondary bar up front
 * (gated on the batch's *last* timestamp), so an `request.security`
 * alignment over the batch could only ever see the final secondary bar —
 * leaving the higher-timeframe series all-NaN across the replayed
 * history. Streaming `close` / `tick` events keep the original
 * one-flush-before-the-event behaviour byte-for-byte.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const pump = createMultiStreamCandlePump({
 *         main: mockCandleSource([], { interval: "1m", mode: "stream" }),
 *         secondary: { "1D": [] },
 *     });
 *     for await (const event of pump) {
 *         void event.streamKey;
 *     }
 */
export function createMultiStreamCandlePump(
    opts: MultiStreamCandlePumpOpts,
): AsyncIterable<CandleEvent> {
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
            const secondaryIndexes = new Map<string, number>();
            const secondaryEntries = Object.entries(opts.secondary);

            // Yield every not-yet-emitted secondary bar whose time is at or
            // before `upTo`, advancing each stream's cursor. Per-stream
            // order matches the original (entry order, no global merge).
            function* drainSecondary(upTo: number): Generator<CandleEvent> {
                for (const [streamKey, bars] of secondaryEntries) {
                    let index = secondaryIndexes.get(streamKey) ?? 0;
                    while (index < bars.length) {
                        const bar = bars[index];
                        if (bar === undefined || bar.time > upTo) break;
                        yield { kind: "close", bar, streamKey };
                        index += 1;
                    }
                    secondaryIndexes.set(streamKey, index);
                }
            }

            function secondaryDueAtOrBefore(upTo: number): boolean {
                for (const [streamKey, bars] of secondaryEntries) {
                    const bar = bars[secondaryIndexes.get(streamKey) ?? 0];
                    if (bar !== undefined && bar.time <= upTo) return true;
                }
                return false;
            }

            for await (const mainEvent of opts.main) {
                if (mainEvent.kind === "history") {
                    if (mainEvent.bars.length === 0) {
                        yield mainEvent;
                        continue;
                    }
                    // Walk the batch, emitting the buffered history chunk and
                    // the due secondary closes before each history bar that a
                    // secondary candle has reached. This mirrors the streaming
                    // path's "secondary <= mainTime, then the main bar" order.
                    let chunk: Bar[] = [];
                    for (const bar of mainEvent.bars) {
                        if (secondaryDueAtOrBefore(bar.time)) {
                            if (chunk.length > 0) {
                                yield { kind: "history", bars: chunk };
                                chunk = [];
                            }
                            yield* drainSecondary(bar.time);
                        }
                        chunk.push(bar);
                    }
                    if (chunk.length > 0) yield { kind: "history", bars: chunk };
                    continue;
                }
                // `history` is handled above; only `close` / `tick` reach
                // here, and both carry a concrete `bar.time`.
                yield* drainSecondary(mainEvent.bar.time);
                yield mainEvent;
            }
        },
    };
}
