// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ExternalSeriesFeedMap, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer.js";
import { makeSeriesView } from "../seriesView.js";

/**
 * Runtime-owned external-series slot keyed by script input key. The `feedName`
 * is the descriptor's public `name`, while `view` is the stable
 * script-facing series returned from `resolveInputs`.
 *
 * @since 1.9
 * @stable
 * @example
 *     // const slot: ExternalSeriesSlot = createExternalSeriesSlots(...).get("feed");
 */
export type ExternalSeriesSlot = {
    readonly inputKey: string;
    readonly feedName: string;
    readonly buffer: Float64RingBuffer;
    readonly view: Series<number>;
};

/**
 * Return true when `value` is one public external-series feed object.
 *
 * @since 1.9
 * @stable
 * @example
 *     isExternalSeriesFeed({ values: [1, 2] }); // true
 */
export function isExternalSeriesFeed(value: unknown): value is ExternalSeriesFeedMap[string] {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    if (!("values" in value) || !Array.isArray(value.values)) return false;
    return value.values.every((entry) => typeof entry === "number");
}

/**
 * Return true when `value` has the public external feed map shape. Numeric
 * values are sanitised later per bar so `NaN` / `Infinity` inputs degrade to
 * runtime `NaN` instead of rejecting the entire feed.
 *
 * @since 1.9
 * @stable
 * @example
 *     isExternalSeriesFeedMap({ earnings: { values: [1, 2] } }); // true
 */
export function isExternalSeriesFeedMap(value: unknown): value is ExternalSeriesFeedMap {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    for (const feed of Object.values(value)) {
        if (!isExternalSeriesFeed(feed)) return false;
    }
    return true;
}

/**
 * Build one stable external-series slot per descriptor. The returned slots
 * start empty, so reads produce `NaN` until the runner advances them with the
 * primary bar cursor.
 *
 * @since 1.9
 * @stable
 * @example
 *     // const slots = createExternalSeriesSlots([{ inputKey, feedName }], 100);
 */
export function createExternalSeriesSlots(
    descriptors: ReadonlyArray<Readonly<{ inputKey: string; feedName: string }>>,
    capacity: number,
): Map<string, ExternalSeriesSlot> {
    const slots = new Map<string, ExternalSeriesSlot>();
    for (const descriptor of descriptors) {
        const buffer = new Float64RingBuffer(capacity);
        slots.set(descriptor.inputKey, {
            inputKey: descriptor.inputKey,
            feedName: descriptor.feedName,
            buffer,
            view: makeSeriesView<number>(buffer),
        });
    }
    return slots;
}

function valueAt(feeds: ExternalSeriesFeedMap, feedName: string, index: number): number {
    const value = feeds[feedName]?.values[index];
    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

/**
 * Advance every external-series slot to `barIndex`. Close/history calls append
 * a new head; tick calls replace the current head so indexing semantics stay
 * aligned with the primary OHLCV buffers.
 *
 * @since 1.9
 * @stable
 * @example
 *     // advanceExternalSeriesFeeds(slots, feeds, 0, false);
 */
export function advanceExternalSeriesFeeds(
    slots: ReadonlyMap<string, ExternalSeriesSlot>,
    feeds: ExternalSeriesFeedMap,
    barIndex: number,
    isTick: boolean,
): void {
    for (const slot of slots.values()) {
        const value = valueAt(feeds, slot.feedName, barIndex);
        if (isTick) {
            slot.buffer.replaceHead(value);
        } else {
            slot.buffer.append(value);
        }
    }
}

/**
 * Validate and freeze a whole external feed map replacement. Invalid runtime
 * values degrade to an empty map; callers decide whether to emit diagnostics.
 *
 * @since 1.9
 * @stable
 * @example
 *     const feeds = replaceExternalSeriesFeedMap({ earnings: { values: [1] } });
 *     void feeds;
 */
export function replaceExternalSeriesFeedMap(value: unknown): ExternalSeriesFeedMap {
    if (!isExternalSeriesFeedMap(value)) return Object.freeze({});
    const out: Record<string, { readonly values: ReadonlyArray<number> }> = {};
    const feeds = value;
    for (const [key, feed] of Object.entries(feeds)) {
        out[key] = Object.freeze({ values: Object.freeze([...feed.values]) });
    }
    return Object.freeze(out);
}
