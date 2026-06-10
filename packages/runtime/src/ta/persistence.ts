// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue, Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "../ringBuffer";
import { makeSeriesView } from "../seriesView";
import type { StreamState } from "../streamState";

const TA_SLOT_PREFIX = "ta:";

type BufferSnapshot = Readonly<{
    headIndex: number;
    filled: number;
    values: ReadonlyArray<number | null>;
}>;

type RestoredBaseSlot = {
    readonly outBuffer: Float64RingBuffer;
    readonly series: Series<number>;
    readonly shiftedViews: Map<number, Series<number>>;
};

type RestoredSmaSlot = RestoredBaseSlot & {
    readonly kind: "ta.sma";
    readonly length: number;
    readonly window: Float64RingBuffer;
    sum: number;
};

type RestoredEmaSlot = RestoredBaseSlot & {
    readonly kind: "ta.ema";
    readonly alpha: number;
    readonly length: number;
    seedSum: number;
    seedCount: number;
    prevEma: number;
    prevClosedEma: number;
};

type RestoredRsiSlot = RestoredBaseSlot & {
    readonly kind: "ta.rsi";
    readonly length: number;
    seedGainSum: number;
    seedLossSum: number;
    diffCount: number;
    avgGain: number;
    avgLoss: number;
    prevSrc: number;
    prevClosedSrc: number;
};

type RestoredTaSlot = RestoredSmaSlot | RestoredEmaSlot | RestoredRsiSlot;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOrNull(value: number): number | null {
    return Number.isFinite(value) ? value : null;
}

function restoreNumber(value: unknown): number | null {
    if (value === null) return Number.NaN;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Restore a record of named numeric fields, returning `null` if any one
 * field fails {@link restoreNumber}. Lets restore functions read several
 * persisted numbers in one all-or-nothing step instead of an OR-chain of
 * per-field null checks.
 *
 * @internal
 */
function restoreNumbers<K extends string>(
    fields: Readonly<Record<K, unknown>>,
): Record<K, number> | null {
    const out = {} as Record<K, number>;
    for (const key of Object.keys(fields) as K[]) {
        const restored = restoreNumber(fields[key]);
        if (restored === null) return null;
        out[key] = restored;
    }
    return out;
}

function isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
}

function isBufferSnapshot(value: unknown): value is BufferSnapshot {
    if (!isRecord(value)) return false;
    if (!isInteger(value.headIndex) || !isInteger(value.filled)) return false;
    return (
        Array.isArray(value.values) &&
        value.values.every(
            (entry) => entry === null || (typeof entry === "number" && Number.isFinite(entry)),
        )
    );
}

function serialiseBuffer(buffer: Float64RingBuffer): JsonValue {
    const snapshot = buffer.serialiseSnapshotBuffer();
    return {
        headIndex: snapshot.headIndex,
        filled: snapshot.filled,
        values: snapshot.values,
    };
}

function restoreBuffer(snapshot: BufferSnapshot, capacity: number): Float64RingBuffer | null {
    const buffer = new Float64RingBuffer(capacity);
    try {
        buffer.restoreFromSnapshotBuffer(snapshot);
        return buffer;
    } catch {
        return null;
    }
}

function baseSlot(outBuffer: Float64RingBuffer): RestoredBaseSlot {
    return {
        outBuffer,
        series: makeSeriesView<number>(outBuffer),
        shiftedViews: new Map<number, Series<number>>(),
    };
}

function isFloat64RingBuffer(value: unknown): value is Float64RingBuffer {
    return value instanceof Float64RingBuffer;
}

function serialiseSma(slot: Readonly<Record<string, unknown>>): JsonValue | null {
    if (
        slot.kind !== "ta.sma" ||
        typeof slot.length !== "number" ||
        typeof slot.sum !== "number" ||
        !isFloat64RingBuffer(slot.outBuffer) ||
        !isFloat64RingBuffer(slot.window)
    ) {
        return null;
    }
    return {
        kind: "ta.sma",
        length: slot.length,
        outBuffer: serialiseBuffer(slot.outBuffer),
        window: serialiseBuffer(slot.window),
        sum: finiteOrNull(slot.sum),
    };
}

