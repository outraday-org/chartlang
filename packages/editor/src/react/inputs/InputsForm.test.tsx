// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { inputsFormTestManifest } from "../../__fixtures__/inputsFormTestManifest.js";
import { testCapabilities } from "../../__fixtures__/testHelpers.js";
import { InputsForm } from "./InputsForm.js";

afterEach(() => cleanup());

describe("InputsForm", () => {
    it("renders native controls and emits changed value records", () => {
        const changes: Readonly<Record<string, unknown>>[] = [];
        const { container } = render(
            <InputsForm
                capabilities={testCapabilities}
                manifest={inputsFormTestManifest}
                onChange={(next) => {
                    changes.push(next);
                }}
                value={{ length: 20 }}
            />,
        );

        expect(screen.getByLabelText("Length").getAttribute("type")).toBe("number");
        expect(screen.getByLabelText("ratio").getAttribute("type")).toBe("number");
        expect(screen.getByLabelText("enabled").getAttribute("type")).toBe("checkbox");
        expect(screen.getByLabelText("note").tagName).toBe("TEXTAREA");
        expect(screen.getByLabelText("mode").tagName).toBe("SELECT");
        expect(screen.getByLabelText("tint").getAttribute("type")).toBe("color");
        expect(screen.getByLabelText("source").tagName).toBe("SELECT");
        expect(screen.getByLabelText("anchor").getAttribute("type")).toBe("number");
        expect(screen.getByLabelText("level").getAttribute("type")).toBe("number");
        expect(screen.getByLabelText("symbol").getAttribute("type")).toBe("text");
        expect(screen.getByLabelText("interval").tagName).toBe("SELECT");
        expect(isDisabledInput(screen.getByLabelText("earnings"))).toBe(true);
        expect(screen.getByLabelText("window").getAttribute("type")).toBe("text");
        expect(container.querySelector("form")?.classList.contains("chartlang-inputs-form")).toBe(
            true,
        );
        const form = container.querySelector("form");
        if (!(form instanceof HTMLFormElement)) throw new Error("missing inputs form");

        fireEvent.change(screen.getByLabelText("Length"), { target: { value: "21" } });
        fireEvent.click(screen.getByLabelText("enabled"));
        fireEvent.change(screen.getByLabelText("note"), { target: { value: "changed" } });
        fireEvent.change(screen.getByLabelText("mode"), { target: { value: "slow" } });
        fireEvent.change(screen.getByLabelText("tint"), { target: { value: "#ffffff" } });
        fireEvent.change(screen.getByLabelText("source"), { target: { value: "hlc3" } });
        fireEvent.change(screen.getByLabelText("interval"), { target: { value: "1m" } });
        fireEvent.change(screen.getByLabelText("symbol"), { target: { value: "MSFT" } });
        fireEvent.submit(form);

        expect(changes).toEqual([
            { length: 21 },
            { length: 20, enabled: false },
            { length: 20, note: "changed" },
            { length: 20, mode: "slow" },
            { length: 20, tint: "#ffffff" },
            { length: 20, source: "hlc3" },
            { length: 20, interval: "1m" },
            { length: 20, symbol: "MSFT" },
        ]);
    });

    it("renders interval as text without capabilities and accepts a custom className", () => {
        const changes: Readonly<Record<string, unknown>>[] = [];
        const { container } = render(
            <InputsForm
                className="custom-inputs"
                manifest={inputsFormTestManifest}
                onChange={(next) => {
                    changes.push(next);
                }}
                value={{}}
            />,
        );

        fireEvent.change(screen.getByLabelText("interval"), { target: { value: "4H" } });

        expect(screen.getByLabelText("interval").getAttribute("type")).toBe("text");
        expect(changes).toEqual([{ interval: "4H" }]);
        expect(container.querySelector("form")?.classList.contains("custom-inputs")).toBe(true);
    });

    it("renders numeric enum options and coerces the selection back to a number", () => {
        const changes: Readonly<Record<string, unknown>>[] = [];
        render(
            <InputsForm
                manifest={{
                    ...inputsFormTestManifest,
                    inputs: {
                        length: { kind: "enum", defaultValue: 21, options: [8, 21, 30] },
                    },
                }}
                onChange={(next) => {
                    changes.push(next);
                }}
                value={{ length: 8 }}
            />,
        );

        // selectValue stringifies the numeric current value so the <select> matches.
        expect(screen.getByLabelText("length")).toHaveProperty("value", "8");
        // coerceSelectValue maps the DOM string back to the typed numeric option.
        fireEvent.change(screen.getByLabelText("length"), { target: { value: "21" } });

        expect(changes).toEqual([{ length: 21 }]);
    });

    it("renders an enum select even when the current value is neither string nor number", () => {
        render(
            <InputsForm
                manifest={{
                    ...inputsFormTestManifest,
                    inputs: {
                        length: { kind: "enum", defaultValue: 21, options: [8, 21, 30] },
                    },
                }}
                onChange={() => undefined}
                value={{ length: true }}
            />,
        );

        // selectValue returns "" for the non-string/non-number value; jsdom then
        // falls back to displaying the first option, but the empty branch ran.
        expect(screen.getByLabelText("length").tagName).toBe("SELECT");
    });

    it("renders single-line strings and empty values for non-string text and non-number numeric values", () => {
        render(
            <InputsForm
                manifest={{
                    ...inputsFormTestManifest,
                    inputs: {
                        length: { kind: "int", defaultValue: 14 },
                        note: { kind: "string", defaultValue: "single" },
                        symbol: { kind: "symbol", defaultValue: "AAPL" },
                    },
                }}
                onChange={() => undefined}
                value={{ length: "not-number", symbol: 12 }}
            />,
        );

        expect(screen.getByLabelText("length").getAttribute("type")).toBe("number");
        expect(screen.getByLabelText("length")).toHaveProperty("value", "");
        expect(screen.getByLabelText("note").getAttribute("type")).toBe("text");
        expect(screen.getByLabelText("symbol")).toHaveProperty("value", "");
    });
});

function isDisabledInput(element: HTMLElement): boolean {
    return element instanceof HTMLInputElement && element.disabled;
}
