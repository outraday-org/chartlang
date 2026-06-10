// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createStreamState } from "../streamState.js";
import { harnessWithCtx } from "./__fixtures__/runPrimitive.js";
import { syntheticBars } from "./__fixtures__/syntheticBars.js";
import { ema } from "./ema.js";
import { isTaSlotSnapshotKey, restoreTaSlots, serialiseTaSlots } from "./persistence.js";
import { rsi } from "./rsi.js";
import { sma } from "./sma.js";

function buffer(values: ReadonlyArray<number | null> = [1, 2, 3]) {
    return {
        headIndex: values.length - 1,
        filled: values.length,
        values,
    };
}

function emptyBuffer() {
    return {
        headIndex: -1,
        filled: 0,
        values: [null, null],
    };
}

describe("ta persistence", () => {
    it("round-trips ta.sma, ta.ema, and ta.rsi slot state", () => {
        const bars = syntheticBars(40, 13);
        const { ctxRef } = harnessWithCtx(bars, 64, (bar) => {
            sma("sma-slot", bar.close, 8);
            ema("ema-slot", bar.close, 13);
            rsi("rsi-slot", bar.close, 14);
        });

        const snapshot = serialiseTaSlots(ctxRef.ctx.stream);
        expect(Object.keys(snapshot).sort()).toEqual(["ta:ema-slot", "ta:rsi-slot", "ta:sma-slot"]);

        const restored = createStreamState({ interval: "1m", capacity: 64, symbol: "TEST" });
        restoreTaSlots(restored, snapshot);

        expect(serialiseTaSlots(restored)).toEqual(snapshot);
    });

    it("preserves NaN scalar fields as JSON-clean null values", () => {
        const bars = syntheticBars(5, 3);
        const { ctxRef } = harnessWithCtx(bars, 16, (bar) => {
            ema("ema-slot", bar.close, 13);
            rsi("rsi-slot", bar.close, 14);
        });

        const snapshot = serialiseTaSlots(ctxRef.ctx.stream);
        expect(snapshot["ta:ema-slot"]).toMatchObject({
            kind: "ta.ema",
            prevEma: null,
            prevClosedEma: null,
        });
        expect(snapshot["ta:rsi-slot"]).toMatchObject({
            kind: "ta.rsi",
            avgGain: null,
            avgLoss: null,
        });

        const restored = createStreamState({ interval: "1m", capacity: 16, symbol: "TEST" });
        restoreTaSlots(restored, snapshot);
        expect(serialiseTaSlots(restored)).toEqual(snapshot);
    });

    it("ignores unsupported and malformed ta slot entries", () => {
        const stream = createStreamState({ interval: "1m", capacity: 8, symbol: "TEST" });
        stream.taSlots.set("not-record", 1);
        stream.taSlots.set("unsupported", { kind: "ta.unsupported", value: 1 });
        expect(serialiseTaSlots(stream)).toEqual({});

        restoreTaSlots(stream, {
            "state-slot": { committed: 1, tentative: 1 },
            "ta:malformed": { kind: "ta.sma", length: 3 },
        });
        expect(stream.taSlots.size).toBe(0);
    });

    it("ignores malformed serialise candidates for supported kinds", () => {
        const stream = createStreamState({ interval: "1m", capacity: 8, symbol: "TEST" });
        const candidates = [
            { kind: "ta.sma", sum: 0 },
            { kind: "ta.sma", length: 3 },
            { kind: "ta.sma", length: 3, sum: 0, outBuffer: {}, window: {} },
            { kind: "ta.ema", length: 3 },
            { kind: "ta.ema", alpha: 0.5 },
            { kind: "ta.ema", alpha: 0.5, length: 3, seedSum: 0 },
            { kind: "ta.ema", alpha: 0.5, length: 3, seedSum: 0, seedCount: 1 },
            {
                kind: "ta.ema",
                alpha: 0.5,
                length: 3,
                seedSum: 0,
                seedCount: 1,
                prevEma: Number.NaN,
            },
            { kind: "ta.rsi", length: 14 },
            { kind: "ta.rsi", length: 14, seedGainSum: 0 },
            { kind: "ta.rsi", length: 14, seedGainSum: 0, seedLossSum: 0 },
            { kind: "ta.rsi", length: 14, seedGainSum: 0, seedLossSum: 0, diffCount: 1 },
            {
                kind: "ta.rsi",
                length: 14,
                seedGainSum: 0,
                seedLossSum: 0,
                diffCount: 1,
                avgGain: Number.NaN,
            },
            {
                kind: "ta.rsi",
                length: 14,
                seedGainSum: 0,
                seedLossSum: 0,
                diffCount: 1,
                avgGain: Number.NaN,
                avgLoss: Number.NaN,
            },
            {
                kind: "ta.rsi",
                length: 14,
                seedGainSum: 0,
                seedLossSum: 0,
                diffCount: 1,
                avgGain: Number.NaN,
                avgLoss: Number.NaN,
                prevSrc: 100,
            },
        ];
        for (const [index, candidate] of candidates.entries()) {
            stream.taSlots.set(`candidate-${index}`, candidate);
        }

        expect(serialiseTaSlots(stream)).toEqual({});
    });

    it("ignores malformed restore candidates for supported kinds", () => {
        const stream = createStreamState({ interval: "1m", capacity: 8, symbol: "TEST" });
        const candidates = [
            1,
            { kind: "ta.unsupported" },
            { kind: "ta.sma" },
            { kind: "ta.sma", length: 3, outBuffer: 1, window: buffer(), sum: 0 },
            { kind: "ta.sma", length: 3, outBuffer: { headIndex: 0 }, window: buffer(), sum: 0 },
            {
                kind: "ta.sma",
                length: 3,
                outBuffer: { headIndex: 0, filled: 1 },
                window: buffer(),
                sum: 0,
            },
            {
                kind: "ta.sma",
                length: 3,
                outBuffer: { headIndex: 0, filled: 1, values: [Number.POSITIVE_INFINITY] },
                window: buffer(),
                sum: 0,
            },
            { kind: "ta.sma", length: 3, outBuffer: buffer(), window: buffer(), sum: "x" },
            {
                kind: "ta.sma",
                length: 3,
                outBuffer: { headIndex: -1, filled: 1, values: [1] },
                window: buffer(),
                sum: 0,
            },
            {
                kind: "ta.sma",
                length: 3,
                outBuffer: buffer(),
                window: { headIndex: -1, filled: 1, values: [1, 2, 3] },
                sum: 0,
            },
            { kind: "ta.ema" },
            {
                kind: "ta.ema",
                length: 13,
                seedCount: 1,
                outBuffer: buffer(),
                alpha: "x",
                seedSum: 0,
                prevEma: null,
                prevClosedEma: null,
            },
            {
                kind: "ta.ema",
                length: 13,
                seedCount: 1,
                outBuffer: { headIndex: -1, filled: 1, values: [1] },
                alpha: 2 / 14,
                seedSum: 0,
                prevEma: null,
                prevClosedEma: null,
            },
            { kind: "ta.rsi" },
            {
                kind: "ta.rsi",
                length: 14,
                diffCount: 1,
                outBuffer: buffer(),
                seedGainSum: 0,
                seedLossSum: 0,
                avgGain: null,
                avgLoss: null,
                prevSrc: 100,
                prevClosedSrc: "x",
            },
            {
                kind: "ta.rsi",
                length: 14,
                diffCount: 1,
                outBuffer: { headIndex: -1, filled: 1, values: [1] },
                seedGainSum: 0,
                seedLossSum: 0,
                avgGain: null,
                avgLoss: null,
                prevSrc: 100,
                prevClosedSrc: 99,
            },
        ];

        restoreTaSlots(
            stream,
            Object.fromEntries(
                candidates.map((candidate, index) => [`ta:candidate-${index}`, candidate]),
            ),
        );
        expect(stream.taSlots.size).toBe(0);

        restoreTaSlots(stream, {
            "ta:empty": {
                kind: "ta.ema",
                length: 13,
                seedCount: 0,
                outBuffer: emptyBuffer(),
                alpha: 2 / 14,
                seedSum: 0,
                prevEma: null,
                prevClosedEma: null,
            },
        });
        expect(serialiseTaSlots(stream)).toMatchObject({
            "ta:empty": { kind: "ta.ema" },
        });
    });

    it("recognises only the namespaced snapshot keys", () => {
        expect(isTaSlotSnapshotKey("ta:slot")).toBe(true);
        expect(isTaSlotSnapshotKey("slot:ta")).toBe(false);
    });
});
