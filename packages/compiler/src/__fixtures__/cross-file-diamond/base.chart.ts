// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Cross-file diamond fixture — root producer. Two consumers (`fast`,
// `slow`) bind `base` with different `withInputs` overrides; their
// downstream consumer (`crossover`) imports both. The bundler must
// inline `base` exactly once.

import { defineIndicator, input, plot } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Base Trend",
    apiVersion: 1,
    inputs: {
        length: input.int(14),
    },
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
    },
});
