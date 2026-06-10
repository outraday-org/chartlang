// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { MutableSlot } from "./mutableSlot.js";

describe("MutableSlot type surface", () => {
    it("exposes value as a readable and writable property", () => {
        const slot: MutableSlot<number> = {
            get value() {
                return 1;
            },
            set value(_next: number) {},
        };

        slot.value = 2;
        expectTypeOf(slot.value).toEqualTypeOf<number>();
    });

    it("does not expose method-style history helpers", () => {
        expectTypeOf<MutableSlot<string>>().not.toHaveProperty("history");
        expectTypeOf<MutableSlot<string>>().not.toHaveProperty("previous");
    });
});
