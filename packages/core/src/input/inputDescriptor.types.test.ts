// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type {
    BoolDescriptor,
    ColorDescriptor,
    CommonInputOpts,
    EnumDescriptor,
    ExternalSeriesDescriptor,
    ExternalSeriesFeed,
    ExternalSeriesFeedMap,
    FloatDescriptor,
    InputDescriptor,
    InputDisplay,
    IntDescriptor,
    IntervalDescriptorInput,
    PriceDescriptor,
    SessionDescriptor,
    SourceDescriptor,
    StringDescriptor,
    SymbolDescriptor,
    TimeDescriptor,
} from "./inputDescriptor.js";

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

    it("exposes common presentation metadata on every descriptor", () => {
        type MetadataSurface = keyof CommonInputOpts;

        expectTypeOf<Pick<IntDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<FloatDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<BoolDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<StringDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<
            Pick<EnumDescriptor<"a" | "b">, MetadataSurface>
        >().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<ColorDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<SourceDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<TimeDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<PriceDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<SymbolDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<
            Pick<IntervalDescriptorInput, MetadataSurface>
        >().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<Pick<SessionDescriptor, MetadataSurface>>().toEqualTypeOf<CommonInputOpts>();
        expectTypeOf<
            Pick<ExternalSeriesDescriptor<number>, MetadataSurface>
        >().toEqualTypeOf<CommonInputOpts>();
    });

    it("limits input display metadata to supported literals", () => {
        expectTypeOf<InputDisplay>().toEqualTypeOf<
            "all" | "status-line" | "data-window" | "none"
        >();
        expectTypeOf<"price-scale">().not.toMatchTypeOf<InputDisplay>();
    });

    it("exposes external series feed maps as numeric arrays keyed by feed name", () => {
        expectTypeOf<ExternalSeriesFeed>().toEqualTypeOf<
            Readonly<{ values: ReadonlyArray<number> }>
        >();
        expectTypeOf<ExternalSeriesFeedMap>().toEqualTypeOf<
            Readonly<Record<string, ExternalSeriesFeed>>
        >();
    });
});
