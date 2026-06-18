// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";
import { describe, expect, it } from "vitest";

import type { ScriptScaffold } from "../transform/ir.js";
import { NameAllocator } from "../transform/nameAllocator.js";
import {
    type HelperNames,
    allocateHelperNames,
    emitHandleRingHelper,
    emitSlotAllocations,
    hasNonCompactHandleSlot,
    renameBarIndexSentinel,
} from "./emitHelpers.js";

// A scaffold stub carrying only the fields the slot-allocation helpers read.
function slotScaffold(overrides: Partial<ScriptScaffold> = {}): ScriptScaffold {
    return {
        constructor: "defineDrawing",
        apiVersion: 1,
        name: "Slots",
        shortName: null,
        overlay: true,
        format: null,
        precision: null,
        scale: null,
        maxDrawings: {},
        maxBarsBack: null,
        inputs: [],
        stateSlots: [],
        handleSlots: [],
        handleRings: [],
        computeBody: { statements: [] },
        diagnostics: [],
        names: new NameAllocator(),
        ...overrides,
    };
}

// The readable helper names a default (collision-free) allocation produces.
const DEFAULT_NAMES: HelperNames = allocateHelperNames(slotScaffold());

// A minimal stand-in for a core `DrawingHandle`: only `remove()` is exercised
// by the ring's eviction path. Each handle carries an id so the test can
// assert which element `at()` returns in logical (FIFO) order.
type FakeHandle = { id: number; remove(): void };

function fakeHandle(id: number): FakeHandle {
    return { id, remove: () => {} };
}

