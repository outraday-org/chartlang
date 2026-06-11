// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { JsonValue } from "../types.js";
import type { DependencyDeclaration, OutputDeclaration } from "./dependency.js";

describe("DependencyDeclaration / OutputDeclaration type shape", () => {
    it("OutputDeclaration.kind is the literal 'series-number'", () => {
        expectTypeOf<OutputDeclaration["kind"]>().toEqualTypeOf<"series-number">();
    });

    it("OutputDeclaration.title is string", () => {
        expectTypeOf<OutputDeclaration["title"]>().toEqualTypeOf<string>();
    });

    it("DependencyDeclaration.localId is string", () => {
        expectTypeOf<DependencyDeclaration["localId"]>().toEqualTypeOf<string>();
    });

    it("DependencyDeclaration.effectiveInputs is JSON-keyed", () => {
        expectTypeOf<DependencyDeclaration["effectiveInputs"]>().toEqualTypeOf<
            Readonly<Record<string, JsonValue>>
        >();
    });

    it("DependencyDeclaration.outputs is ReadonlyArray<OutputDeclaration>", () => {
        expectTypeOf<DependencyDeclaration["outputs"]>().toEqualTypeOf<
            ReadonlyArray<OutputDeclaration>
        >();
    });

    it("DependencyDeclaration.isDrawn is boolean (not optional)", () => {
        expectTypeOf<DependencyDeclaration["isDrawn"]>().toEqualTypeOf<boolean>();
    });

    it("DependencyDeclaration.producerSourcePath is string", () => {
        expectTypeOf<DependencyDeclaration["producerSourcePath"]>().toEqualTypeOf<string>();
    });
});
