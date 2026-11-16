// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { AlertRunnerError } from "./errors.js";
import { intervalMs } from "./interval.js";

describe("intervalMs", () => {
    it("maps chartlang interval tokens to milliseconds", () => {
        expect(intervalMs("1m")).toBe(60_000);
        expect(intervalMs("5")).toBe(300_000);
        expect(intervalMs("1h")).toBe(3_600_000);
        expect(intervalMs("1D")).toBe(86_400_000);
        expect(intervalMs("1W")).toBe(7 * 86_400_000);
    });

    it("throws invalid-argument for an unknown token, keeping the cause", () => {
        const failure = (() => {
            try {
                intervalMs("1x");
                return null;
            } catch (err) {
                return err;
            }
        })();
        expect(failure).toBeInstanceOf(AlertRunnerError);
        expect(failure).toMatchObject({
            code: "invalid-argument",
            message: 'unknown interval "1x"',
        });
        expect((failure as Error).cause).toBeInstanceOf(Error);
    });
});
