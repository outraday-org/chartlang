// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { AlertRunnerError } from "./errors.js";

describe("AlertRunnerError", () => {
    it("carries code, reason, details and cause", () => {
        const cause = new Error("inner");
        const err = new AlertRunnerError("aborted", "outer", {
            reason: "steps",
            details: ["a"],
            cause,
        });
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe("AlertRunnerError");
        expect(err).toMatchObject({
            code: "aborted",
            reason: "steps",
            details: ["a"],
            message: "outer",
        });
        expect(err.cause).toBe(cause);
    });

    it("defaults reason, details and cause", () => {
        const err = new AlertRunnerError("disposed", "gone");
        expect(err.reason).toBeUndefined();
        expect(err.details).toEqual([]);
        expect(err.cause).toBeUndefined();
    });
});