function serialiseEma(slot: Readonly<Record<string, unknown>>): JsonValue | null {
    if (
        slot.kind !== "ta.ema" ||
        typeof slot.alpha !== "number" ||
        typeof slot.length !== "number" ||
        typeof slot.seedSum !== "number" ||
        typeof slot.seedCount !== "number" ||
        typeof slot.prevEma !== "number" ||
        typeof slot.prevClosedEma !== "number" ||
        !isFloat64RingBuffer(slot.outBuffer)
    ) {
        return null;
    }
    return {
        kind: "ta.ema",
        alpha: finiteOrNull(slot.alpha),
        length: slot.length,
        outBuffer: serialiseBuffer(slot.outBuffer),
        seedSum: finiteOrNull(slot.seedSum),
        seedCount: slot.seedCount,
        prevEma: finiteOrNull(slot.prevEma),
        prevClosedEma: finiteOrNull(slot.prevClosedEma),
    };
}

function serialiseRsi(slot: Readonly<Record<string, unknown>>): JsonValue | null {
    if (
        slot.kind !== "ta.rsi" ||
        typeof slot.length !== "number" ||
        typeof slot.seedGainSum !== "number" ||
        typeof slot.seedLossSum !== "number" ||
        typeof slot.diffCount !== "number" ||
        typeof slot.avgGain !== "number" ||
        typeof slot.avgLoss !== "number" ||
        typeof slot.prevSrc !== "number" ||
        typeof slot.prevClosedSrc !== "number" ||
        !isFloat64RingBuffer(slot.outBuffer)
    ) {
        return null;
    }
    return {
        kind: "ta.rsi",
        length: slot.length,
        outBuffer: serialiseBuffer(slot.outBuffer),
        seedGainSum: finiteOrNull(slot.seedGainSum),
        seedLossSum: finiteOrNull(slot.seedLossSum),
        diffCount: slot.diffCount,
        avgGain: finiteOrNull(slot.avgGain),
        avgLoss: finiteOrNull(slot.avgLoss),
        prevSrc: finiteOrNull(slot.prevSrc),
        prevClosedSrc: finiteOrNull(slot.prevClosedSrc),
    };
}

function restoreSma(snapshot: Readonly<Record<string, unknown>>): RestoredSmaSlot | null {
    const outSnapshot = snapshot.outBuffer;
    const windowSnapshot = snapshot.window;
    if (
        snapshot.kind !== "ta.sma" ||
        !isInteger(snapshot.length) ||
        !isBufferSnapshot(outSnapshot) ||
        !isBufferSnapshot(windowSnapshot)
    ) {
        return null;
    }
    const sum = restoreNumber(snapshot.sum);
    if (sum === null) return null;
    const outBuffer = restoreBuffer(outSnapshot, outSnapshot.values.length);
    const window = restoreBuffer(windowSnapshot, snapshot.length);
    if (outBuffer === null || window === null) return null;
    return {
        kind: "ta.sma",
        ...baseSlot(outBuffer),
        length: snapshot.length,
        window,
        sum,
    };
}

function restoreEma(snapshot: Readonly<Record<string, unknown>>): RestoredEmaSlot | null {
    const outSnapshot = snapshot.outBuffer;
    if (
        snapshot.kind !== "ta.ema" ||
        !isInteger(snapshot.length) ||
        !isInteger(snapshot.seedCount) ||
        !isBufferSnapshot(outSnapshot)
    ) {
        return null;
    }
    const numbers = restoreNumbers({
        alpha: snapshot.alpha,
        seedSum: snapshot.seedSum,
        prevEma: snapshot.prevEma,
        prevClosedEma: snapshot.prevClosedEma,
    });
    if (numbers === null) return null;
    const outBuffer = restoreBuffer(outSnapshot, outSnapshot.values.length);
    if (outBuffer === null) return null;
    return {
        kind: "ta.ema",
        ...baseSlot(outBuffer),
        alpha: numbers.alpha,
        length: snapshot.length,
        seedSum: numbers.seedSum,
        seedCount: snapshot.seedCount,
        prevEma: numbers.prevEma,
        prevClosedEma: numbers.prevClosedEma,
    };
}

