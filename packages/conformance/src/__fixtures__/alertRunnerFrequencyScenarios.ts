// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertFrequency } from "@invinite-org/chartlang-alert-runner";

/** One frequency scenario: a script, a frequency, and the pinned deliveries. */
export type FrequencyScenario = Readonly<{
    id: string;
    title: string;
    inlineSource: string;
    frequency: AlertFrequency;
    cooldownBars?: number;
    /** Run a pre-close evaluation of each bar before its close. */
    preClose: boolean;
    expected: Readonly<{ close: number; preClose: number }>;
}>;

const UP_BAR = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Up bar",
    apiVersion: 1,
    overlay: true,
    compute({ bar, alert }) {
        if (bar.close > bar.open) alert("up " + bar.close, { severity: "info" });
    },
});
`;

const CROSS_CONDITION = `import { defineAlertCondition } from "@invinite-org/chartlang-core";

export default defineAlertCondition({
    name: "EMA cross",
    apiVersion: 1,
    conditions: {
        up: { title: "Cross up", description: "Fast above slow.", defaultMessage: "cross up" },
        down: { title: "Cross down", description: "Fast below slow.", defaultMessage: "cross down" },
    },
    compute({ bar, ta, signal }) {
        const fast = ta.ema(bar.close, 5);
        const slow = ta.ema(bar.close, 20);
        signal?.("up", ta.crossover(fast, slow).current);
        signal?.("down", ta.crossunder(fast, slow).current);
    },
});
`;

/**
 * 100 warm-up bars, then 100 live golden bars (1D, from `goldenBars.json`).
 * The counts were pinned on the first run; the relations between them are
 * what the frequencies promise (56 up bars, 4 EMA crosses in the window).
 */
export const FREQUENCY_SCENARIOS: ReadonlyArray<FrequencyScenario> = [
    // every_time on closes is the drain: one alert per up bar.
    {
        id: "up-every",
        title: "every_time, closes",
        inlineSource: UP_BAR,
        frequency: "every_time",
        preClose: false,
        expected: { close: 56, preClose: 0 },
    },
    // every_time delivers the pre-close AND the close of each up bar.
    {
        id: "up-every-pre",
        title: "every_time, pre-close + close",
        inlineSource: UP_BAR,
        frequency: "every_time",
        preClose: true,
        expected: { close: 56, preClose: 56 },
    },
    // once_per_bar: the pre-close delivers, the same bar's close is one signal with it.
    {
        id: "up-bar-pre",
        title: "once_per_bar, pre-close + close",
        inlineSource: UP_BAR,
        frequency: "once_per_bar",
        preClose: true,
        expected: { close: 0, preClose: 56 },
    },
    // once_per_bar_close: pre-close never delivers, the close does.
    {
        id: "up-close-pre",
        title: "once_per_bar_close, pre-close + close",
        inlineSource: UP_BAR,
        frequency: "once_per_bar_close",
        preClose: true,
        expected: { close: 56, preClose: 0 },
    },
    // once: the first delivering evaluation (a pre-close) and nothing after.
    {
        id: "up-once-pre",
        title: "once, pre-close + close",
        inlineSource: UP_BAR,
        frequency: "once",
        preClose: true,
        expected: { close: 0, preClose: 1 },
    },
    // cooldown: at most one delivery per 5 bars.
    {
        id: "up-cooldown",
        title: "every_time, cooldown 5 bars",
        inlineSource: UP_BAR,
        frequency: "every_time",
        cooldownBars: 5,
        preClose: false,
        expected: { close: 18, preClose: 0 },
    },
    // A lossy script (ta.crossover): pre-close runs on a replayed copy and
    // the close stream is untouched by it.
    {
        id: "cross-close",
        title: "conditions, once_per_bar_close",
        inlineSource: CROSS_CONDITION,
        frequency: "once_per_bar_close",
        preClose: true,
        expected: { close: 4, preClose: 0 },
    },
    {
        id: "cross-every-pre",
        title: "conditions, every_time, pre-close + close",
        inlineSource: CROSS_CONDITION,
        frequency: "every_time",
        preClose: true,
        expected: { close: 4, preClose: 4 },
    },
    {
        id: "cross-once",
        title: "conditions, once",
        inlineSource: CROSS_CONDITION,
        frequency: "once",
        preClose: false,
        expected: { close: 1, preClose: 0 },
    },
];
