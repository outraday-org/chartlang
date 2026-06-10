// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { barstate } from "./barstate.js";
import type { BarStateView } from "./barstate.js";

describe("barstate type surface", () => {
    it("exposes a typed read-only view", () => {
        expectTypeOf(barstate).toEqualTypeOf<BarStateView>();
        expectTypeOf<BarStateView["isconfirmed"]>().toEqualTypeOf<boolean>();
    });
});
