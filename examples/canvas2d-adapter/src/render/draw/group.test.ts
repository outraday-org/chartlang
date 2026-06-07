// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { GroupState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { Viewport } from "../coords";
import { MockCanvas2DContext } from "../../testing";
import { renderGroup } from "./group";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 100,
    pxWidth: 800,
    pxHeight: 400,
};

function emission(state: GroupState): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "group",
        op: "create",
        state,
        bar: 0,
        time: 0,
    };
}

describe("renderGroup", () => {
    it("is a pure no-op for an empty group (Phase-3 contract)", () => {
        const ctx = new MockCanvas2DContext();
        renderGroup(
            ctx,
            emission({ kind: "group", childHandleIds: [] }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("is a pure no-op for a populated group (Phase-3 contract)", () => {
        const ctx = new MockCanvas2DContext();
        renderGroup(
            ctx,
            emission({
                kind: "group",
                childHandleIds: ["a", "b", "c"],
            }),
            VIEW,
        );
        expect(ctx.calls).toEqual([]);
    });
});
