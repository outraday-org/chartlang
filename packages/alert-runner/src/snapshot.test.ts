// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { ScriptManifest, StateStoreKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { buildStateStoreKey, canonicalJson, matchSnapshot, sha256Hex } from "./snapshot.js";

const KEY: StateStoreKey = {
    scriptHash: "s",
    compilerVersion: "1.16.0",
    apiVersion: 1,
    capabilitiesHash: "c",
    symbol: "AAPL",
    mainInterval: "1h",
    requestedIntervals: ["1D"],
};

const ENVELOPE = {
    format: "chartlang-alert-runner",
    version: 1,
    key: KEY,
    inputsHash: "i",
    lastBarTime: 5,
    secondaryLastBarTimes: { "1D": 4 },
    gate: { lastFiredBarTime: { "alert:a": 5 }, exhausted: false },
    state: { snapshotVersion: 2 },
};

describe("canonicalJson", () => {
    it("sorts keys, drops undefined, and orders sets and maps", () => {
        expect(canonicalJson({ b: 1, a: [new Set(["y", "x"])], c: undefined })).toBe(
            '{"a":[["x","y"]],"b":1}',
        );
        expect(canonicalJson(new Set(["b", "a"]))).toBe('["a","b"]');
        expect(
            canonicalJson(
                new Map([
                    ["z", 1],
                    ["a", 2],
                ]),
            ),
        ).toBe('[["a",2],["z",1]]');
        expect(canonicalJson({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}');
        expect(canonicalJson(undefined)).toBe("null");
        expect(canonicalJson(null)).toBe("null");
    });

    it("makes capability sets visible to the hash", async () => {
        const a = await sha256Hex(canonicalJson({ alerts: new Set(["toast"]) }));
        const b = await sha256Hex(canonicalJson({ alerts: new Set(["webhook"]) }));
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe("buildStateStoreKey", () => {
    const manifest = {
        requestedIntervals: ["1W", "1D"],
        compilerVersion: "1.16.0",
    } as unknown as ScriptManifest;
    const capabilities = { alerts: new Set(["toast"]) } as unknown as Capabilities;

    it("fills every identity field, with sorted intervals", async () => {
        const key = await buildStateStoreKey({
            moduleSource: "abc",
            manifest,
            capabilities,
            symbol: "AAPL",
            interval: "1h",
        });
        expect(key).toEqual({
            scriptHash: await sha256Hex("abc"),
            compilerVersion: "1.16.0",
            apiVersion: 1,
            capabilitiesHash: await sha256Hex(canonicalJson(capabilities)),
            symbol: "AAPL",
            mainInterval: "1h",
            requestedIntervals: ["1D", "1W"],
        });
    });

    it("is null without a compiler version", async () => {
        const { compilerVersion: _drop, ...rest } = manifest;
        expect(
            await buildStateStoreKey({
                moduleSource: "abc",
                manifest: rest as ScriptManifest,
                capabilities,
                symbol: "",
                interval: "1h",
            }),
        ).toBeNull();
    });
});

describe("matchSnapshot", () => {
    it("matches the same identity", () => {
        const match = matchSnapshot(JSON.parse(JSON.stringify(ENVELOPE)), KEY, "i");
        expect(match).toEqual({ status: "match", snapshot: ENVELOPE });
        expect(matchSnapshot({ ...ENVELOPE, lastBarTime: null }, KEY, "i").status).toBe("match");
    });

    it("reports a different key or inputs as key-mismatch", () => {
        expect(matchSnapshot(ENVELOPE, { ...KEY, symbol: "MSFT" }, "i").status).toBe(
            "key-mismatch",
        );
        expect(matchSnapshot(ENVELOPE, KEY, "other").status).toBe("key-mismatch");
    });

    it("reports anything malformed as invalid", () => {
        const bad: ReadonlyArray<unknown> = [
            null,
            [],
            { ...ENVELOPE, format: "other" },
            { ...ENVELOPE, version: 2 },
            { ...ENVELOPE, key: null },
            { ...ENVELOPE, key: { ...KEY, apiVersion: 2 } },
            { ...ENVELOPE, key: { ...KEY, requestedIntervals: [1] } },
            { ...ENVELOPE, key: { ...KEY, requestedIntervals: "1D" } },
            { ...ENVELOPE, key: { ...KEY, scriptHash: 1 } },
            { ...ENVELOPE, inputsHash: 1 },
            { ...ENVELOPE, lastBarTime: Number.NaN },
            { ...ENVELOPE, secondaryLastBarTimes: { "1D": "x" } },
            { ...ENVELOPE, secondaryLastBarTimes: null },
            { ...ENVELOPE, gate: null },
            { ...ENVELOPE, gate: { exhausted: "no", lastFiredBarTime: {} } },
            { ...ENVELOPE, gate: { exhausted: false, lastFiredBarTime: { a: null } } },
            { ...ENVELOPE, state: [] },
        ];
        for (const value of bad) expect(matchSnapshot(value, KEY, "i").status).toBe("invalid");
    });
});
