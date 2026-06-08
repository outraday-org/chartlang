// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { inputsFormTestManifest as manifest } from "../../__fixtures__/inputsFormTestManifest";
import { testCapabilities } from "../../__fixtures__/testHelpers";
import { renderInputsForm } from "./renderInputsForm";

describe("renderInputsForm", () => {
    it("builds fields for every current input descriptor kind", () => {
        const vm = renderInputsForm(manifest, { length: 20 }, () => undefined, testCapabilities);

        expect(vm.fields.map((field) => [field.key, field.kind, field.value])).toEqual([
            ["length", "int", 20],
            ["ratio", "float", 2.5],
            ["enabled", "bool", true],
            ["note", "string", "demo"],
            ["mode", "enum", "fast"],
            ["tint", "color", "#26a69a"],
            ["source", "source", "close"],
            ["anchor", "time", 1_700_000_000_000],
            ["level", "price", 101.25],
            ["symbol", "symbol", "AAPL"],
            ["interval", "interval", "1D"],
            ["earnings", "external-series", undefined],
        ]);
        expect(vm.fields[0]).toMatchObject({ title: "Length", min: 1, max: 200, step: 1 });
        expect(vm.fields[3]).toMatchObject({ multiline: true });
        expect(vm.fields[11]).toMatchObject({ title: "earnings", readonly: true });
    });

    it("derives enum, source, and interval options from descriptors and capabilities", () => {
        const vm = renderInputsForm(manifest, {}, () => undefined, testCapabilities);

        expect(vm.fields.find((field) => field.key === "mode")?.options).toEqual([
            { value: "fast", label: "fast" },
            { value: "slow", label: "slow" },
        ]);
        expect(vm.fields.find((field) => field.key === "source")?.options).toEqual([
            { value: "open", label: "open" },
            { value: "high", label: "high" },
            { value: "low", label: "low" },
            { value: "close", label: "close" },
            { value: "hl2", label: "hl2" },
            { value: "hlc3", label: "hlc3" },
            { value: "ohlc4", label: "ohlc4" },
            { value: "hlcc4", label: "hlcc4" },
        ]);
        expect(vm.fields.find((field) => field.key === "interval")?.options).toEqual([
            { value: "1m", label: "1 minute" },
            { value: "1D", label: "1 day" },
        ]);
    });

    it("keeps interval as a free-text field when capabilities are absent", () => {
        const vm = renderInputsForm(manifest, {}, () => undefined);

        expect(vm.fields.find((field) => field.key === "interval")?.options).toBeUndefined();
    });

    it("omits numeric constraints and multiline hints when descriptors omit them", () => {
        const vm = renderInputsForm(
            {
                ...manifest,
                inputs: {
                    length: { kind: "int", defaultValue: 14 },
                    note: { kind: "string", defaultValue: "single" },
                },
            },
            {},
            () => undefined,
        );

        expect(vm.fields[0]).toEqual({
            key: "length",
            kind: "int",
            title: "length",
            value: 14,
            onChange: vm.fields[0]?.onChange,
        });
        expect(vm.fields[1]).toEqual({
            key: "note",
            kind: "string",
            title: "note",
            value: "single",
            onChange: vm.fields[1]?.onChange,
        });
    });
});
