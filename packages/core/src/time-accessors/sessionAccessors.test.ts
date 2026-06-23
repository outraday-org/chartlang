// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { session } from "./sessionAccessors.js";

describe("session callable holes", () => {
    it("throws a sentinel for session.isOpen outside an active script step", () => {
        expect(() => session.isOpen(0, "0930-1600")).toThrow(
            "session.isOpen called outside an active script step",
        );
    });

    it("freezes the namespace", () => {
        expect(Object.isFrozen(session)).toBe(true);
    });
});
