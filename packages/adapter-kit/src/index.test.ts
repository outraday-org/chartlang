// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { feedKey as coreFeedKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import * as publicSurface from "./index.js";
import { feedKey } from "./index.js";

describe("public surface", () => {
    it("loads the package barrel", () => {
        expect(publicSurface).toBeDefined();
    });

    it("re-exports feedKey as core's identity (no fork)", () => {
        expect(feedKey).toBe(coreFeedKey);
        expect(feedKey("AMEX:SPY", "1D")).toBe("AMEX:SPY@1D");
        expect(feedKey(undefined, "1D")).toBe("1D");
    });
});
