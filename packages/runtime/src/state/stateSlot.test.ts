// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { asMutableSlot, StateSlot } from "./stateSlot";

describe("StateSlot", () => {
    it.each([
        ["float", 1, 2, 3],
        ["int", 1, 2, 3],
        ["bool", false, true, false],
        ["string", "a", "b", "c"],
    ] as const)(
        "keeps %s non-tick writes tentative until bar close",
        (_name, init, first, second) => {
            const slot = new StateSlot(init, false);
            const proxy = asMutableSlot(slot);

            expect(proxy.value).toBe(init);
            proxy.value = first;
            expect(slot.committed).toBe(init);
            expect(slot.tentative).toBe(first);
            expect(proxy.value).toBe(first);

            slot.onBarTick();
            expect(proxy.value).toBe(init);
            proxy.value = second;
            slot.onBarClose();
            expect(slot.committed).toBe(second);
            expect(slot.tentative).toBe(second);
        },
    );

    it.each([
        ["float", 1, 2],
        ["int", 1, 2],
        ["bool", false, true],
        ["string", "a", "b"],
    ] as const)("commits %s tick-persistent writes immediately", (_name, init, next) => {
        const slot = new StateSlot(init, true);
        const proxy = asMutableSlot(slot);

        proxy.value = next;
        expect(slot.committed).toBe(next);
        expect(slot.tentative).toBe(init);
        expect(proxy.value).toBe(next);

        slot.onBarTick();
        slot.onBarClose();
        expect(slot.committed).toBe(next);
        expect(slot.tentative).toBe(init);
    });

    it("uses an optional serialiseState hook", () => {
        const slot = new StateSlot(2, false, {
            serialiseState: (value) => ({ doubled: value * 2 }),
        });

        expect(slot.serialise(3)).toEqual({ doubled: 6 });
    });
});