function restoreRsi(snapshot: Readonly<Record<string, unknown>>): RestoredRsiSlot | null {
    const outSnapshot = snapshot.outBuffer;
    if (
        snapshot.kind !== "ta.rsi" ||
        !isInteger(snapshot.length) ||
        !isInteger(snapshot.diffCount) ||
        !isBufferSnapshot(outSnapshot)
    ) {
        return null;
    }
    const numbers = restoreNumbers({
        seedGainSum: snapshot.seedGainSum,
        seedLossSum: snapshot.seedLossSum,
        avgGain: snapshot.avgGain,
        avgLoss: snapshot.avgLoss,
        prevSrc: snapshot.prevSrc,
        prevClosedSrc: snapshot.prevClosedSrc,
    });
    if (numbers === null) return null;
    const outBuffer = restoreBuffer(outSnapshot, outSnapshot.values.length);
    if (outBuffer === null) return null;
    return {
        kind: "ta.rsi",
        ...baseSlot(outBuffer),
        length: snapshot.length,
        seedGainSum: numbers.seedGainSum,
        seedLossSum: numbers.seedLossSum,
        diffCount: snapshot.diffCount,
        avgGain: numbers.avgGain,
        avgLoss: numbers.avgLoss,
        prevSrc: numbers.prevSrc,
        prevClosedSrc: numbers.prevClosedSrc,
    };
}

function serialiseTaSlot(slot: unknown): JsonValue | null {
    if (!isRecord(slot)) return null;
    if (slot.kind === "ta.sma") return serialiseSma(slot);
    if (slot.kind === "ta.ema") return serialiseEma(slot);
    if (slot.kind === "ta.rsi") return serialiseRsi(slot);
    return null;
}

function restoreTaSlot(snapshot: unknown): RestoredTaSlot | null {
    if (!isRecord(snapshot)) return null;
    if (snapshot.kind === "ta.sma") return restoreSma(snapshot);
    if (snapshot.kind === "ta.ema") return restoreEma(snapshot);
    if (snapshot.kind === "ta.rsi") return restoreRsi(snapshot);
    return null;
}

/**
 * Return whether a snapshot slot key belongs to the TA persistence namespace.
 *
 * @since 0.5
 * @internal
 * @experimental
 * @formula  key.startsWith("ta:")
 * @example
 *     isTaSlotSnapshotKey("ta:slot#0"); // true
 */
export function isTaSlotSnapshotKey(key: string): boolean {
    return key.startsWith(TA_SLOT_PREFIX);
}

/**
 * Serialise supported `ta.*` runtime slots into JSON-clean snapshot entries.
 *
 * @since 0.5
 * @internal
 * @experimental
 * @formula  snapshot[`ta:${slotId}`] = serialise(slot) for supported TA slots
 * @example
 *     // const entries = serialiseTaSlots(stream);
 *     const entries = {};
 *     void entries;
 */
export function serialiseTaSlots(stream: StreamState): Readonly<Record<string, JsonValue>> {
    const out: Record<string, JsonValue> = {};
    for (const [slotId, slot] of stream.taSlots.entries()) {
        const snapshot = serialiseTaSlot(slot);
        if (snapshot !== null) {
            out[`${TA_SLOT_PREFIX}${slotId}`] = snapshot;
        }
    }
    return Object.freeze(out);
}

/**
 * Restore supported `ta.*` runtime slots from namespaced snapshot entries.
 *
 * @since 0.5
 * @internal
 * @experimental
 * @formula  stream.taSlots[slotId] = restore(snapshot[`ta:${slotId}`])
 * @example
 *     // restoreTaSlots(stream, snapshot.slots);
 *     const restored = true;
 *     void restored;
 */
export function restoreTaSlots(
    stream: StreamState,
    slots: Readonly<Record<string, unknown>>,
): void {
    stream.taSlots.clear();
    for (const [key, value] of Object.entries(slots)) {
        if (!isTaSlotSnapshotKey(key)) continue;
        const slot = restoreTaSlot(value);
        if (slot !== null) {
            stream.taSlots.set(key.slice(TA_SLOT_PREFIX.length), slot);
        }
    }
}
