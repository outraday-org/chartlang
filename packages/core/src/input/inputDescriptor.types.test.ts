// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { InputDescriptor, IntDescriptor, SourceDescriptor } from "./inputDescriptor.js";

function narrowDescriptor(
    descriptor: InputDescriptor<unknown>,
): IntDescriptor | SourceDescriptor | undefined {
    if (descriptor.kind === "int") {
        expectTypeOf(descriptor).toEqualTypeOf<IntDescriptor>();
        return descriptor;
    }
    if (descriptor.kind === "source") {
        expectTypeOf(descriptor).toEqualTypeOf<SourceDescriptor>();
        return descriptor;
    }
    return undefined;
}

describe("InputDescriptor discriminated union", () => {
    it("narrows by kind", () => {
        const descriptor: InputDescriptor<unknown> = {
            kind: "int",
            defaultValue: 14,
            title: "Length",
        };

        expectTypeOf(narrowDescriptor(descriptor)).toEqualTypeOf<
            IntDescriptor | SourceDescriptor | undefined
        >();
    });
});
