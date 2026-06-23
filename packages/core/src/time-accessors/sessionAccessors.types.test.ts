// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { SessionNamespace } from "./sessionAccessors.js";

const runtimeSession: SessionNamespace = {
    isOpen: () => false,
};

describe("session namespace type surface", () => {
    it("isOpen returns boolean with an optional tz argument", () => {
        expectTypeOf(runtimeSession.isOpen(0, "0930-1600")).toEqualTypeOf<boolean>();
        expectTypeOf(runtimeSession.isOpen(0, "0930-1600", "UTC")).toEqualTypeOf<boolean>();
    });
});
