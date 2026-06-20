// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { resolveShapeStyle } from "./shapeStyle.js";

describe("resolveShapeStyle", () => {
    it("defaults stroke to #000000 / width 1 / solid and omits fill", () => {
        const r = resolveShapeStyle({});
        expect(r.stroke).toEqual({ color: "#000000", width: 1, dash: [] });
        expect(r.fill).toBeUndefined();
    });

    it("resolves an explicit stroke and dash", () => {
        const r = resolveShapeStyle({ stroke: "#3b82f6", lineWidth: 2, lineStyle: "dashed" });
        expect(r.stroke).toEqual({ color: "#3b82f6", width: 2, dash: [6, 4] });
    });

    it("includes fill with a default alpha of 1 when fill is set", () => {
        const r = resolveShapeStyle({ fill: "#dbeafe" });
        expect(r.fill).toEqual({ color: "#dbeafe", alpha: 1 });
    });

    it("honours an explicit fill alpha", () => {
        const r = resolveShapeStyle({ fill: "#dbeafe", fillAlpha: 0.4 });
        expect(r.fill).toEqual({ color: "#dbeafe", alpha: 0.4 });
    });
});
