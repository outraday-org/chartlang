// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { DrawingState } from "./drawingState";
import type { DrawingHandle } from "./handle";

describe("DrawingHandle", () => {
    it("exposes id, update(patch), remove() — and nothing else", () => {
        expectTypeOf<DrawingHandle["id"]>().toEqualTypeOf<string>();
        expectTypeOf<DrawingHandle["update"]>().parameter(0).toMatchTypeOf<Partial<DrawingState>>();
        expectTypeOf<DrawingHandle["update"]>().returns.toEqualTypeOf<void>();
        expectTypeOf<DrawingHandle["remove"]>().returns.toEqualTypeOf<void>();
    });
});
