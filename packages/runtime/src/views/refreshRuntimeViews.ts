// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { IntervalDescriptor } from "@invinite-org/chartlang-core";

import type { RunnerState } from "../createScriptRunner";
import { makeBarStateView, type EventKind } from "./barstateView";
import { makeTimeframeView } from "./timeframeView";

function findDescriptor(
    intervals: ReadonlyArray<IntervalDescriptor>,
    interval: string,
): IntervalDescriptor | undefined {
    return intervals.find((candidate) => candidate.value === interval);
}

/**
 * Refresh per-step runtime views after the mutable bar view has been updated
 * and before `compute` runs.
 *
 * @since 0.4
 * @stable
 * @example
 *     // refreshRuntimeViews(state, "close");
 *     const fn: typeof refreshRuntimeViews = refreshRuntimeViews;
 *     void fn;
 */
export function refreshRuntimeViews(state: RunnerState, eventKind: EventKind): void {
    const { runtimeContext } = state;
    const interval = runtimeContext.stream.bar.interval;
    runtimeContext.views.barstate = makeBarStateView({
        eventKind,
        barIndex: runtimeContext.barIndex(),
        isLastBar: eventKind !== "history",
    });
    runtimeContext.views.timeframe = makeTimeframeView(
        interval,
        findDescriptor(runtimeContext.capabilities.intervals, interval),
    );
}
