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
 * Return true when `value` is shaped like one public external-series feed
 * (`{ values: unknown[] }`). Individual values are deliberately NOT
 * type-checked here — every consumer coerces entries to finite-or-`NaN`
 * ({@link replaceExternalSeriesFeedMap} on replacement, `valueAt` on read), so
 * a single `null` / `undefined` / `NaN` entry (e.g. QuickJS `JSON.stringify`
 * serialising `NaN` → `null`) degrades to a runtime `NaN` at that one index
 * instead of rejecting the whole feed.
 *
 * @since 1.9
 * @stable
 * @example
 *     isExternalSeriesFeed({ values: [1, 2] }); // true
 */
export function isExternalSeriesFeed(value: unknown): value is ExternalSeriesFeedMap[string] {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    return "values" in value && Array.isArray(value.values);
}

/**
 * Return true when `value` has the public external feed map shape. Per
 * {@link isExternalSeriesFeed}, feed values are sanitised later (per
 * replacement / per bar read) so `null` / `NaN` / `Infinity` entries degrade
 * to runtime `NaN` instead of rejecting the entire feed.
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
 * Validate and freeze a whole external feed map replacement. The replacement
 * is tolerant PER ENTRY, matching the {@link isExternalSeriesFeed} shape
 * contract: any array-shaped feed is kept and each of its values is coerced to
 * a finite number or `NaN` (`null` / `undefined` / `NaN` / `±Infinity` →
 * `NaN`). A single non-numeric value therefore degrades to a runtime `NaN` at
 * that one index instead of discarding the ENTIRE map. This is load-bearing on
 * the QuickJS host path, where `stringifyFrame`'s `JSON.stringify` serialises
 * `NaN` → `null`: the old all-or-nothing guard turned one such value into every
 * bar reading `NaN` (nothing renders). A top-level non-object still degrades to
 * an empty map; callers decide whether to emit diagnostics.
 *
 * @since 1.9
 * @stable
 * @example
 *     const feeds = replaceExternalSeriesFeedMap({ earnings: { values: [1] } });
 *     void feeds;
 */
export function replaceExternalSeriesFeedMap(value: unknown): ExternalSeriesFeedMap {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return Object.freeze({});
    }
    const out: Record<string, { readonly values: ReadonlyArray<number> }> = {};
    for (const [key, feed] of Object.entries(value)) {
        if (!isExternalSeriesFeed(feed)) continue;
        const values = feed.values.map((entry: unknown) =>
            typeof entry === "number" && Number.isFinite(entry) ? entry : Number.NaN,
        );
        out[key] = Object.freeze({ values: Object.freeze(values) });
    }
    return Object.freeze(out);
}
