// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it, vi } from "vitest";

import { onDblCore, onDragCore, onWheelCore } from "./domWiring.js";
import type { InteractionHandlers } from "./domWiring.js";
import type { ViewController } from "./viewController.js";

// A recording ViewController stub — the cores only invoke its mutators.
function makeController(): ViewController & {
    readonly zoomCalls: Array<[number, number, number, number]>;
    readonly panCalls: Array<[number, number, number]>;
    resetCount: number;
} {
    const zoomCalls: Array<[number, number, number, number]> = [];
    const panCalls: Array<[number, number, number]> = [];
    let resetCount = 0;
    return {
        get userInteracted(): boolean {
            return false;
        },
        resolveXWindow: (a, b) => ({ xMin: a, xMax: b }),
        zoomAt: (pivot, factor, min, max) => {
            zoomCalls.push([pivot, factor, min, max]);
        },
        panBy: (delta, min, max) => {
            panCalls.push([delta, min, max]);
        },
        reset: () => {
            resetCount += 1;
        },
        zoomCalls,
        panCalls,
        get resetCount(): number {
            return resetCount;
        },
        set resetCount(v: number) {
            resetCount = v;
        },
    };
}

function makeHandlers(
    controller: ViewController,
    overrides?: Partial<InteractionHandlers>,
): { handlers: InteractionHandlers; render: ReturnType<typeof vi.fn> } {
    const render = vi.fn();
    const handlers: InteractionHandlers = {
        controller,
        pxToWorldX: (px) => px * 2,
        worldXPerPx: () => 3,
        dataBounds: () => ({ xMin: 0, xMax: 100 }),
        requestRender: render,
        ...overrides,
    };
    return { handlers, render };
}

describe("onWheelCore", () => {
    it("zooms about the world-x under the cursor and renders", () => {
        const controller = makeController();
        const { handlers, render } = makeHandlers(controller);
        onWheelCore(handlers, 25, -120);
        const [pivot, factor, min, max] = controller.zoomCalls[0];
        expect(pivot).toBe(50); // pxToWorldX(25) = 50
        expect(factor).toBeCloseTo(Math.exp(-120 * 0.0015), 10);
        expect(min).toBe(0);
        expect(max).toBe(100);
        expect(render).toHaveBeenCalledOnce();
    });

    it("zoom-out for a positive deltaY yields a factor > 1", () => {
        const controller = makeController();
        const { handlers } = makeHandlers(controller);
        onWheelCore(handlers, 0, 120);
        expect(controller.zoomCalls[0][1]).toBeGreaterThan(1);
    });

    it("honours a custom zoomStep", () => {
        const controller = makeController();
        const { handlers } = makeHandlers(controller, { zoomStep: 0.01 });
        onWheelCore(handlers, 0, -100);
        expect(controller.zoomCalls[0][1]).toBeCloseTo(Math.exp(-1), 10);
    });
});

describe("onDragCore", () => {
    it("pans by the negated pixel delta in world units and renders", () => {
        const controller = makeController();
        const { handlers, render } = makeHandlers(controller);
        onDragCore(handlers, 10);
        expect(controller.panCalls[0]).toEqual([-30, 0, 100]); // -10 * worldXPerPx(3)
        expect(render).toHaveBeenCalledOnce();
    });
});

describe("onDblCore", () => {
    it("resets the controller and renders", () => {
        const controller = makeController();
        const { handlers, render } = makeHandlers(controller);
        onDblCore(handlers);
        expect(controller.resetCount).toBe(1);
        expect(render).toHaveBeenCalledOnce();
    });
});
