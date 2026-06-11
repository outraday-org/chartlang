// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Fixture for the indicator-composition golden snapshot — single
// private dep + default-export consumer in one file.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";

const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
    },
});

export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => {
        const value = base.output("line");
        void value;
    },
});