// Transpile the emitted helper lines to runnable JS (stripping the type
// annotations + `DrawingHandle` type that only exist at the chartlang-source
// level) and return the `useDrawingHandleRing(cap)` factory. The emitted
// source declares the type + function; we append a `return` of the factory so
// `transpileModule`'s output, eval'd, hands it back.
function loadRingFactory(): (cap: number) => {
    push(h: FakeHandle | null): void;
    at(i: number): FakeHandle | null;
    size(): number;
} {
    const helperSource = emitHandleRingHelper(DEFAULT_NAMES).join("\n");
    const wrapped = `${helperSource}\nreturn ${DEFAULT_NAMES.useHandleRing};`;
    const js = ts.transpileModule(wrapped, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText;
    // `new Function` evaluates the helper body and returns the factory.
    return new Function(js)();
}

describe("allocateHelperNames", () => {
    it("yields readable, __-free names with no collision", () => {
        const names = allocateHelperNames(slotScaffold());
        expect(names).toEqual({
            barCount: "barCount",
            barIndex: "barIndex",
            handleSlotType: "HandleSlot",
            useHandleSlot: "useDrawingHandleSlot",
            handleRingType: "HandleRing",
            useHandleRing: "useDrawingHandleRing",
        });
        for (const value of Object.values(names)) {
            expect(value.startsWith("__")).toBe(false);
        }
    });

    it("disambiguates a helper name that clashes with a Pine identifier", () => {
        // A Pine script with a `barIndex` var AND a `HandleSlot` identifier
        // forces the bridge + helper type to suffixed readable variants.
        const names = allocateHelperNames(
            slotScaffold({ names: new NameAllocator(["barIndex", "HandleSlot"]) }),
        );
        expect(names.barIndex).toBe("barIndex2");
        expect(names.handleSlotType).toBe("HandleSlot2");
        expect(names.barIndex.startsWith("__")).toBe(false);
    });
});

describe("renameBarIndexSentinel", () => {
    it("rewrites the bar-index sentinel + counter to the allocated names", () => {
        const line = "draw.line(bar.point((__barIndexBridge() - last), bar.close));";
        expect(renameBarIndexSentinel(line, DEFAULT_NAMES)).toBe(
            "draw.line(bar.point((barIndex() - last), bar.close));",
        );
    });

    it("rewrites the counter sentinel and is word-boundary anchored", () => {
        const names = allocateHelperNames(slotScaffold({ names: new NameAllocator(["barIndex"]) }));
        const line = "let __barIndexBridgeCount = 0; const x = __barIndexBridge();";
        const out = renameBarIndexSentinel(line, names);
        expect(out).toContain(`let ${names.barCount} = 0;`);
        expect(out).toContain(`const x = ${names.barIndex}();`);
        expect(out).not.toContain("__barIndexBridge");
    });
});

describe("emitHandleRingHelper — at() honours head after wrap", () => {
    it("returns physical-order elements before the buffer fills", () => {
        const ring = loadRingFactory()(3);
        ring.push(fakeHandle(0));
        ring.push(fakeHandle(1));
        expect(ring.size()).toBe(2);
        expect(ring.at(0)?.id).toBe(0);
        expect(ring.at(1)?.id).toBe(1);
        // Past the live count → null.
        expect(ring.at(2)).toBeNull();
    });

    it("returns oldest→newest logical order after the ring wraps", () => {
        const ring = loadRingFactory()(3);
        // Push 5 handles into a cap-3 ring: 0 and 1 are evicted, leaving the
        // logical FIFO order [2, 3, 4].
        for (let id = 0; id < 5; id += 1) {
            ring.push(fakeHandle(id));
        }
        expect(ring.size()).toBe(3);
        // array.first → at(0) must be the OLDEST live element (2), not the
        // physical slot 0 (which now holds 3 after the wrap).
        expect(ring.at(0)?.id).toBe(2);
        expect(ring.at(1)?.id).toBe(3);
        // array.last → at(size - 1) must be the NEWEST element (4).
        expect(ring.at(ring.size() - 1)?.id).toBe(4);
    });

    it("evicts the oldest handle (calls remove) when full", () => {
        const ring = loadRingFactory()(2);
        const removed: number[] = [];
        const handleWithSpy = (id: number): FakeHandle => ({
            id,
            remove: () => removed.push(id),
        });
        ring.push(handleWithSpy(0));
        ring.push(handleWithSpy(1));
        ring.push(handleWithSpy(2)); // evicts 0
        ring.push(handleWithSpy(3)); // evicts 1
        expect(removed).toEqual([0, 1]);
        expect(ring.at(0)?.id).toBe(2);
        expect(ring.at(1)?.id).toBe(3);
    });

    it("tolerates a null push without removing", () => {
        const ring = loadRingFactory()(1);
        ring.push(fakeHandle(0));
        ring.push(null); // evicts handle 0, stores null
        expect(ring.at(0)).toBeNull();
        expect(ring.size()).toBe(1);
    });
});

describe("emitSlotAllocations — compact handle slots", () => {
    it("skips a compact handle slot's allocation but emits non-compact + state + ring", () => {
        const lines = emitSlotAllocations(
            slotScaffold({
                stateSlots: [{ name: "count", initExpr: "state.int(0)" }],
                handleSlots: [
                    { name: "a", kind: "line", compact: true },
                    { name: "b", kind: "rectangle", compact: false },
                ],
                handleRings: [{ name: "ring", kind: "label", cap: 7 }],
            }),
            DEFAULT_NAMES,
        );
        expect(lines).toEqual([
            "const count = state.int(0);",
            'const b = useDrawingHandleSlot<"rectangle">();',
            'const ring = useDrawingHandleRing<"label">(7);',
        ]);
    });
});

describe("hasNonCompactHandleSlot", () => {
    it("is false when there are no handle slots", () => {
        expect(hasNonCompactHandleSlot(slotScaffold())).toBe(false);
    });

    it("is false when every handle slot is compact", () => {
        expect(
            hasNonCompactHandleSlot(
                slotScaffold({ handleSlots: [{ name: "a", kind: "line", compact: true }] }),
            ),
        ).toBe(false);
    });

    it("is true when any handle slot is non-compact", () => {
        expect(
            hasNonCompactHandleSlot(
                slotScaffold({
                    handleSlots: [
                        { name: "a", kind: "line", compact: true },
                        { name: "b", kind: "table", compact: false },
                    ],
                }),
            ),
        ).toBe(true);
    });
});
