// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { inputsFormTestManifest } from "../../__fixtures__/inputsFormTestManifest.js";
import { renderInputsForm } from "./renderInputsForm.js";

describe("renderInputsForm property behavior", () => {
    it("round-trips field changes through a fresh immutable value record", () => {
        fc.assert(
            fc.property(
                fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.jsonValue()),
                fc.string(),
                (initial, next) => {
                    let emitted: Readonly<Record<string, unknown>> | undefined;
                    const vm = renderInputsForm(inputsFormTestManifest, initial, (value) => {
                        emitted = value;
                    });

                    vm.fields[0]?.onChange(next);

                    expect(emitted).toEqual({ ...initial, length: next });
                    expect(emitted).not.toBe(initial);
                    expect(Object.isFrozen(emitted)).toBe(true);
                },
            ),
        );
    });
});
