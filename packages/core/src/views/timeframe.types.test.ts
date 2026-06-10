// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import { timeframe } from "./timeframe.js";
import type { TimeframeView } from "./timeframe.js";

describe("timeframe type surface", () => {
    it("exposes a typed read-only view", () => {
        expectTypeOf(timeframe).toEqualTypeOf<TimeframeView>();
        expectTypeOf<TimeframeView["inSeconds"]>().toEqualTypeOf<number>();
    });
});
