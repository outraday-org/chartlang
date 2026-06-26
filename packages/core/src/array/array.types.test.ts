// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { MutableArraySlot } from "../state/arraySlot.js";
import { array } from "./index.js";
import type { ArrayNamespace } from "./index.js";

type Win = MutableArraySlot<number>;

describe("MutableArraySlot numeric-reduction type surface", () => {
    it("resolves the scalar reductions to `number`", () => {
        expectTypeOf<Win["sum"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["avg"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["min"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["max"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["range"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["median"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["percentile"]>().returns.toEqualTypeOf<number>();
        expectTypeOf<Win["indexOf"]>().returns.toEqualTypeOf<number>();
    });

    it("types the optional `biased` flag and the boolean predicate", () => {
        expectTypeOf<Win["variance"]>().parameter(0).toEqualTypeOf<boolean | undefined>();
        expectTypeOf<Win["stdev"]>().parameter(0).toEqualTypeOf<boolean | undefined>();
        expectTypeOf<Win["includes"]>().returns.toEqualTypeOf<boolean>();
    });

    it("returns a READONLY sorted copy from `sort` — not a mutable array", () => {
        expectTypeOf<Win["sort"]>().returns.toEqualTypeOf<ReadonlyArray<number>>();
        expectTypeOf<Win["sort"]>().parameter(0).toEqualTypeOf<"asc" | "desc" | undefined>();
        // The fresh copy is intentionally not assignable to a mutable `number[]`.
        expectTypeOf<ReadonlyArray<number>>().not.toMatchTypeOf<number[]>();
    });
});

describe("array namespace type surface", () => {
    it("delegates the namespace members to the matching handle return types", () => {
        expectTypeOf(array).toEqualTypeOf<ArrayNamespace>();
        expectTypeOf(array.avg).returns.toEqualTypeOf<number>();
        expectTypeOf(array.percentile).returns.toEqualTypeOf<number>();
        expectTypeOf(array.percentile).parameter(1).toEqualTypeOf<number>();
        expectTypeOf(array.includes).returns.toEqualTypeOf<boolean>();
        expectTypeOf(array.sort).returns.toEqualTypeOf<ReadonlyArray<number>>();
        expectTypeOf(array.sort).parameter(1).toEqualTypeOf<"asc" | "desc" | undefined>();
        // Every member's first parameter is the number-element handle.
        expectTypeOf(array.avg).parameter(0).toEqualTypeOf<MutableArraySlot<number>>();
    });
});
