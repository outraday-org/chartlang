// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { syminfo } from "./syminfo.js";
import type { SymbolType, SymInfoView } from "./syminfo.js";
import type { JsonValue } from "../types.js";

describe("syminfo type surface", () => {
    it("exposes a typed read-only view", () => {
        expectTypeOf(syminfo).toEqualTypeOf<SymInfoView>();
        expectTypeOf<SymInfoView["type"]>().toEqualTypeOf<SymbolType>();
        expectTypeOf<SymInfoView["meta"]>().toEqualTypeOf<Readonly<Record<string, JsonValue>>>();
    });
});
