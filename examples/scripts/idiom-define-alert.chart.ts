// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineAlert, ta } from "@invinite-org/chartlang-core";

// Idiom: the `defineAlert` script KIND — a HEADLESS alert-only script
// (docs/language/overview.md § "The four script kinds", docs/spec/grammar.md).
// Its manifest `kind` is `"alert"` and its capability is `["alerts"]`; it emits
// nothing to render, only `alert(...)` when its condition fires.
export default defineAlert({
    name: "Idiom · defineAlert",
    apiVersion: 1,
    compute({ bar, ta, alert }) {
        // Fire once when the close crosses up through its EMA(20).
        if (ta.crossover(bar.close, ta.ema(bar.close, 20)).current) {
            alert("Close crossed above EMA(20)");
        }
    },
});
