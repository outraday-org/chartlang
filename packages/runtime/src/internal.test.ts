// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as internal from "./internal.js";

describe("internal subpath", () => {
    it("re-exports __chartlang_depOutput", () => {
        expect(internal.__chartlang_depOutput).toBeTypeOf("function");
    });

    it("re-exports installDepOutputGlobal", () => {
        expect(internal.installDepOutputGlobal).toBeTypeOf("function");
    });

    it("re-exports the DEP_OUTPUT_GLOBAL_KEY constant", () => {
        expect(internal.DEP_OUTPUT_GLOBAL_KEY).toBe("__chartlang_depOutput");
    });
});
