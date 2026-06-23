// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { input } from "./input.js";

describe("input builders", () => {
    it("builds a frozen int descriptor", () => {
        const descriptor = input.int(20, { min: 1, max: 200, step: 1, title: "Length" });

        expect(descriptor).toEqual({
            kind: "int",
            defaultValue: 20,
            min: 1,
            max: 200,
            step: 1,
            title: "Length",
        });
        expect(Object.isFrozen(descriptor)).toBe(true);
        expect(() => Object.assign(descriptor, { min: 2 })).toThrow(TypeError);
    });

    it("builds a float descriptor", () => {
        expect(input.float(2.5, { min: 0, max: 5, step: 0.5, title: "Factor" })).toEqual({
            kind: "float",
            defaultValue: 2.5,
            min: 0,
            max: 5,
            step: 0.5,
            title: "Factor",
        });
    });

    it("builds a bool descriptor", () => {
        expect(input.bool(true, { title: "Enabled" })).toEqual({
            kind: "bool",
            defaultValue: true,
            title: "Enabled",
        });
    });

    it("builds a string descriptor", () => {
        expect(input.string("note", { multiline: true, title: "Note" })).toEqual({
            kind: "string",
            defaultValue: "note",
            multiline: true,
            title: "Note",
        });
    });

    it("builds an enum descriptor with a frozen options copy", () => {
        const options = ["fast", "slow"] as const;
        const descriptor = input.enum("fast", options, { title: "Mode" });

        expect(descriptor).toEqual({
            kind: "enum",
            defaultValue: "fast",
            options: ["fast", "slow"],
            title: "Mode",
        });
        expect(descriptor.options).not.toBe(options);
        expect(Object.isFrozen(descriptor.options)).toBe(true);
        expect(() => Object.assign(descriptor.options, { 0: "medium" })).toThrow(TypeError);
    });

    it("builds a color descriptor", () => {
        expect(input.color("#26a69a", { title: "Color" })).toEqual({
            kind: "color",
            defaultValue: "#26a69a",
            title: "Color",
        });
    });

    it("builds a source descriptor", () => {
        expect(input.source("hlc3", { title: "Source" })).toEqual({
            kind: "source",
            defaultValue: "hlc3",
            title: "Source",
        });
    });

    it("builds a time descriptor", () => {
        expect(input.time(1_700_000_000_000, { pickFromChart: true, title: "Anchor" })).toEqual({
            kind: "time",
            defaultValue: 1_700_000_000_000,
            pickFromChart: true,
            title: "Anchor",
        });
    });

    it("builds a price descriptor", () => {
        expect(input.price(101.25, { title: "Level" })).toEqual({
            kind: "price",
            defaultValue: 101.25,
            title: "Level",
        });
    });

    it("builds a symbol descriptor", () => {
        expect(input.symbol("AAPL", { title: "Symbol" })).toEqual({
            kind: "symbol",
            defaultValue: "AAPL",
            title: "Symbol",
        });
    });

    it("builds an interval descriptor", () => {
        expect(input.interval("1D", { title: "Timeframe" })).toEqual({
            kind: "interval",
            defaultValue: "1D",
            title: "Timeframe",
        });
    });

    it("builds a session descriptor", () => {
        expect(input.session("0930-1600", { title: "Session" })).toEqual({
            kind: "session",
            defaultValue: "0930-1600",
            title: "Session",
        });
    });

    it("builds an external-series descriptor", () => {
        const schema = Object.freeze({ kind: "external-series-schema" as const });

        expect(input.externalSeries({ name: "earnings", schema, title: "Earnings" })).toEqual({
            kind: "external-series",
            name: "earnings",
            schema,
            title: "Earnings",
        });
    });
});
