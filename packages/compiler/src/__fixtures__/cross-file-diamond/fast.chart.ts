// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Cross-file diamond fixture — `fast` binds `base` with a shorter
// lookback override and re-exports it as a drawn indicator.

import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import base from "./base.chart";

const fast = base.withInputs({ length: 20 });

export default defineIndicator({
    name: "Fast Trend",
    apiVersion: 1,
    compute: () => {
        const line = fast.output("line");
        plot(line.current, { title: "fast" });
    },
});
