// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { request } from "./request";

describe("request callable holes", () => {
    it("request.security throws outside-runtime sentinel", () => {
        expect(() => request.security({ interval: "1D" })).toThrow(
            "request.security called outside an active script step",
        );
    });
});
