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
 * @experimental
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

function eventTime(event: CandleEvent): number | null {
    if (event.kind === "history") {
        const last = event.bars[event.bars.length - 1];
        return last === undefined ? null : last.time;
    }
    return event.bar.time;
}

/**
 * Compose a main candle source with interval-keyed secondary candles.
 *
 * The pump keeps main-stream events backwards compatible by leaving
 * `streamKey` absent. Secondary events carry `streamKey = interval` and
 * are yielded before the main event whose timestamp has reached them.
 *
 * @since 0.5
 * @experimental
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
            for await (const mainEvent of opts.main) {
                const mainTime = eventTime(mainEvent);
                if (mainTime !== null) {
                    for (const [streamKey, bars] of Object.entries(opts.secondary)) {
                        let index = secondaryIndexes.get(streamKey) ?? 0;
                        while (index < bars.length) {
                            const bar = bars[index];
                            if (bar === undefined || bar.time > mainTime) break;
                            yield { kind: "close", bar, streamKey };
                            index += 1;
                        }
                        secondaryIndexes.set(streamKey, index);
                    }
                }
                yield mainEvent;
            }
        },
    };
}
