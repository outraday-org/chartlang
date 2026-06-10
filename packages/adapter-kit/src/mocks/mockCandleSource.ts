// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import type { CandleEvent } from "../types.js";

/**
 * How a {@link mockCandleSource} surfaces the supplied bars: `history`
 * yields one warm-up batch; `stream` yields a `close` event per bar.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m: MockCandleSourceMode = "stream";
 */
export type MockCandleSourceMode = "history" | "stream";

/**
 * Options accepted by {@link mockCandleSource}. `interval` mirrors the
 * `Bar.interval` field; `mode` defaults to `"history"`.
 *
 * @since 0.1
 * @stable
 * @example
 *     const o: MockCandleSourceOpts = { interval: "1D", mode: "stream" };
 */
export type MockCandleSourceOpts = {
    readonly interval: string;
    readonly mode?: MockCandleSourceMode;
};

/**
 * Wrap a static `Bar[]` array in an `AsyncIterable<CandleEvent>` the
 * runtime + conformance tests can drive directly. `history` mode
 * yields exactly one `{ kind: "history", bars }` event; `stream` mode
 * yields one `{ kind: "close", bar }` per bar in array order.
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
    return {
        async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
            if (mode === "history") {
                yield { kind: "history", bars };
                return;
            }
            for (const bar of bars) {
                yield { kind: "close", bar };
            }
        },
    };
}
