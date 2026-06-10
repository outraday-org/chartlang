// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as publicSurface from "./index.js";

describe("public surface", () => {
    it("loads the package barrel", () => {
        expect(publicSurface).toBeDefined();
    });
});
