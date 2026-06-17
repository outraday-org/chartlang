// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { DRAWING_KINDS } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";
import { DRAWING_KIND_MAP, drawingLookup } from "./drawingKinds.js";

describe("DRAWING_KIND_MAP", () => {
    it("maps line.new → line with a non-empty setter map", () => {
        const m = DRAWING_KIND_MAP.get("line.new");
        expect(m?.chartlang).toBe("line");
        expect(m?.setterMap.size).toBeGreaterThan(0);
    });

    it("maps box.new → rectangle and label.new → text", () => {
        expect(DRAWING_KIND_MAP.get("box.new")?.chartlang).toBe("rectangle");
        expect(DRAWING_KIND_MAP.get("label.new")?.chartlang).toBe("text");
    });

    it("set_xy1 lowers to anchors[0] with arity 2", () => {
        const setter = DRAWING_KIND_MAP.get("line.new")?.setterMap.get("set_xy1");
        expect(setter?.statePath).toEqual(["anchors", 0]);
        expect(setter?.arity).toBe(2);
    });

    it("every non-null chartlang kind is a real chartlang DrawingKind", () => {
        for (const m of DRAWING_KIND_MAP.values()) {
            if (m.chartlang !== null) {
                expect(DRAWING_KINDS).toContain(m.chartlang);
            }
        }
    });

    it("flags linefill.new as a REJECT (chartlang null)", () => {
        expect(DRAWING_KIND_MAP.get("linefill.new")?.chartlang).toBeNull();
    });

    it("marks table.new as requiring a builder", () => {
        expect(DRAWING_KIND_MAP.get("table.new")?.requiresBuilder).toBe(true);
    });

    it("leaves polyline.new with an empty (constructor-only) setter map", () => {
        expect(DRAWING_KIND_MAP.get("polyline.new")?.setterMap.size).toBe(0);
    });
});

describe("drawingLookup", () => {
    it("resolves a mappable constructor", () => {
        expect(drawingLookup("line.new")?.chartlang).toBe("line");
    });

    it("returns null for an unknown constructor", () => {
        expect(drawingLookup("nope.new")).toBeNull();
    });

    it("returns null for the linefill REJECT", () => {
        expect(drawingLookup("linefill.new")).toBeNull();
    });
});
