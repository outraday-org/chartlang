// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { SnapshotError, isSnapshotError } from "./snapshotError.js";

describe("SnapshotError", () => {
    it("is an Error with a stable name", () => {
        const err = new SnapshotError("importSnapshot: state store key mismatch");
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("SnapshotError");
        expect(err.message).toBe("importSnapshot: state store key mismatch");
    });
});

describe("isSnapshotError", () => {
    it("accepts an error built by this module", () => {
        expect(isSnapshotError(new SnapshotError("nope"))).toBe(true);
    });

    it("accepts a same-named error from another realm or package copy", () => {
        const foreign = new Error("nope");
        foreign.name = "SnapshotError";
        expect(isSnapshotError(foreign)).toBe(true);
    });

    it("rejects a plain error", () => {
        expect(isSnapshotError(new Error("boom"))).toBe(false);
    });

    it("rejects non-errors", () => {
        expect(isSnapshotError("SnapshotError")).toBe(false);
        expect(isSnapshotError(null)).toBe(false);
        expect(isSnapshotError({ name: "SnapshotError" })).toBe(false);
    });
});
