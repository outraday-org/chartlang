// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { createLanguageService } from "./language-service.js";

describe("language-service entry", () => {
    it("exposes the opt-in language-service factory", () => {
        expect(createLanguageService).toEqual(expect.any(Function));
    });
});
