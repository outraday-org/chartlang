// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { PACKAGE_VERSION } from "./index";

describe("placeholder", () => {
    it("exports a version constant", () => {
        expect(PACKAGE_VERSION).toBe("0.0.0");
    });
});
