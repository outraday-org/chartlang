// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Fixture for the indicator-composition golden snapshot — file with
// a private dep, a named-exported sibling, and a default export
// consuming both.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";

const base = defineIndicator({
    name: "Base",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "line" });
    },
});

export const sibling = defineIndicator({
    name: "Sibling",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close, { title: "echo" });
    },
});

export default defineIndicator({
    name: "Main",
    apiVersion: 1,
    compute: () => {
        const x = base.output("line");
        const y = sibling.output("echo");
        void x;
        void y;
    },
});
