// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { makeBarStateView, type EventKind } from "./barstateView.js";

describe("makeBarStateView", () => {
    it("derives every boolean from event kind, bar index, and latest-bar status", () => {
        const eventKinds: EventKind[] = ["history", "close", "tick"];
        const barIndexes = [0, 5];
        const lastFlags = [true, false];

        for (const eventKind of eventKinds) {
            for (const barIndex of barIndexes) {
                for (const isLastBar of lastFlags) {
                    const view = makeBarStateView({ eventKind, barIndex, isLastBar });
                    expect(view).toEqual({
                        isfirst: barIndex === 0,
                        islast: isLastBar,
                        isnew: eventKind === "history" || eventKind === "close",
                        ishistory: eventKind === "history",
                        isrealtime: eventKind === "tick",
                        isconfirmed: eventKind === "close",
                    });
                    expect(Object.isFrozen(view)).toBe(true);
                }
            }
        }
    });
});
