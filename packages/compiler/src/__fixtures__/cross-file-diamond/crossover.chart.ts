// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Cross-file diamond fixture — top consumer. Imports both `fast`
// and `slow`, each of which transitively imports `base`. The bundler
// inlines `base` exactly once across the diamond.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import fast from "./fast.chart";
import slow from "./slow.chart";

export default defineIndicator({
    name: "Crossover",
    apiVersion: 1,
    compute: () => {
        const f = fast.output("fast");
        const s = slow.output("slow");
        plot(f.current - s.current, { title: "spread" });
    },
});
