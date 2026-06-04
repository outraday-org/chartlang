// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { extractInputs } from "./extractInputs";

describe("extractInputs", () => {
    it("returns an empty schema with userPickableInterval false", () => {
        const result = extractInputs();
        expect(result.inputs).toEqual({});
        expect(result.userPickableInterval).toBe(false);
        expect(Object.isFrozen(result.inputs)).toBe(true);
        expect(Object.isFrozen(result)).toBe(true);
    });
});
