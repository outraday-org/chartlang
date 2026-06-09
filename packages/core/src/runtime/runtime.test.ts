// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { runtime } from "./runtime";

describe("runtime namespace hole", () => {
    it("throws for log methods outside the compiled runtime", () => {
        expect(() => runtime.log.info("x")).toThrow(
            "runtime.log.info called outside compiled runtime",
        );
        expect(() => runtime.log.warn("x")).toThrow(
            "runtime.log.warn called outside compiled runtime",
        );
        expect(() => runtime.log.error("x")).toThrow(
            "runtime.log.error called outside compiled runtime",
        );
    });

    it("throws for runtime.error outside the compiled runtime", () => {
        expect(() => runtime.error("halt")).toThrow(
            "runtime.error called outside compiled runtime",
        );
    });
});
