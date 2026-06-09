// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { validateSnapshot } from "./persistentStateStore.validate";

const wellFormed = {
    lastBarTime: 1_700_000_000_000,
    streams: {
        "1m": {
            interval: "1m",
            headIndex: 0,
            filled: 1,
            buffers: {
                time: [1_700_000_000_000],
                open: [100],
                high: [101],
                low: [99],
                close: [100.5],
                volume: [1_000],
            },
        },
    },
    slots: {
        "counter:state": { committed: 1, tentative: 1 },
    },
    savedAt: 1_700_000_060_000,
    snapshotVersion: 1,
};

describe("validateSnapshot", () => {
    it("accepts a well-formed snapshot", () => {
        expect(validateSnapshot(wellFormed)).toBe(true);
    });

    it("accepts every JsonValue slot shape", () => {
        expect(
            validateSnapshot({
                ...wellFormed,
                slots: {
                    nil: null,
                    text: "ok",
                    bool: true,
                    number: 1,
                    array: [null, "ok", false, 2],
                    object: { nested: ["ok"] },
                },
            }),
        ).toBe(true);
    });

    it("rejects unsupported snapshot versions", () => {
        expect(validateSnapshot({ ...wellFormed, snapshotVersion: 0 })).toBe(false);
        expect(validateSnapshot({ ...wellFormed, snapshotVersion: 2 })).toBe(false);
    });

    it("rejects non-record snapshots", () => {
        expect(validateSnapshot(null)).toBe(false);
        expect(validateSnapshot([])).toBe(false);
    });

    it("rejects missing lastBarTime", () => {
        const { lastBarTime: _lastBarTime, ...missing } = wellFormed;
        expect(validateSnapshot(missing)).toBe(false);
    });

    it("rejects non-finite snapshot times", () => {
        expect(validateSnapshot({ ...wellFormed, lastBarTime: Number.POSITIVE_INFINITY })).toBe(
            false,
        );
        expect(validateSnapshot({ ...wellFormed, savedAt: Number.NaN })).toBe(false);
    });

    it("rejects non-record streams and slots", () => {
        expect(validateSnapshot({ ...wellFormed, streams: [] })).toBe(false);
        expect(validateSnapshot({ ...wellFormed, slots: [] })).toBe(false);
    });

    it("rejects malformed stream metadata", () => {
        expect(validateSnapshot({ ...wellFormed, streams: { "1m": null } })).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormed,
                streams: { "1m": { ...wellFormed.streams["1m"], interval: 1 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormed,
                streams: { "1m": { ...wellFormed.streams["1m"], headIndex: 0.5 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormed,
                streams: { "1m": { ...wellFormed.streams["1m"], filled: 0.5 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormed,
                streams: { "1m": { ...wellFormed.streams["1m"], buffers: null } },
            }),
        ).toBe(false);
    });

    it("rejects non-array stream buffers", () => {
        expect(
            validateSnapshot({
                ...wellFormed,
                streams: {
                    "1m": {
                        ...wellFormed.streams["1m"],
                        buffers: { ...wellFormed.streams["1m"].buffers, close: 100.5 },
                    },
                },
            }),
        ).toBe(false);
    });

    it("rejects non-number stream buffer entries", () => {
        expect(
            validateSnapshot({
                ...wellFormed,
                streams: {
                    "1m": {
                        ...wellFormed.streams["1m"],
                        buffers: { ...wellFormed.streams["1m"].buffers, close: [() => 1] },
                    },
                },
            }),
        ).toBe(false);
    });

    it("rejects non-JsonValue slot payloads", () => {
        expect(
            validateSnapshot({
                ...wellFormed,
                slots: { bad: () => 1 },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormed,
                slots: { bad: Number.POSITIVE_INFINITY },
            }),
        ).toBe(false);
    });
});
