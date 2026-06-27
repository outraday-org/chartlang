// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineAlertCondition, input, ta } from "@invinite-org/chartlang-core";

// Idiom: the `defineAlertCondition` script KIND — declares NAMED, user-wireable
// conditions (docs/language/overview.md § "The four script kinds",
// docs/spec/grammar.md). Its manifest `kind` is `"alertCondition"`; each
// `conditions` entry is a condition the host exposes for the user to wire to a
// notification, signalled per bar via `signal?.("id", booleanExpr)`.
export default defineAlertCondition({
    name: "Idiom · defineAlertCondition",
    apiVersion: 1,
    inputs: { length: input.int(20, { min: 2, max: 250 }) },
    conditions: {
        up: {
            title: "Cross up",
            description: "Close crosses above the EMA",
            defaultMessage: "{{ticker}} crossed above EMA",
        },
        down: {
            title: "Cross down",
            description: "Close crosses below the EMA",
            defaultMessage: "{{ticker}} crossed below EMA",
        },
    },
    compute({ bar, ta, inputs, signal }) {
        const ema = ta.ema(bar.close, inputs.length as number);
        signal?.("up", ta.crossover(bar.close, ema).current);
        signal?.("down", ta.crossunder(bar.close, ema).current);
    },
});
