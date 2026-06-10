// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { Price, Time } from "../types.js";
import type {
    AnchorHept,
    AnchorPair,
    AnchorQuad,
    AnchorQuint,
    AnchorTriple,
    WorldPoint,
} from "./worldPoint.js";

describe("WorldPoint", () => {
    it("exposes `time: Time` and `price: Price` only", () => {
        expectTypeOf<WorldPoint["time"]>().toEqualTypeOf<Time>();
        expectTypeOf<WorldPoint["price"]>().toEqualTypeOf<Price>();
    });
});

describe("Anchor tuple helpers", () => {
    it("AnchorPair is a length-2 readonly tuple of WorldPoint", () => {
        expectTypeOf<AnchorPair>().toEqualTypeOf<readonly [WorldPoint, WorldPoint]>();
    });

    it("AnchorTriple is a length-3 readonly tuple of WorldPoint", () => {
        expectTypeOf<AnchorTriple>().toEqualTypeOf<readonly [WorldPoint, WorldPoint, WorldPoint]>();
    });

    it("AnchorQuad is a length-4 readonly tuple", () => {
        expectTypeOf<AnchorQuad>().toEqualTypeOf<
            readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint]
        >();
    });

    it("AnchorQuint is a length-5 readonly tuple", () => {
        expectTypeOf<AnchorQuint>().toEqualTypeOf<
            readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint, WorldPoint]
        >();
    });

    it("AnchorHept is a length-7 readonly tuple", () => {
        expectTypeOf<AnchorHept>().toEqualTypeOf<
            readonly [
                WorldPoint,
                WorldPoint,
                WorldPoint,
                WorldPoint,
                WorldPoint,
                WorldPoint,
                WorldPoint,
            ]
        >();
    });
});
