// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { validateSnapshot } from "./persistentStateStore.validate.js";

const wellFormedFlat = {
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

const wellFormedStructured = {
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
    savedAt: 1_700_000_060_000,
    snapshotVersion: 1,
    primary: {
        slots: { "counter:state": { committed: 1, tentative: 1 } },
    },
    siblings: {
        slow: { slots: { "export:slow/x:state": { committed: 1, tentative: 1 } } },
    },
    dependencies: {
        fast: { slots: { "dep:fast/x:state": { committed: 2, tentative: 2 } } },
    },
};

describe("validateSnapshot", () => {
    it("accepts a well-formed flat snapshot", () => {
        expect(validateSnapshot(wellFormedFlat)).toBe(true);
    });

    it("accepts a well-formed structured snapshot", () => {
        expect(validateSnapshot(wellFormedStructured)).toBe(true);
    });

    it("accepts a structured snapshot with primary only", () => {
        const {
            siblings: _siblings,
            dependencies: _dependencies,
            ...primaryOnly
        } = wellFormedStructured;
        expect(validateSnapshot(primaryOnly)).toBe(true);
    });

    it("accepts every JsonValue slot shape in primary", () => {
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                primary: {
                    slots: {
                        nil: null,
                        text: "ok",
                        bool: true,
                        number: 1,
                        array: [null, "ok", false, 2],
                        object: { nested: ["ok"] },
                    },
                },
            }),
        ).toBe(true);
    });

    it("accepts every JsonValue slot shape in legacy flat slots", () => {
        expect(
            validateSnapshot({
                ...wellFormedFlat,
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
        expect(validateSnapshot({ ...wellFormedStructured, snapshotVersion: 0 })).toBe(false);
        expect(validateSnapshot({ ...wellFormedStructured, snapshotVersion: 2 })).toBe(false);
    });

    it("rejects non-record snapshots", () => {
        expect(validateSnapshot(null)).toBe(false);
        expect(validateSnapshot([])).toBe(false);
    });

    it("rejects missing lastBarTime", () => {
        const { lastBarTime: _lastBarTime, ...missing } = wellFormedStructured;
        expect(validateSnapshot(missing)).toBe(false);
    });

    it("rejects non-finite snapshot times", () => {
        expect(
            validateSnapshot({ ...wellFormedStructured, lastBarTime: Number.POSITIVE_INFINITY }),
        ).toBe(false);
        expect(validateSnapshot({ ...wellFormedStructured, savedAt: Number.NaN })).toBe(false);
    });

    it("rejects non-record streams and structured runner fields", () => {
        expect(validateSnapshot({ ...wellFormedStructured, streams: [] })).toBe(false);
        expect(validateSnapshot({ ...wellFormedStructured, primary: [] })).toBe(false);
        expect(validateSnapshot({ ...wellFormedStructured, siblings: [] })).toBe(false);
        expect(validateSnapshot({ ...wellFormedStructured, dependencies: [] })).toBe(false);
    });

    it("rejects non-record legacy slots", () => {
        expect(validateSnapshot({ ...wellFormedFlat, slots: [] })).toBe(false);
    });

    it("rejects malformed stream metadata", () => {
        expect(validateSnapshot({ ...wellFormedStructured, streams: { "1m": null } })).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                streams: { "1m": { ...wellFormedStructured.streams["1m"], interval: 1 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                streams: { "1m": { ...wellFormedStructured.streams["1m"], headIndex: 0.5 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                streams: { "1m": { ...wellFormedStructured.streams["1m"], filled: 0.5 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                streams: { "1m": { ...wellFormedStructured.streams["1m"], buffers: null } },
            }),
        ).toBe(false);
    });

    it("rejects non-array stream buffers", () => {
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                streams: {
                    "1m": {
                        ...wellFormedStructured.streams["1m"],
                        buffers: { ...wellFormedStructured.streams["1m"].buffers, close: 100.5 },
                    },
                },
            }),
        ).toBe(false);
    });

    it("rejects non-number stream buffer entries", () => {
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                streams: {
                    "1m": {
                        ...wellFormedStructured.streams["1m"],
                        buffers: {
                            ...wellFormedStructured.streams["1m"].buffers,
                            close: [() => 1],
                        },
                    },
                },
            }),
        ).toBe(false);
    });

    it("rejects non-JsonValue slot payloads in primary", () => {
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                primary: { slots: { bad: () => 1 } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                primary: { slots: { bad: Number.POSITIVE_INFINITY } },
            }),
        ).toBe(false);
    });

    it("rejects non-JsonValue slot payloads in legacy flat slots", () => {
        expect(validateSnapshot({ ...wellFormedFlat, slots: { bad: () => 1 } })).toBe(false);
    });

    it("rejects malformed siblings / dependencies sections", () => {
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                siblings: { slow: null },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                dependencies: { fast: { slots: null } },
            }),
        ).toBe(false);
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                siblings: { slow: { slots: { bad: () => 1 } } },
            }),
        ).toBe(false);
    });

    it("rejects a primary missing its slots map", () => {
        expect(
            validateSnapshot({
                ...wellFormedStructured,
                primary: { slots: null },
            }),
        ).toBe(false);
    });
});
