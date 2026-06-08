// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingCounts, IntervalDescriptor } from "@invinite-org/chartlang-core";
import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { SymInfoField } from "../types";
import { capabilities } from "./capabilities";

describe("capabilities Phase 4 builder types", () => {
    it("intervals(...) returns the typed intervals partial", () => {
        expectTypeOf(capabilities.intervals([])).toEqualTypeOf<{
            intervals: ReadonlyArray<IntervalDescriptor>;
        }>();
    });

    it("multiTimeframe(...) returns the typed flag partial", () => {
        expectTypeOf(capabilities.multiTimeframe(false)).toEqualTypeOf<{
            multiTimeframe: boolean;
        }>();
    });

    it("subPanes(...) returns the typed sub-pane partial", () => {
        expectTypeOf(capabilities.subPanes(1)).toEqualTypeOf<{ subPanes: number }>();
    });

    it("symInfoFields(...) returns the typed syminfo partial", () => {
        expectTypeOf(capabilities.symInfoFields([])).toEqualTypeOf<{
            symInfoFields: ReadonlySet<SymInfoField>;
        }>();
    });

    it("maxDrawingsPerScript(...) returns the typed drawing-budget partial", () => {
        const counts: DrawingCounts = {
            lines: 1,
            labels: 1,
            boxes: 1,
            polylines: 1,
            other: 1,
        };
        expectTypeOf(capabilities.maxDrawingsPerScript(counts)).toEqualTypeOf<{
            maxDrawingsPerScript: DrawingCounts;
        }>();
    });

    it("alertConditions(...) returns the typed alert-condition partial", () => {
        expectTypeOf(capabilities.alertConditions(false)).toEqualTypeOf<{
            alertConditions: boolean;
        }>();
    });

    it("logs(...) returns the typed logs partial", () => {
        expectTypeOf(capabilities.logs(false)).toEqualTypeOf<{ logs: boolean }>();
    });
});
