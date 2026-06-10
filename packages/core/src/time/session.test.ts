// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { session } from "./session.js";

describe("session namespace", () => {
    it("is frozen and delegates", () => {
        expect(Object.isFrozen(session)).toBe(true);
        expect(session.isOpen("America/New_York", Date.UTC(2024, 2, 1, 14, 30), "regular")).toBe(
            true,
        );
    });
});
