// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableArraySlot } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import type { ArrayStateSlot } from "./arrayStateSlot.js";
import { buildStateNamespace } from "./stateNamespace.js";

type RuntimeArrayNamespace = {
    readonly array: (slotId: string, capacity: number) => MutableArraySlot<number>;
};

function ctxWith(slotIdPrefix?: string): RuntimeContext {
    return {
        arraySlots: new Map<string, ArrayStateSlot>(),
        ...(slotIdPrefix === undefined ? {} : { slotIdPrefix }),
    } as unknown as RuntimeContext;
}

function runtimeArray(): RuntimeArrayNamespace {
    return buildStateNamespace() as unknown as RuntimeArrayNamespace;
}

describe("state.array allocator", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("throws the runtime sentinel outside an active script step", () => {
        expect(() => runtimeArray().array("a#0", 4)).toThrow(
            "state.array called outside an active script step",
        );
    });

    it("allocates on first call and reuses the same handle for the same slot id", () => {
        const ctx = ctxWith();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const ns = runtimeArray();

        const first = ns.array("a#0", 4);
        first.push(7);
        // A later call with a different capacity literal returns the SAME slot.
        const second = ns.array("a#0", 99);

        expect(second).toBe(first);
        expect(second.get(0)).toBe(7);
        expect(second.capacity).toBe(4);
        expect(ctx.arraySlots.size).toBe(1);
        expect(ctx.arraySlots.has("a#0:array")).toBe(true);
    });

    it("prefixes dep-context array slot keys with the slotIdPrefix", () => {
        const ctx = ctxWith("dep:fast/");
        ACTIVE_RUNTIME_CONTEXT.current = ctx;

        runtimeArray().array("a#0", 4);

        expect(ctx.arraySlots.has("dep:fast/a#0:array")).toBe(true);
        expect(ctx.arraySlots.has("a#0:array")).toBe(false);
    });
});
