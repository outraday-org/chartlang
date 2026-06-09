// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { appendBarToStream, replaceStreamHead, type StreamState } from "../streamState";

/**
 * Append a finalised candle to a secondary stream without running compute.
 *
 * @since 0.5
 * @internal
 * @example
 *     // appendSecondaryBar(stream, bar);
 *     const appended = true;
 *     void appended;
 */
export function appendSecondaryBar(stream: StreamState, rawBar: Bar): void {
    appendBarToStream(stream, rawBar);
}

/**
 * Replace the current secondary stream head with an intra-bar update.
 *
 * @since 0.5
 * @internal
 * @example
 *     // replaceSecondaryHead(stream, bar);
 *     const replaced = true;
 *     void replaced;
 */
export function replaceSecondaryHead(stream: StreamState, rawBar: Bar): void {
    replaceStreamHead(stream, rawBar);
}

/**
 * Append a history batch to a secondary stream in source order.
 *
 * @since 0.5
 * @internal
 * @example
 *     // appendSecondaryHistory(stream, []);
 *     const appended = true;
 *     void appended;
 */
export function appendSecondaryHistory(stream: StreamState, bars: ReadonlyArray<Bar>): void {
    for (const bar of bars) {
        appendBarToStream(stream, bar);
    }
}
