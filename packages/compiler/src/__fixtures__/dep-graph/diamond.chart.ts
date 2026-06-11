// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Fixture for the indicator-composition golden snapshot — two
// consumers (a named export + the default export) both reference
// the same private dep `base`.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";

const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
    },
});

export const sideA = defineIndicator({
    name: "Side A",
    apiVersion: 1,
    compute: () => {
        const value = base.output("line");
        void value;
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
