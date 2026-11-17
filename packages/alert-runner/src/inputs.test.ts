// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { validateAlertInputs } from "./inputs.js";

const MANIFEST = {
    apiVersion: 1,
    kind: "indicator",
    name: "inputs",
    capabilities: ["indicators"],
    requestedIntervals: [],
    userPickableInterval: false,
    seriesCapacities: {},
    maxLookback: 0,
    inputs: {
        len: { kind: "int", defaultValue: 3, min: 1, max: 10 },
        mult: { kind: "float", defaultValue: 2 },
        flag: { kind: "bool", defaultValue: true },
        text: { kind: "string", defaultValue: "a" },
        hue: { kind: "color", defaultValue: "#fff" },
        sym: { kind: "symbol", defaultValue: "AAPL" },
        tf: { kind: "interval", defaultValue: "1D" },
        sess: { kind: "session", defaultValue: "0930-1600" },
        when: { kind: "time", defaultValue: 0 },
        level: { kind: "price", defaultValue: 1 },
        side: { kind: "enum", defaultValue: "a", options: ["a", "b", 3] },
        src: { kind: "source", defaultValue: "close" },
    },
} as unknown as ScriptManifest;

describe("validateAlertInputs", () => {
    it("accepts valid values and omitted keys", () => {
        expect(validateAlertInputs(MANIFEST, {})).toEqual([]);
        expect(
            validateAlertInputs(MANIFEST, {
                len: 10,
                mult: 0.5,
                flag: false,
                text: "b",
                hue: "#000",
                sym: "MSFT",
                tf: "1h",
                sess: "24x7",
                when: 5,
                level: 2.5,
                side: 3,
                src: "hlc3",
                level2: undefined,
            }),
        ).toEqual([]);
        expect(validateAlertInputs(MANIFEST, { len: undefined })).toEqual([]);
    });

    it("reports every mismatch", () => {
        expect(
            validateAlertInputs(MANIFEST, {
                len: 2.5,
                mult: Number.NaN,
                flag: "yes",
                text: 1,
                when: "now",
                side: "c",
                src: "median",
                extra: null,
            }),
        ).toEqual([
            'input "len" expected int, got 2.5',
            'input "mult" expected float, got NaN',
            'input "flag" expected bool, got "yes"',
            'input "text" expected string, got 1',
            'input "when" expected time, got "now"',
            'input "side" must be one of ["a","b",3], got "c"',
            'input "src" expected a bar source (open, high, low, close, hl2, hlc3, ohlc4, hlcc4), got "median"',
            'input "extra" is not declared by the script',
        ]);
    });

    it("enforces numeric bounds and describes odd values", () => {
        expect(validateAlertInputs(MANIFEST, { len: 0 })).toEqual([
            'input "len" is 0, below its minimum 1',
        ]);
        expect(validateAlertInputs(MANIFEST, { len: 11 })).toEqual([
            'input "len" is 11, above its maximum 10',
        ]);
        expect(validateAlertInputs(MANIFEST, { mult: null, flag: {} })).toEqual([
            'input "mult" expected float, got null',
            'input "flag" expected bool, got object',
        ]);
        expect(validateAlertInputs(MANIFEST, { level: true })).toEqual([
            'input "level" expected price, got true',
        ]);
    });

    it("refuses external-series inputs outright", () => {
        const manifest = {
            ...MANIFEST,
            inputs: {
                feed: {
                    kind: "external-series",
                    name: "feed",
                    schema: { kind: "external-series-schema" },
                },
            },
        } as unknown as ScriptManifest;
        expect(validateAlertInputs(manifest, {})).toEqual([
            'input "feed" is an external series, which the alert runner cannot feed',
        ]);
    });

    it("accepts the external-series inputs the caller feeds, by entry key", () => {
        const manifest = {
            ...MANIFEST,
            inputs: {
                ...MANIFEST.inputs,
                fed: {
                    kind: "external-series",
                    name: "feed-a",
                    schema: { kind: "external-series-schema" },
                },
                other: {
                    kind: "external-series",
                    name: "feed-b",
                    schema: { kind: "external-series-schema" },
                },
            },
        } as unknown as ScriptManifest;
        expect(
            validateAlertInputs(manifest, { len: 4 }, { externalSeries: ["fed", "other"] }),
        ).toEqual([]);
        // The descriptor name is not the key space; an unlisted one keeps the 1.0 text.
        expect(
            validateAlertInputs(manifest, {}, { externalSeries: ["feed-a", "fed", "len"] }),
        ).toEqual([
            'external series "feed-a" is not an external-series input of the script',
            'external series "len" is not an external-series input of the script',
            'input "other" is an external series, which the alert runner cannot feed',
        ]);
        expect(
            validateAlertInputs(manifest, { fed: [1] }, { externalSeries: ["fed", "other"] }),
        ).toEqual([
            'input "fed" is an external series; its values are fed per bar, not as an input',
        ]);
    });
    it("refuses two fed keys whose descriptors share one feed name", () => {
        const feed = (name: string) => ({
            kind: "external-series",
            name,
            schema: { kind: "external-series-schema" },
        });
        const manifest = {
            ...MANIFEST,
            inputs: { a: feed("same"), b: feed("same"), c: feed("other") },
        } as unknown as ScriptManifest;
        expect(validateAlertInputs(manifest, {}, { externalSeries: ["a", "b", "c"] })).toEqual([
            'external series "a" and "b" share the feed name "same"',
        ]);
        // Feeding only one of them is fine; the other keeps the 1.0 refusal.
        expect(validateAlertInputs(manifest, {}, { externalSeries: ["a", "c"] })).toEqual([
            'input "b" is an external series, which the alert runner cannot feed',
        ]);
    });
});
