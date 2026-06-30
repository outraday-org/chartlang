// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { input } from "./input.js";

const inputMetadata = {
    group: "Trend",
    inline: "row-1",
    tooltip: "Shown in the settings panel",
    display: "data-window",
    confirm: true,
} as const;

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

    it("builds a numeric enum descriptor with a frozen options copy", () => {
        const options = [8, 21, 30] as const;
        const descriptor = input.enum(21, options, { title: "MA Length" });

        expect(descriptor).toEqual({
            kind: "enum",
            defaultValue: 21,
            options: [8, 21, 30],
            title: "MA Length",
        });
        expect(descriptor.options).not.toBe(options);
        expect(Object.isFrozen(descriptor.options)).toBe(true);
        expect(() => Object.assign(descriptor.options, { 0: 99 })).toThrow(TypeError);
    });

    it("builds a numeric enum descriptor without opts", () => {
        expect(input.enum(50, [50, 100, 200])).toEqual({
            kind: "enum",
            defaultValue: 50,
            options: [50, 100, 200],
        });
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

    it.each([
        ["int", () => input.int(20, { min: 1, title: "Length", ...inputMetadata })],
        ["float", () => input.float(2.5, { step: 0.5, title: "Factor", ...inputMetadata })],
        ["bool", () => input.bool(true, { title: "Enabled", ...inputMetadata })],
        [
            "string",
            () => input.string("note", { multiline: true, title: "Note", ...inputMetadata }),
        ],
        ["enum", () => input.enum("fast", ["fast", "slow"], { title: "Mode", ...inputMetadata })],
        ["color", () => input.color("#26a69a", { title: "Color", ...inputMetadata })],
        ["source", () => input.source("close", { title: "Source", ...inputMetadata })],
        [
            "time",
            () =>
                input.time(1_700_000_000_000, {
                    pickFromChart: true,
                    title: "Anchor",
                    ...inputMetadata,
                }),
        ],
        ["price", () => input.price(101.25, { title: "Level", ...inputMetadata })],
        ["symbol", () => input.symbol("AAPL", { title: "Symbol", ...inputMetadata })],
        ["interval", () => input.interval("1D", { title: "Timeframe", ...inputMetadata })],
        ["session", () => input.session("0930-1600", { title: "Session", ...inputMetadata })],
        [
            "external-series",
            () =>
                input.externalSeries({
                    name: "earnings",
                    schema: { kind: "external-series-schema" },
                    title: "Earnings",
                    ...inputMetadata,
                }),
        ],
    ])("carries presentation metadata on %s descriptors", (_kind, build) => {
        const descriptor = build();

        expect(descriptor).toMatchObject(inputMetadata);
        expect(Object.isFrozen(descriptor)).toBe(true);
    });

    it.each([
        ["int", input.int(20)],
        ["float", input.float(2.5)],
        ["bool", input.bool(true)],
        ["string", input.string("note")],
        ["enum", input.enum("fast", ["fast", "slow"])],
        ["color", input.color("#26a69a")],
        ["source", input.source("close")],
        ["time", input.time(1_700_000_000_000)],
        ["price", input.price(101.25)],
        ["symbol", input.symbol("AAPL")],
        ["interval", input.interval("1D")],
        ["session", input.session("0930-1600")],
        [
            "external-series",
            input.externalSeries({
                name: "earnings",
                schema: { kind: "external-series-schema" },
            }),
        ],
    ])("omits presentation metadata keys for %s without opts", (_kind, descriptor) => {
        expect(Object.hasOwn(descriptor, "group")).toBe(false);
        expect(Object.hasOwn(descriptor, "inline")).toBe(false);
        expect(Object.hasOwn(descriptor, "tooltip")).toBe(false);
        expect(Object.hasOwn(descriptor, "display")).toBe(false);
        expect(Object.hasOwn(descriptor, "confirm")).toBe(false);
    });
});
